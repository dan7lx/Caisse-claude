import { DEFAULT_BILLING, PRICES, SUPPORT } from '../config';
import { rpc } from '../sync/backend';
import type { License, ServerConfig } from '../store/types';

// Client du serveur des paiements et licences (fonctions SQL « caisse_* » de supabase/schema.sql).
// Sans React Native : utilisable dans les tests.

export type PayPlan = 'mensuel' | 'vie';
export type OrderStatus = 'en_attente' | 'preuve_envoyee' | 'confirmee' | 'refusee' | 'annulee';

/** Coordonnées et prix affichés au client (modifiables par le créateur dans le tableau de bord). */
export interface BillingInfo {
  business_name: string;
  first_name: string;
  last_name: string;
  iban: string;
  holder: string;
  whatsapp: string;
  price_monthly: number;
  price_lifetime: number;
}

export interface PaymentOrder {
  id: string;
  number: number;
  reference: string;
  license_id: string;
  plan: PayPlan;
  amount: number;
  customer_name: string;
  restaurant_name: string;
  email: string;
  phone: string;
  status: OrderStatus;
  admin_note: string;
  created_at: string;
  proof_sent_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  key_hint: string | null;
  key_created_at: string | null;
  key_redeemed_at: string | null;
}

export interface ServerLicense {
  license_id: string;
  plan: 'aucun' | PayPlan;
  revoked: boolean;
  valid_until: number | null;
  customer_name: string;
  restaurant_name: string;
  email: string;
  phone: string;
  activations: number;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  orders: PaymentOrder[];
  licenses: ServerLicense[];
  billing: BillingInfo;
  now: number;
}

export interface CustomerInfo {
  name: string;
  restaurant: string;
  email: string;
  phone: string;
}

/** Commande en cours de ce client, mémorisée sur l'appareil (le jeton prouve qu'elle est à lui). */
export interface PendingPayment {
  orderId: string;
  token: string;
  plan: PayPlan;
}

/** Valeurs affichées tant que le serveur n'a pas répondu. */
export const FALLBACK_BILLING: BillingInfo = {
  business_name: 'Caisse Resto',
  first_name: 'R',
  last_name: 'Pereira',
  iban: DEFAULT_BILLING.iban,
  holder: DEFAULT_BILLING.holder,
  whatsapp: SUPPORT.whatsapp,
  price_monthly: PRICES.mensuel,
  price_lifetime: PRICES.vie,
};

/** Erreur « métier » renvoyée par une fonction d'administration ({ error }). */
export class AdminError extends Error {}

function unwrap<T extends object>(r: T | { error: string }): T {
  if ('error' in r && typeof r.error === 'string') throw new AdminError(r.error);
  return r as T;
}

export const licenseApi = {
  billing: (cfg: ServerConfig) => rpc<BillingInfo>(cfg, 'caisse_billing_public', {}),

  createOrder: (cfg: ServerConfig, licenseId: string, plan: PayPlan, c: CustomerInfo) =>
    rpc<{ order: PaymentOrder; token: string; billing: BillingInfo }>(cfg, 'caisse_create_payment_order', {
      p_license: licenseId,
      p_plan: plan,
      p_name: c.name,
      p_restaurant: c.restaurant,
      p_email: c.email,
      p_phone: c.phone,
    }),

  orderStatus: (cfg: ServerConfig, p: PendingPayment) =>
    rpc<{ order: PaymentOrder; key_ready: boolean; billing: BillingInfo }>(cfg, 'caisse_payment_order_status', {
      p_order: p.orderId,
      p_token: p.token,
    }),

  proofSent: (cfg: ServerConfig, p: PendingPayment) =>
    rpc<{ ok: boolean }>(cfg, 'caisse_payment_proof_sent', { p_order: p.orderId, p_token: p.token }),

  cancel: (cfg: ServerConfig, p: PendingPayment) =>
    rpc<{ ok: boolean }>(cfg, 'caisse_payment_cancel', { p_order: p.orderId, p_token: p.token }),

  redeem: (cfg: ServerConfig, licenseId: string, key: string) =>
    rpc<{ plan: PayPlan; valid_until: number | null }>(cfg, 'caisse_redeem_key', { p_license: licenseId, p_key: key }),

  check: (cfg: ServerConfig, licenseId: string) =>
    rpc<{ found: boolean; plan?: 'aucun' | PayPlan; revoked?: boolean; valid_until?: number | null }>(
      cfg,
      'caisse_license_check',
      { p_license: licenseId },
    ),
};

