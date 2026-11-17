import type { Report } from '../store/stats';
import type { AppState } from '../store/types';
import { paymentLabel } from '../labels';
import { formatPrice } from '../utils/format';
import { formatDateTime, type TicketDoc, type TicketLine } from './doc';

const pct = (rate: string) => `${rate.replace('.', ',')} %`;

/** Rapport des ventes d'une période (jour, semaine, mois, année), pour l'écran ou l'imprimante. */
export function reportDoc(state: AppState, r: Report, now: number): TicketDoc {
  const p = (n: number) => formatPrice(n, state.settings.currency);
  const lines: TicketLine[] = [{ k: 'title', text: state.settings.restaurantName }];
  if (state.settings.vatNumber) lines.push({ k: 'center', text: `TVA ${state.settings.vatNumber}` });
  lines.push({ k: 'sep' }, { k: 'center', text: 'RAPPORT DES VENTES', bold: true }, { k: 'center', text: r.period.label });
  lines.push({ k: 'center', text: `Édité le ${formatDateTime(now)}` }, { k: 'sep' });
  lines.push({ k: 'row', left: 'Tickets encaissés', right: String(r.count) });
  lines.push({ k: 'row', left: 'Annulations', right: String(r.cancelled) });
  lines.push({ k: 'row', left: 'Couverts', right: String(r.guests) });
  lines.push({ k: 'row', left: 'Ticket moyen', right: p(r.average) });
  lines.push({ k: 'row', left: 'Moyenne par couvert', right: p(r.perGuest) });
  lines.push({ k: 'sep' });
  lines.push({ k: 'row', left: "CHIFFRE D'AFFAIRES TTC", right: p(r.revenue), bold: true });
  lines.push({ k: 'row', left: 'Total HT', right: p(r.revenue - r.vat) });
  for (const rate of Object.keys(r.vatByRate).sort((a, b) => Number(a) - Number(b))) {
    lines.push({ k: 'row', left: `TVA ${pct(rate)}`, right: p(r.vatByRate[rate]) });
  }
  lines.push({ k: 'row', left: 'Remises accordées', right: p(r.discounts) });
  lines.push({ k: 'row', left: 'Pourboires', right: p(r.tips) });
  lines.push({ k: 'sep' }, { k: 'text', text: 'Encaissements', bold: true });
  for (const m of Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]) {
    lines.push({ k: 'row', left: paymentLabel[m], right: p(r.byPayment[m]) });
  }
  lines.push({ k: 'row', left: 'TOTAL ENCAISSÉ', right: p(r.revenue + r.tips), bold: true });
  if (r.byServer.length) {
    lines.push({ k: 'sep' }, { k: 'text', text: 'Par serveur', bold: true });
    r.byServer.forEach((s) => lines.push({ k: 'row', left: `${s.name} (${s.count})`, right: p(s.revenue) }));
  }
  if (r.byCategory.length) {
    lines.push({ k: 'sep' }, { k: 'text', text: 'Par catégorie', bold: true });
    r.byCategory.forEach((c) => lines.push({ k: 'row', left: `${c.name} x${c.qty}`, right: p(c.revenue) }));
  }
  if (r.topItems.length) {
    lines.push({ k: 'sep' }, { k: 'text', text: 'Meilleures ventes', bold: true });
    r.topItems.forEach((i, idx) => lines.push({ k: 'row', left: `${idx + 1}. ${i.name} x${i.qty}`, right: p(i.total) }));
  }
  if (r.closureDays) {
    lines.push({ k: 'sep' }, { k: 'text', text: `${r.closureDays} jour(s) repris des clôtures Z (détail des tickets effacé).` });
  }
  lines.push({ k: 'feed' });
  return { title: `Rapport ${r.period.label}`, lines, logo: state.settings.logo };
}
