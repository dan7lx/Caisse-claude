import { REMINDER_DAYS } from '../config';
import type { Dashboard, PaymentOrder, ServerLicense } from './server';

// Calculs du tableau de bord du créateur (sans React Native : testables).

const DAY = 86_400_000;

export type LicenseHealth = 'vie' | 'active' | 'bientot' | 'expiree' | 'revoquee' | 'aucune';

/** État d'une licence pour l'affichage : à vie, active, se termine sous 5 jours, expirée, révoquée. */
export function licenseHealth(l: ServerLicense, now: number): LicenseHealth {
  if (l.revoked) return 'revoquee';
  if (l.plan === 'vie') return 'vie';
  if (l.plan !== 'mensuel' || l.valid_until === null) return 'aucune';
  if (l.valid_until <= now) return 'expiree';
  if (l.valid_until - now <= REMINDER_DAYS * DAY) return 'bientot';
  return 'active';
}

export const daysLeft = (l: ServerLicense, now: number) =>
  l.valid_until === null ? null : Math.max(0, Math.ceil((l.valid_until - now) / DAY));

/** Ce que le créateur doit faire pour une commande (null = rien). */
export function orderTodo(o: PaymentOrder): 'verifier' | 'attente' | 'generer' | 'envoyer' | null {
  if (o.status === 'preuve_envoyee') return 'verifier';
  if (o.status === 'en_attente') return 'attente';
  if (o.status === 'confirmee' && !o.key_created_at) return 'generer';
  if (o.status === 'confirmee' && !o.key_redeemed_at) return 'envoyer';
  return null;
}

const TODO_ORDER = { verifier: 0, generer: 1, envoyer: 2, attente: 3 } as const;

/** Commandes à traiter, les plus urgentes d'abord (preuve reçue, clé à générer, clé à envoyer, en attente). */
export function ordersToProcess(orders: PaymentOrder[]): PaymentOrder[] {
  return orders
    .filter((o) => orderTodo(o) !== null)
    .sort((a, b) => {
      const ta = TODO_ORDER[orderTodo(a) ?? 'attente'];
      const tb = TODO_ORDER[orderTodo(b) ?? 'attente'];
      return ta - tb || Date.parse(b.created_at) - Date.parse(a.created_at);
    });
}

/** Paiements confirmés (historique), du plus récent au plus ancien. */
export const confirmedPayments = (orders: PaymentOrder[]) =>
  orders
    .filter((o) => o.status === 'confirmee')
    .sort((a, b) => Date.parse(b.confirmed_at ?? b.created_at) - Date.parse(a.confirmed_at ?? a.created_at));

export interface DashboardStats {
  toProcess: number;
  proofs: number;
  activeLicenses: number;
  endingSoon: number;
  expired: number;
  revenueThisMonth: number;
  revenueTotal: number;
}

export function dashboardStats(d: Dashboard): DashboardStats {
  const now = d.now;
  const month = new Date(now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const paid = confirmedPayments(d.orders);
  const health = d.licenses.map((l) => licenseHealth(l, now));
  return {
    toProcess: ordersToProcess(d.orders).length,
    proofs: d.orders.filter((o) => o.status === 'preuve_envoyee').length,
    activeLicenses: health.filter((h) => h === 'vie' || h === 'active' || h === 'bientot').length,
    endingSoon: health.filter((h) => h === 'bientot').length,
    expired: health.filter((h) => h === 'expiree').length,
    revenueThisMonth: paid.filter((o) => Date.parse(o.confirmed_at ?? o.created_at) >= monthStart).reduce((s, o) => s + o.amount, 0),
    revenueTotal: paid.reduce((s, o) => s + o.amount, 0),
  };
}
