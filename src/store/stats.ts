import { dayKey, includedVat, lineTotal, orderDiscount, orderTotal, orderVat } from './selectors';
import type { AppState, DailyClosure, Order, PaymentMethod } from './types';

// Rapport des ventes d'une période (jour, semaine, mois, année) pour l'historique du gérant.
// Sans React Native : testable. Les journées dont les tickets ont été effacés sont reprises
// depuis leur clôture Z (montants complets, mais sans le détail par article, serveur ou heure).

export type PeriodKind = 'jour' | 'semaine' | 'mois' | 'annee';

export interface Period {
  kind: PeriodKind;
  /** Début inclus et fin exclue (heure locale). */
  start: number;
  end: number;
  label: string;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const two = (n: number) => String(n).padStart(2, '0');
const dmy = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Période qui contient `at`. La semaine commence le lundi. */
export function periodOf(kind: PeriodKind, at: number): Period {
  const d = new Date(at);
  if (kind === 'jour') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { kind, start: start.getTime(), end: end.getTime(), label: `${DAYS_SHORT[start.getDay()]} ${dmy(start)}` };
  }
  if (kind === 'semaine') {
    const back = (d.getDay() + 6) % 7;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    return { kind, start: start.getTime(), end: end.getTime(), label: `du ${dmy(start)} au ${dmy(last)}` };
  }
  if (kind === 'mois') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { kind, start: start.getTime(), end: end.getTime(), label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}` };
  }
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear() + 1, 0, 1);
  return { kind, start: start.getTime(), end: end.getTime(), label: `année ${start.getFullYear()}` };
}

/** Période précédente (-1) ou suivante (+1). */
export function shiftPeriod(p: Period, delta: number): Period {
  const d = new Date(p.start);
  if (p.kind === 'jour') return periodOf('jour', new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta).getTime());
  if (p.kind === 'semaine') return periodOf('semaine', new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * delta).getTime());
  if (p.kind === 'mois') return periodOf('mois', new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime());
  return periodOf('annee', new Date(d.getFullYear() + delta, 0, 1).getTime());
}

export interface Bucket {
  key: string;
  label: string;
  revenue: number;
  count: number;
}

export interface Report {
  period: Period;
  /** Chiffre d'affaires TTC (remises déduites, hors pourboires). */
  revenue: number;
  /** TVA collectée (toutes commandes) et par taux (« 21 » → montant). */
  vat: number;
  vatByRate: Record<string, number>;
  tips: number;
  discounts: number;
  count: number;
  cancelled: number;
  guests: number;
  average: number;
  perGuest: number;
  byPayment: Record<PaymentMethod, number>;
  /** Barres du graphique : heures (jour), jours (semaine, mois) ou mois (année). */
  buckets: Bucket[];
  bestBucket: Bucket | null;
  byServer: { name: string; revenue: number; count: number; tips: number }[];
  byCategory: { name: string; emoji: string; revenue: number; qty: number }[];
  topItems: { name: string; qty: number; total: number }[];
  /** Journées comptées depuis leur clôture Z (tickets effacés : pas de détail). */
  closureDays: number;
  /** Tickets encaissés ou annulés de la période (du plus récent au plus ancien). */
  orders: Order[];
}

const emptyPayments = (): Record<PaymentMethod, number> => ({ especes: 0, carte: 0, autre: 0 });

function bucketsFor(p: Period): Bucket[] {
  const out: Bucket[] = [];
  if (p.kind === 'jour') {
    for (let h = 0; h < 24; h++) out.push({ key: String(h), label: `${h} h`, revenue: 0, count: 0 });
  } else if (p.kind === 'annee') {
    for (let m = 0; m < 12; m++) out.push({ key: String(m), label: MONTHS_SHORT[m], revenue: 0, count: 0 });
  } else {
    const d = new Date(p.start);
    for (let t = d; t.getTime() < p.end; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
      const label = p.kind === 'semaine' ? `${DAYS_SHORT[t.getDay()]} ${t.getDate()}` : String(t.getDate());
      out.push({ key: dayKey(t.getTime()), label, revenue: 0, count: 0 });
    }
  }
  return out;
}

function bucketKey(p: Period, ts: number): string {
  const d = new Date(ts);
  if (p.kind === 'jour') return String(d.getHours());
  if (p.kind === 'annee') return String(d.getMonth());
  return dayKey(ts);
}

/** TVA d'une commande et son taux : choisi à l'encaissement, ou TVA incluse (anciennes commandes). */
function vatOf(o: Order, legacyRate: number): { rate: number; amount: number } {
  if (o.vatRate !== null && o.vatRate !== undefined) return { rate: o.vatRate, amount: orderVat(o) };
  return { rate: legacyRate, amount: includedVat(orderTotal(o), legacyRate) };
}

export function buildReport(state: AppState, period: Period): Report {
  const inPeriod = (ts: number | null) => ts !== null && ts >= period.start && ts < period.end;
  const orders = state.orders
    .filter((o) => o.status !== 'ouverte' && inPeriod(o.paidAt))
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
  const paid = orders.filter((o) => o.status === 'payee');
  const buckets = bucketsFor(period);
  const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));
  const byPayment = emptyPayments();
  const vatByRate: Record<string, number> = {};
  const servers = new Map<string, { name: string; revenue: number; count: number; tips: number }>();
  const categories = new Map<string, { name: string; emoji: string; revenue: number; qty: number }>();
  const items = new Map<string, { name: string; qty: number; total: number }>();
  const itemById = new Map(state.items.map((i) => [i.id, i]));
  const catById = new Map(state.categories.map((c) => [c.id, c]));

  let revenue = 0;
  let vat = 0;
  let tips = 0;
  let discounts = 0;
  let guests = 0;
  for (const o of paid) {
    const total = orderTotal(o);
    const tip = o.tip ?? 0;
    revenue += total;
    tips += tip;
    discounts += orderDiscount(o);
    guests += o.guests;
    const v = vatOf(o, state.settings.taxRate);
    vat += v.amount;
    vatByRate[String(v.rate)] = (vatByRate[String(v.rate)] ?? 0) + v.amount;
    if (o.payment) byPayment[o.payment] += total + tip;
    const bi = bucketIndex.get(bucketKey(period, o.paidAt ?? 0));
    if (bi !== undefined) {
      buckets[bi].revenue += total;
      buckets[bi].count += 1;
    }
    const s = servers.get(o.server) ?? { name: o.server, revenue: 0, count: 0, tips: 0 };
    s.revenue += total;
    s.count += 1;
    s.tips += tip;
    servers.set(o.server, s);
    for (const l of o.lines) {
      const cat = catById.get(itemById.get(l.itemId)?.categoryId ?? '');
      const ck = cat?.id ?? 'autres';
      const c = categories.get(ck) ?? { name: cat?.name ?? 'Autres', emoji: cat?.emoji ?? '🍽️', revenue: 0, qty: 0 };
      c.revenue += lineTotal(l);
      c.qty += l.qty;
      categories.set(ck, c);
      const it = items.get(l.itemId) ?? { name: l.name, qty: 0, total: 0 };
      it.qty += l.qty;
      it.total += lineTotal(l);
      items.set(l.itemId, it);
    }
  }

  // Journées sans tickets mais avec une clôture Z (tickets effacés depuis).
  const daysWithOrders = new Set(orders.map((o) => dayKey(o.paidAt ?? 0)));
  let count = paid.length;
  let cancelled = orders.length - paid.length;
  let closureDays = 0;
  for (const z of state.closures) {
    const ts = new Date(`${z.date}T12:00:00`).getTime();
    if (!inPeriod(ts) || daysWithOrders.has(z.date)) continue;
    closureDays += 1;
    addClosure(z);
    const bi = bucketIndex.get(period.kind === 'jour' ? '12' : bucketKey(period, ts));
    if (bi !== undefined) {
      buckets[bi].revenue += z.revenue;
      buckets[bi].count += z.count;
    }
  }
  function addClosure(z: DailyClosure) {
    revenue += z.revenue;
    tips += z.tips;
    discounts += z.discounts;
    guests += z.guests;
    count += z.count;
    cancelled += z.cancelled;
    for (const m of Object.keys(byPayment) as PaymentMethod[]) byPayment[m] += z.byPayment[m] ?? 0;
    if (z.vatByRate && Object.keys(z.vatByRate).length) {
      for (const [r, a] of Object.entries(z.vatByRate)) {
        vatByRate[r] = (vatByRate[r] ?? 0) + a;
        vat += a;
      }
    } else {
      const a = includedVat(z.revenue, state.settings.taxRate);
      vatByRate[String(state.settings.taxRate)] = (vatByRate[String(state.settings.taxRate)] ?? 0) + a;
      vat += a;
    }
  }

  const best = buckets.reduce<Bucket | null>((m, b) => (b.revenue > 0 && (!m || b.revenue > m.revenue) ? b : m), null);
  return {
    period,
    revenue,
    vat,
    vatByRate,
    tips,
    discounts,
    count,
    cancelled,
    guests,
    average: count ? Math.round(revenue / count) : 0,
    perGuest: guests ? Math.round(revenue / guests) : 0,
    byPayment,
    buckets,
    bestBucket: best,
    byServer: [...servers.values()].sort((a, b) => b.revenue - a.revenue),
    byCategory: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 10),
    closureDays,
    orders,
  };
}

/** Évolution en % par rapport à la période précédente (null si rien à comparer). */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Export CSV (séparateur « ; », montants en euros) : une ligne par ticket, pour le comptable. */
export function reportCsv(state: AppState, r: Report): string {
  const head = ['Date', 'Heure', 'Ticket', 'Table', 'Serveur', 'Statut', 'Paiement', 'Total HT', 'Taux TVA', 'TVA', 'Total TTC', 'Remise', 'Pourboire', 'Couverts'];
  const rows = r.orders.map((o) => {
    const d = new Date(o.paidAt ?? 0);
    const v = vatOf(o, state.settings.taxRate);
    const ttc = o.status === 'payee' ? orderTotal(o) : 0;
    return [
      dmy(d),
      `${two(d.getHours())}:${two(d.getMinutes())}`,
      o.number,
      o.label,
      o.server,
      o.status === 'payee' ? 'Encaissé' : 'Annulé',
      o.payment ?? '',
      euros(ttc - (o.status === 'payee' ? v.amount : 0)),
      `${v.rate} %`,
      euros(o.status === 'payee' ? v.amount : 0),
      euros(ttc),
      euros(o.status === 'payee' ? orderDiscount(o) : 0),
      euros(o.status === 'payee' ? (o.tip ?? 0) : 0),
      o.guests,
    ];
  });
  return [head, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
}