/** Fonctions du créateur : chaque appel exige le mot de passe du tableau de bord. */
export const adminApi = {
  login: async (cfg: ServerConfig, password: string) =>
    unwrap(await rpc<{ ok: true } | { error: string }>(cfg, 'caisse_admin_login', { p_password: password })),
  dashboard: async (cfg: ServerConfig, password: string) =>
    unwrap(await rpc<Dashboard | { error: string }>(cfg, 'caisse_admin_dashboard', { p_password: password })),
  confirm: async (cfg: ServerConfig, password: string, orderId: string, note: string) =>
    unwrap(await rpc<{ order: PaymentOrder } | { error: string }>(cfg, 'caisse_admin_confirm', { p_password: password, p_order: orderId, p_note: note })),
  reject: async (cfg: ServerConfig, password: string, orderId: string, note: string) =>
    unwrap(await rpc<{ order: PaymentOrder } | { error: string }>(cfg, 'caisse_admin_reject', { p_password: password, p_order: orderId, p_note: note })),
  generateKey: async (cfg: ServerConfig, password: string, orderId: string) =>
    unwrap(await rpc<{ key: string; order: PaymentOrder } | { error: string }>(cfg, 'caisse_admin_generate_key', { p_password: password, p_order: orderId })),
  licenseAction: async (cfg: ServerConfig, password: string, licenseId: string, action: 'revoke' | 'restore') =>
    unwrap(await rpc<{ ok: true } | { error: string }>(cfg, 'caisse_admin_license_action', { p_password: password, p_license: licenseId, p_action: action })),
  updateBilling: async (cfg: ServerConfig, password: string, billing: BillingInfo) =>
    unwrap(await rpc<{ billing: BillingInfo } | { error: string }>(cfg, 'caisse_admin_update_billing', { p_password: password, p_billing: billing })),
  changePassword: async (cfg: ServerConfig, password: string, next: string) =>
    unwrap(await rpc<{ ok: true } | { error: string }>(cfg, 'caisse_admin_change_password', { p_password: password, p_new: next })),
};

/* ----------------------------- Règles locales ----------------------------- */

/** Format d'une clé d'activation : XXXX-XXXX-XXXX-XXXX (lettres et chiffres sans ambiguïté). */
export function normalizeKey(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{16}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
}

/** Licence locale après activation d'une clé (réponse du serveur). */
export function applyRedeem(license: License, r: { plan: PayPlan; valid_until: number | null }, now = Date.now()): License {
  if (r.plan === 'vie') return { ...license, plan: 'vie', paidUntil: null, activatedAt: now };
  return { ...license, plan: 'mensuel', paidUntil: r.valid_until, activatedAt: now };
}

/**
 * Aligne la licence locale sur le serveur (source de vérité) : révocation, renouvellement, à vie.
 * Retourne null si rien ne change (ou si le serveur ne connaît pas cette licence).
 */
export function syncFromServer(
  license: License,
  r: { found: boolean; plan?: 'aucun' | PayPlan; valid_until?: number | null },
): License | null {
  if (!r.found || !r.plan) return null;
  if (r.plan === 'aucun') {
    if (license.plan === 'aucun') return null;
    return { ...license, plan: 'aucun', paidUntil: null };
  }
  const paidUntil = r.plan === 'vie' ? null : (r.valid_until ?? null);
  if (license.plan === r.plan && license.paidUntil === paidUntil) return null;
  return { ...license, plan: r.plan, paidUntil };
}

/** Lien WhatsApp vers le créateur avec la preuve de paiement préremplie. */
export function proofWhatsAppLink(billing: BillingInfo, order: PaymentOrder, formatAmount: (cents: number) => string): string {
  const plan = order.plan === 'vie' ? 'Licence à vie' : 'Abonnement mensuel';
  const lines = [
    'Bonjour, voici ma preuve de paiement pour Caisse Resto.',
    '',
    `Commande n° ${order.number}`,
    `Référence : ${order.reference}`,
    `Nom : ${order.customer_name}`,
    order.restaurant_name ? `Commerce : ${order.restaurant_name}` : null,
    `E-mail : ${order.email}`,
    `Formule : ${plan} (${formatAmount(order.amount)})`,
    `Licence : ${order.license_id}`,
    '',
    '📎 Je joins la capture d’écran de mon virement instantané.',
  ].filter((l): l is string => l !== null);
  return `https://wa.me/${billing.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/** Lien WhatsApp du créateur vers le client, avec la clé d'activation. */
export function keyWhatsAppLink(order: PaymentOrder, key: string): string {
  const plan = order.plan === 'vie' ? 'licence à vie' : 'abonnement mensuel (30 jours)';
  const text = [
    `Bonjour ${order.customer_name}, votre paiement (réf. ${order.reference}) est confirmé. Merci !`,
    '',
    `Votre clé d’activation pour l’${plan} :`,
    key,
    '',
    'Ouvrez Caisse Resto › Abonnement › « J’ai reçu ma clé », puis saisissez-la.',
  ].join('\n');
  return `https://wa.me/${order.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
}

/** IBAN lisible par groupes de 4. */
export const formatIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
