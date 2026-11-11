import { includedVat, orderDiscount, orderNet, orderSubtotal, orderTotal, orderVat } from '../store/selectors';
import type { AppState, DailyClosure, Order, OrderLine } from '../store/types';
import { paymentLabel } from '../labels';
import { formatPrice } from '../utils/format';

/** Ligne d'un ticket affiché à l'écran (ticket de caisse, clôture Z). */
export type TicketLine =
  | { k: 'title'; text: string }
  | { k: 'center'; text: string; bold?: boolean }
  | { k: 'text'; text: string; bold?: boolean; big?: boolean }
  | { k: 'row'; left: string; right: string; bold?: boolean; big?: boolean }
  | { k: 'sep' }
  | { k: 'feed' };

export interface TicketDoc {
  title: string;
  lines: TicketLine[];
  /** Logo du commerce (data URI). */
  logo?: string | null;
}

const two = (n: number) => String(n).padStart(2, '0');
export const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};
const formatDay = (date: string) => date.split('-').reverse().join('/');
const pct = (rate: number) => `${String(rate).replace('.', ',')} %`;

function header(state: AppState): TicketLine[] {
  const s = state.settings;
  const lines: TicketLine[] = [{ k: 'title', text: s.restaurantName }];
  if (s.slogan) lines.push({ k: 'center', text: s.slogan });
  if (s.address) lines.push({ k: 'center', text: s.address });
  if (s.phone) lines.push({ k: 'center', text: `Tél. ${s.phone}` });
  if (s.vatNumber) lines.push({ k: 'center', text: `TVA ${s.vatNumber}` });
  lines.push({ k: 'sep' });
  return lines;
}

/** Regroupe les lignes identiques (même article, même choix, même prix) pour le ticket client. */
function mergeLines(lines: OrderLine[]): OrderLine[] {
  const out: OrderLine[] = [];
  for (const l of lines) {
    const same = out.find((x) => x.itemId === l.itemId && x.note === l.note && x.unitPrice === l.unitPrice);
    if (same) same.qty += l.qty;
    else out.push({ ...l });
  }
  return out;
}

/** Ticket de caisse d'une commande encaissée. */
export function receiptDoc(state: AppState, order: Order): TicketDoc {
  const p = (n: number) => formatPrice(n, state.settings.currency);
  const total = orderTotal(order);
  const tip = order.tip ?? 0;
  const lines: TicketLine[] = [...header(state)];

  lines.push({ k: 'center', text: 'TICKET DE CAISSE', bold: true });
  lines.push({ k: 'row', left: `N° ${order.number}`, right: formatDateTime(order.paidAt ?? Date.now()) });
  lines.push({ k: 'row', left: order.label, right: `${order.guests} couvert${order.guests > 1 ? 's' : ''}` });
  lines.push({ k: 'row', left: 'Serveur', right: order.server });
  lines.push({ k: 'sep' });

  for (const l of mergeLines(order.lines)) {
    lines.push({ k: 'row', left: `${l.qty} x ${l.name}`, right: p(l.unitPrice * l.qty) });
    if (l.note) lines.push({ k: 'text', text: `    ${l.note}` });
  }
  lines.push({ k: 'sep' });

  const discount = orderDiscount(order);
  if (discount) {
    lines.push({ k: 'row', left: 'Sous-total', right: p(orderSubtotal(order)) });
    lines.push({ k: 'row', left: `Remise ${order.discountPct} %`, right: `-${p(discount)}` });
  }
  if (order.vatRate !== null && order.vatRate !== undefined) {
    // TVA choisie à l'encaissement, ajoutée au montant.
    lines.push({ k: 'row', left: 'Total HT', right: p(orderNet(order)) });
    lines.push({ k: 'row', left: `TVA ${pct(order.vatRate)}`, right: p(orderVat(order)) });
    lines.push({ k: 'row', left: 'TOTAL TTC', right: p(total), bold: true, big: true });
  } else {
    // Anciennes commandes : TVA incluse dans les prix.
    const rate = state.settings.taxRate;
    const vat = includedVat(total, rate);
    lines.push({ k: 'row', left: 'TOTAL TTC', right: p(total), bold: true, big: true });
    lines.push({ k: 'row', left: 'Total HT', right: p(total - vat) });
    lines.push({ k: 'row', left: `TVA ${pct(rate)}`, right: p(vat) });
  }

  if (tip) {
    lines.push({ k: 'row', left: 'Pourboire', right: p(tip) });
    lines.push({ k: 'row', left: 'TOTAL PAYÉ', right: p(total + tip), bold: true });
  }
  if (order.payment) lines.push({ k: 'row', left: 'Paiement', right: paymentLabel[order.payment] });
  if (order.payment === 'especes' && order.cashReceived) {
    lines.push({ k: 'row', left: 'Espèces reçues', right: p(order.cashReceived) });
    lines.push({ k: 'row', left: 'Rendu', right: p(Math.max(0, order.cashReceived - total - tip)) });
  }
  lines.push({ k: 'sep' });
  if (state.settings.receiptFooter) lines.push({ k: 'center', text: state.settings.receiptFooter });
  lines.push({ k: 'feed' });
  return { title: `Ticket n°${order.number}`, lines, logo: state.settings.logo };
}

