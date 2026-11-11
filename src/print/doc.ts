import { includedVat, orderDiscount, orderSubtotal, orderTotal, salesStats, type Ticket } from '../store/selectors';
import type { AppState, DailyClosure, Order, OrderLine } from '../store/types';
import { paymentLabel } from '../labels';
import { formatPrice } from '../utils/format';

/** Ligne d'un document imprimé (ticket, bon cuisine, rapport). */
export type PrintLine =
  | { k: 'title'; text: string }
  | { k: 'center'; text: string; bold?: boolean }
  | { k: 'text'; text: string; bold?: boolean; big?: boolean }
  | { k: 'row'; left: string; right: string; bold?: boolean; big?: boolean }
  | { k: 'sep' }
  | { k: 'feed' };

export interface PrintDoc {
  title: string;
  lines: PrintLine[];
  /** Logo (data URI) pour l'impression classique. */
  logo?: string | null;
}

const two = (n: number) => String(n).padStart(2, '0');
export const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};
const formatDay = (date: string) => date.split('-').reverse().join('/');

function header(state: AppState): PrintLine[] {
  const s = state.settings;
  const lines: PrintLine[] = [{ k: 'title', text: s.restaurantName }];
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

/**
 * Ticket de caisse (commande encaissée) ou addition (commande en cours).
 */
export function receiptDoc(state: AppState, order: Order): PrintDoc {
  const c = state.settings.currency;
  const p = (n: number) => formatPrice(n, c);
  const paid = order.status === 'payee';
  const rate = state.settings.taxRate;
  const total = orderTotal(order);
  const tip = order.tip ?? 0;
  const vat = includedVat(total, rate);
  const lines: PrintLine[] = [...header(state)];

  lines.push({ k: 'center', text: paid ? 'TICKET DE CAISSE' : 'ADDITION', bold: true });
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
  lines.push({ k: 'row', left: 'TOTAL TTC', right: p(total), bold: true, big: true });
  lines.push({ k: 'row', left: 'Total HT', right: p(total - vat) });
  lines.push({ k: 'row', left: `TVA ${String(rate).replace('.', ',')} %`, right: p(vat) });

  if (paid) {
    if (tip) {
      lines.push({ k: 'row', left: 'Pourboire', right: p(tip) });
      lines.push({ k: 'row', left: 'TOTAL PAYÉ', right: p(total + tip), bold: true });
    }
    if (order.payment) lines.push({ k: 'row', left: 'Paiement', right: paymentLabel[order.payment] });
    if (order.payment === 'especes' && order.cashReceived) {
      lines.push({ k: 'row', left: 'Espèces reçues', right: p(order.cashReceived) });
      lines.push({ k: 'row', left: 'Rendu', right: p(Math.max(0, order.cashReceived - total - tip)) });
    }
  } else if (order.guests > 1) {
    lines.push({ k: 'row', left: `Par couvert (${order.guests})`, right: p(Math.round(total / order.guests)) });
  }
  lines.push({ k: 'sep' });
  if (state.settings.receiptFooter) lines.push({ k: 'center', text: state.settings.receiptFooter });
  lines.push({ k: 'feed' });
  return { title: `${paid ? 'Ticket' : 'Addition'} n°${order.number}`, lines, logo: state.settings.logo };
}

/** Bon de préparation pour la cuisine ou le bar. */
export function kitchenDoc(ticket: Ticket): PrintDoc {
  const lines: PrintLine[] = [
    { k: 'title', text: ticket.station === 'bar' ? 'BAR' : 'CUISINE' },
    { k: 'text', text: ticket.order.label, bold: true, big: true },
    { k: 'row', left: `N° ${ticket.order.number} · envoi ${ticket.batch}`, right: formatDateTime(ticket.sentAt) },
    { k: 'row', left: `Serveur ${ticket.order.server}`, right: `${ticket.order.guests} couv.` },
    { k: 'sep' },
  ];
  for (const l of ticket.lines) {
    lines.push({ k: 'text', text: `${l.qty} x ${l.name}`, bold: true, big: true });
    if (l.note) lines.push({ k: 'text', text: `  >> ${l.note}`, bold: true });
  }
  lines.push({ k: 'sep' }, { k: 'feed' });
  return { title: `Bon ${ticket.order.label}`, lines };
}

interface ReportData {
  title: string;
  subtitle: string;
  count: number;
  cancelled: number;
  guests: number;
  revenue: number;
  tips: number;
  discounts: number;
  byPayment: DailyClosure['byPayment'];
  topItems: DailyClosure['topItems'];
}

function reportLines(state: AppState, r: ReportData): PrintLine[] {
  const c = state.settings.currency;
  const p = (n: number) => formatPrice(n, c);
  const vat = includedVat(r.revenue, state.settings.taxRate);
  const lines: PrintLine[] = [...header(state)];
  lines.push({ k: 'center', text: r.title, bold: true });
  lines.push({ k: 'center', text: r.subtitle });
  lines.push({ k: 'sep' });
  lines.push({ k: 'row', left: 'Tickets encaissés', right: String(r.count) });
  lines.push({ k: 'row', left: 'Couverts', right: String(r.guests) });
  lines.push({ k: 'row', left: 'Ticket moyen', right: p(r.count ? Math.round(r.revenue / r.count) : 0) });
  lines.push({ k: 'row', left: 'Annulations', right: String(r.cancelled) });
  lines.push({ k: 'sep' });
  lines.push({ k: 'row', left: "CHIFFRE D'AFFAIRES TTC", right: p(r.revenue), bold: true });
  lines.push({ k: 'row', left: 'Total HT', right: p(r.revenue - vat) });
  lines.push({ k: 'row', left: `TVA ${String(state.settings.taxRate).replace('.', ',')} %`, right: p(vat) });
  lines.push({ k: 'row', left: 'Remises accordées', right: p(r.discounts) });
  lines.push({ k: 'row', left: 'Pourboires', right: p(r.tips) });
  lines.push({ k: 'sep' });
  lines.push({ k: 'text', text: 'Encaissements', bold: true });
  for (const m of Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]) {
    lines.push({ k: 'row', left: paymentLabel[m], right: p(r.byPayment[m]) });
  }
  lines.push({ k: 'row', left: 'TOTAL ENCAISSÉ', right: p(r.revenue + r.tips), bold: true });
  if (r.topItems.length) {
    lines.push({ k: 'sep' }, { k: 'text', text: 'Meilleures ventes', bold: true });
    r.topItems.forEach((i, idx) => lines.push({ k: 'row', left: `${idx + 1}. ${i.name} x${i.qty}`, right: p(i.total) }));
  }
  lines.push({ k: 'sep' }, { k: 'center', text: `Imprimé le ${formatDateTime(Date.now())}` }, { k: 'feed' });
  return lines;
}

