import type { AppState, DailyClosure, LineStatus, Order, OrderLine, PaymentMethod, Station, Table } from './types';

/** Libellé d'une commande à partir du nom de la table (« 5 » → « Table 5 »). */
export const tableLabel = (t: Table) => (/^\d+$/.test(t.name) ? `Table ${t.name}` : t.name);

export const lineTotal = (line: OrderLine) => line.unitPrice * line.qty;

/** Total des articles, avant remise. */
export const orderSubtotal = (order: Order) => order.lines.reduce((sum, l) => sum + lineTotal(l), 0);

/** Montant de la remise (arrondi au centime). */
export const orderDiscount = (order: Order) => Math.round((orderSubtotal(order) * (order.discountPct ?? 0)) / 100);

/** Montant des articles, remise déduite, avant TVA (hors pourboire). */
export const orderNet = (order: Order) => orderSubtotal(order) - orderDiscount(order);

/** TVA ajoutée à un montant hors TVA (arrondie au centime). */
export const vatOn = (net: number, rate: number) => Math.round((net * rate) / 100);

/** TVA de la commande (choisie à l'encaissement). 0 pour les anciennes commandes, dont la TVA était incluse. */
export const orderVat = (order: Order) => (order.vatRate === null || order.vatRate === undefined ? 0 : vatOn(orderNet(order), order.vatRate));

/** Total TTC à payer, remise déduite et TVA ajoutée (hors pourboire). */
export const orderTotal = (order: Order) => orderNet(order) + orderVat(order);

/** TVA incluse dans un montant TTC (anciennes commandes). */
export const includedVat = (amount: number, rate: number) => Math.round((amount * rate) / (100 + rate));

/** Jour local au format AAAA-MM-JJ. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const tips = paid.reduce((sum, o) => sum + (o.tip ?? 0), 0);
  const discounts = paid.reduce((sum, o) => sum + orderDiscount(o), 0);
  const guests = paid.reduce((sum, o) => sum + o.guests, 0);
  const vatByRate: Record<string, number> = {};
  for (const o of paid) {
    if (o.vatRate === null || o.vatRate === undefined) continue;
    const key = String(o.vatRate);
    vatByRate[key] = (vatByRate[key] ?? 0) + orderVat(o);
  }
  const vat = Object.values(vatByRate).reduce((a, b) => a + b, 0);
  const byPayment: Record<PaymentMethod, number> = { especes: 0, carte: 0, autre: 0 };
  const itemCounts = new Map<string, { name: string; qty: number; total: number }>();
  for (const o of paid) {
    // Encaissé par moyen de paiement : total payé + pourboire.
    if (o.payment) byPayment[o.payment] += orderTotal(o) + (o.tip ?? 0);
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
    vat,
    vatByRate,
    tips,
    discounts,
    guests,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    byPayment,
    topItems: [...itemCounts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
  };
}

/** Clôture (Z de caisse) d'une journée donnée, à partir des commandes clôturées ce jour-là. */
export function buildClosure(state: AppState, date: string, now = Date.now()): DailyClosure {
  const ofDay = state.orders.filter((o) => o.status !== 'ouverte' && o.paidAt !== null && dayKey(o.paidAt) === date);
  const st = salesStats(ofDay);
  return {
    date,
    closedAt: now,
    count: st.count,
    cancelled: st.cancelled,
    guests: st.guests,
    revenue: st.revenue,
    vatByRate: st.vatByRate,
    tips: st.tips,
    discounts: st.discounts,
    byPayment: st.byPayment,
    topItems: st.topItems,
  };
}

/** Jours passés ayant des commandes clôturées mais pas encore de clôture (du plus ancien au plus récent). */
export function daysToClose(state: AppState, now = Date.now()): string[] {
  const today = dayKey(now);
  const done = new Set(state.closures.map((c) => c.date));
  const days = new Set<string>();
  for (const o of state.orders) {
    if (o.status === 'ouverte' || o.paidAt === null) continue;
    const d = dayKey(o.paidAt);
    if (d < today && !done.has(d)) days.add(d);
  }
  return [...days].sort();
}