/** Clôture journalière (Z de caisse). */
export function closureDoc(state: AppState, z: DailyClosure): TicketDoc {
  const p = (n: number) => formatPrice(n, state.settings.currency);
  const lines: TicketLine[] = [...header(state)];
  lines.push({ k: 'center', text: `CLÔTURE Z DU ${formatDay(z.date)}`, bold: true });
  lines.push({ k: 'center', text: `Clôturé le ${formatDateTime(z.closedAt)}` });
  lines.push({ k: 'sep' });
  lines.push({ k: 'row', left: 'Tickets encaissés', right: String(z.count) });
  lines.push({ k: 'row', left: 'Couverts', right: String(z.guests) });
  lines.push({ k: 'row', left: 'Ticket moyen', right: p(z.count ? Math.round(z.revenue / z.count) : 0) });
  lines.push({ k: 'row', left: 'Annulations', right: String(z.cancelled) });
  lines.push({ k: 'sep' });
  lines.push({ k: 'row', left: "CHIFFRE D'AFFAIRES TTC", right: p(z.revenue), bold: true });

  const rates = Object.keys(z.vatByRate ?? {});
  if (z.vatByRate && rates.length) {
    const vat = rates.reduce((sum, r) => sum + (z.vatByRate?.[r] ?? 0), 0);
    lines.push({ k: 'row', left: 'Total HT', right: p(z.revenue - vat) });
    for (const r of rates.sort((a, b) => Number(a) - Number(b))) {
      lines.push({ k: 'row', left: `TVA ${pct(Number(r))}`, right: p(z.vatByRate[r]) });
    }
  } else {
    const vat = includedVat(z.revenue, state.settings.taxRate);
    lines.push({ k: 'row', left: 'Total HT', right: p(z.revenue - vat) });
    lines.push({ k: 'row', left: `TVA ${pct(state.settings.taxRate)}`, right: p(vat) });
  }
  lines.push({ k: 'row', left: 'Remises accordées', right: p(z.discounts) });
  lines.push({ k: 'row', left: 'Pourboires', right: p(z.tips) });
  lines.push({ k: 'sep' });
  lines.push({ k: 'text', text: 'Encaissements', bold: true });
  for (const m of Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]) {
    lines.push({ k: 'row', left: paymentLabel[m], right: p(z.byPayment[m]) });
  }
  lines.push({ k: 'row', left: 'TOTAL ENCAISSÉ', right: p(z.revenue + z.tips), bold: true });
  if (z.topItems.length) {
    lines.push({ k: 'sep' }, { k: 'text', text: 'Meilleures ventes', bold: true });
    z.topItems.forEach((i, idx) => lines.push({ k: 'row', left: `${idx + 1}. ${i.name} x${i.qty}`, right: p(i.total) }));
  }
  lines.push({ k: 'feed' });
  return { title: `Clôture du ${formatDay(z.date)}`, logo: state.settings.logo, lines };
}