/** Rapport des ventes d'une période (historique & statistiques). */
export function statsDoc(state: AppState, orders: Order[], periodLabel: string): PrintDoc {
  const st = salesStats(orders);
  return {
    title: `Rapport ${periodLabel}`,
    logo: state.settings.logo,
    lines: reportLines(state, { ...st, title: 'RAPPORT DES VENTES', subtitle: periodLabel }),
  };
}

/** Clôture journalière (Z de caisse). */
export function closureDoc(state: AppState, z: DailyClosure): PrintDoc {
  return {
    title: `Clôture du ${formatDay(z.date)}`,
    logo: state.settings.logo,
    lines: reportLines(state, { ...z, title: `CLÔTURE Z DU ${formatDay(z.date)}`, subtitle: `Clôturé le ${formatDateTime(z.closedAt)}` }),
  };
}

export function testDoc(state: AppState, width: number): PrintDoc {
  return {
    title: 'Impression test',
    lines: [
      { k: 'title', text: state.settings.restaurantName },
      { k: 'center', text: 'Impression test réussie' },
      { k: 'sep' },
      { k: 'row', left: 'Papier', right: `${width} mm` },
      { k: 'row', left: 'Accents', right: 'é è à ç ù € ô' },
      { k: 'row', left: 'Total', right: formatPrice(12345, state.settings.currency), bold: true, big: true },
      { k: 'sep' },
      { k: 'center', text: formatDateTime(Date.now()) },
      { k: 'feed' },
    ],
  };
}
