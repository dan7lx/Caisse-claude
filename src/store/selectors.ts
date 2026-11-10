import type { AppState, LineStatus, Order, OrderLine, PaymentMethod, Station } from './types';

export const lineTotal = (line: OrderLine) => line.unitPrice * line.qty;

export const orderTotal = (order: Order) => order.lines.reduce((sum, l) => sum + lineTotal(l), 0);

export const openOrders = (state: AppState) => state.orders.filter((o) => o.status === 'ouverte');

export const openOrderForTable = (state: AppState, tableId: string) =>
  state.orders.find((o) => o.status === 'ouverte' && o.tableId === tableId);

/** Quantités par statut de ligne. */
export function countByStatus(order: Order): Record<LineStatus, number> {
  const counts: Record<LineStatus, number> = {
    brouillon: 0,
    envoye: 0,
    en_preparation: 0,
    pret: 0,
    servi: 0,
  };
  for (const l of order.lines) counts[l.status] += l.qty;
  return counts;
}

export type TableState = 'libre' | 'occupee' | 'a_envoyer' | 'pret';

export function tableState(order: Order | undefined): TableState {
  if (!order) return 'libre';
  if (order.lines.some((l) => l.status === 'pret')) return 'pret';
  if (order.lines.some((l) => l.status === 'brouillon')) return 'a_envoyer';
  return 'occupee';
}

/** Un ticket = un envoi d'une commande vers un poste (cuisine ou bar). */
export interface Ticket {
  key: string;
  order: Order;
  batch: number;
  station: Station;
  lines: OrderLine[];
  sentAt: number;
  readyAt: number | null;
}

const ACTIVE: LineStatus[] = ['envoye', 'en_preparation'];

export function kitchenTickets(state: AppState, station: Station, now = Date.now()) {
  const tickets: Ticket[] = [];
  for (const order of state.orders) {
    if (order.status === 'annulee') continue;
    const byBatch = new Map<number, OrderLine[]>();
    for (const line of order.lines) {
      if (line.station !== station || line.batch === null) continue;
      byBatch.set(line.batch, [...(byBatch.get(line.batch) ?? []), line]);
    }
    for (const [batch, lines] of byBatch) {
      const readyTimes = lines.map((l) => l.readyAt ?? 0);
      tickets.push({
        key: `${order.id}-${station}-${batch}`,
        order,
        batch,
        station,
        lines,
        sentAt: Math.min(...lines.map((l) => l.sentAt ?? now)),
        readyAt: lines.every((l) => !ACTIVE.includes(l.status)) ? Math.max(...readyTimes) : null,
      });
    }
  }
  const active = tickets
    .filter((t) => t.lines.some((l) => ACTIVE.includes(l.status)))
    .sort((a, b) => a.sentAt - b.sentAt);
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const done = tickets
    .filter((t) => t.readyAt !== null && now - t.readyAt < THREE_HOURS)
    .sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0))
    .slice(0, 8);
  return { active, done };
}

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function salesStats(orders: Order[]) {
  const paid = orders.filter((o) => o.status === 'payee');
  const revenue = paid.reduce((sum, o) => sum + orderTotal(o), 0);
  const guests = paid.reduce((sum, o) => sum + o.guests, 0);
  const byPayment: Record<PaymentMethod, number> = { especes: 0, carte: 0, autre: 0 };
  const itemCounts = new Map<string, { name: string; qty: number; total: number }>();
  for (const o of paid) {
    if (o.payment) byPayment[o.payment] += orderTotal(o);
    for (const l of o.lines) {
      const entry = itemCounts.get(l.itemId) ?? { name: l.name, qty: 0, total: 0 };
      entry.qty += l.qty;
      entry.total += lineTotal(l);
      itemCounts.set(l.itemId, entry);
    }
  }
  return {
    count: paid.length,
    cancelled: orders.filter((o) => o.status === 'annulee').length,
    revenue,
    guests,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    byPayment,
    topItems: [...itemCounts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
  };
}
