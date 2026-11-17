import type { Ticket } from '../store/selectors';
import type { AppState } from '../store/types';
import { formatPrice } from '../utils/format';
import { formatDateTime, type TicketDoc, type TicketLine } from './doc';

/** Bon de préparation pour la cuisine ou le bar (un envoi d'une commande). */
export function kitchenDoc(ticket: Ticket): TicketDoc {
  const o = ticket.order;
  const lines: TicketLine[] = [
    { k: 'title', text: ticket.station === 'bar' ? 'BAR' : 'CUISINE' },
    { k: 'text', text: o.label, bold: true, big: true },
    { k: 'row', left: `N° ${o.number} · envoi ${ticket.batch}`, right: formatDateTime(ticket.sentAt) },
    { k: 'row', left: `Serveur ${o.server}`, right: `${o.guests} couv.` },
    { k: 'sep' },
  ];
  for (const l of ticket.lines) {
    lines.push({ k: 'text', text: `${l.qty} x ${l.name}`, bold: true, big: true });
    if (l.note) lines.push({ k: 'text', text: `  >> ${l.note}`, bold: true });
  }
  lines.push({ k: 'sep' }, { k: 'feed' });
  return { title: `Bon ${o.label}`, lines };
}

/** Page d'essai : vérifie la connexion, la largeur du papier et les accents. */
export function testDoc(state: AppState, paperWidth: number, how: string, now: number): TicketDoc {
  return {
    title: 'Impression test',
    lines: [
      { k: 'title', text: state.settings.restaurantName },
      { k: 'center', text: 'Impression test réussie', bold: true },
      { k: 'sep' },
      { k: 'row', left: 'Connexion', right: how },
      { k: 'row', left: 'Papier', right: `${paperWidth} mm` },
      { k: 'row', left: 'Accents', right: 'é è à ç ù € ô' },
      { k: 'row', left: 'Total', right: formatPrice(12345, state.settings.currency), bold: true, big: true },
      { k: 'sep' },
      { k: 'center', text: formatDateTime(now) },
      { k: 'feed' },
    ],
  };
}
