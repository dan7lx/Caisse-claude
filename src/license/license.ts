import { ADMIN_CODE_HASH, DEMO_CODE_HASH, DEMO_HOURS, LICENSE_SALT, REMINDER_DAYS } from '../config';
import type { License } from '../store/types';
import { sha256 } from '../utils/sha256';

// Règles de l'abonnement :
// - mensuel : chaque mois est dû le 1er. Payer le mois M rend l'application active
//   jusqu'au 1er du mois M+1 à 00:00 ; passé ce moment, elle est bloquée immédiatement ;
// - rappel affiché à partir de REMINDER_DAYS jours avant l'échéance ;
// - à vie : jamais bloquée ;
// - démo : 24 h d'utilisation gratuite, une seule fois par licence, puis blocage.

export interface LicenseStatus {
  active: boolean;
  plan: License['plan'];
  /** Échéance (1er du mois, 00:00) pour l'abonnement mensuel. */
  dueDate: number | null;
  /** Début de la période de rappel (échéance − 5 jours). */
  reminderStart: number | null;
  inReminderWindow: boolean;
  /** Jours restants avant l'échéance (arrondi au jour supérieur). */
  daysLeft: number | null;
  /** Mode démo en cours (et aucune formule payée). */
  demo: boolean;
  demoEndsAt: number | null;
  /** La démo a déjà été utilisée sur cette licence. */
  demoUsed: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

export function firstOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export const DEMO_MS = DEMO_HOURS * 60 * 60 * 1000;

export function licenseStatus(license: License, now = Date.now()): LicenseStatus {
  const demoStartedAt = license.demoStartedAt ?? null;
  const demoEndsAt = demoStartedAt !== null ? demoStartedAt + DEMO_MS : null;
  const demoUsed = demoStartedAt !== null;
  if (license.plan === 'vie') {
    return {
      active: true,
      plan: 'vie',
      dueDate: null,
      reminderStart: null,
      inReminderWindow: false,
      daysLeft: null,
      demo: false,
      demoEndsAt,
      demoUsed,
    };
  }
  const due = license.plan === 'mensuel' ? license.paidUntil : null;
  const paid = due !== null && now < due;
  const demo = !paid && demoEndsAt !== null && now >= (demoStartedAt ?? 0) && now < demoEndsAt;
  const reminderStart = due !== null ? addDays(due, -REMINDER_DAYS) : null;
  return {
    active: paid || demo,
    plan: license.plan,
    dueDate: due,
    reminderStart,
    inReminderWindow: paid && reminderStart !== null && now >= reminderStart,
    daysLeft: due !== null ? Math.max(0, Math.ceil((due - now) / DAY)) : null,
    demo,
    demoEndsAt,
    demoUsed,
  };
}

/** Démarre le mode démo (une seule fois par licence). */
export function startDemo(license: License, now = Date.now()): License | null {
  if (license.demoStartedAt !== null && license.demoStartedAt !== undefined) return null;
  return { ...license, demoStartedAt: now };
}

/** Temps restant au format « 23:59:12 ». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Prolonge l'abonnement mensuel d'un mois (à partir de l'échéance, ou du mois en cours si expiré). */
export function extendOneMonth(license: License, now = Date.now()): License {
  const d = new Date(now);
  const base =
    license.plan === 'mensuel' && license.paidUntil && license.paidUntil > now
      ? new Date(license.paidUntil)
      : new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    ...license,
    plan: 'mensuel',
    paidUntil: firstOfMonth(base.getFullYear(), base.getMonth() + 1),
    activatedAt: now,
  };
}

/** Rend le mois « AAAAMM » payé (actif jusqu'au 1er du mois suivant). */
export function payMonth(license: License, yyyymm: string, now = Date.now()): License {
  const year = parseInt(yyyymm.slice(0, 4), 10);
  const month = parseInt(yyyymm.slice(4, 6), 10) - 1;
  const until = firstOfMonth(year, month + 1);
  if (license.plan === 'vie') return license;
  return {
    ...license,
    plan: 'mensuel',
    paidUntil: Math.max(license.plan === 'mensuel' ? (license.paidUntil ?? 0) : 0, until),
    activatedAt: now,
  };
}

export function lifetime(license: License, now = Date.now()): License {
  return { ...license, plan: 'vie', paidUntil: null, activatedAt: now };
}

export function revoke(license: License): License {
  return { ...license, plan: 'aucun', paidUntil: null, activatedAt: null, demoStartedAt: license.demoStartedAt ? 0 : null };
}

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

/* --------------------------- Codes ---------------------------- */

const clean = (code: string) => code.toUpperCase().replace(/[^A-Z0-9-]/g, '');

export function isDemoCode(code: string): boolean {
  return sha256(`caisse-resto:demo:${code.trim()}`) === DEMO_CODE_HASH;
}

export function isAdminCode(code: string): boolean {
  return sha256(`caisse-resto:admin:${code.trim()}`) === ADMIN_CODE_HASH;
}

export function hashManagerPin(pin: string, licenseId: string): string {
  return sha256(`caisse-resto:gerant:${licenseId}:${pin.trim()}`);
}

function signature(licenseId: string, payload: string): string {
  return sha256(`${LICENSE_SALT}|${clean(licenseId)}|${payload}`).slice(0, 6).toUpperCase();
}

export type ActivationKind = { plan: 'mensuel'; month: string } | { plan: 'vie' };

/**
 * Code d'activation à donner à un client après paiement.
 * Mensuel : « M202612-3FA9C1 » (mois de décembre 2026). À vie : « VIE-81B0D2 ».
 */
export function makeActivationCode(licenseId: string, kind: ActivationKind): string {
  const payload = kind.plan === 'vie' ? 'VIE' : `M${kind.month}`;
  return `${payload}-${signature(licenseId, payload)}`;
}

export type CodeResult =
  | { kind: 'admin'; license: License }
  | { kind: 'demo'; license: License; message: string }
  | { kind: 'activation'; license: License; message: string }
  | { kind: 'invalid'; message: string };

/** Interprète un code saisi dans l'écran d'abonnement. */
export function applyCode(license: License, input: string, now = Date.now()): CodeResult {
  if (isAdminCode(input)) return { kind: 'admin', license: lifetime(license, now) };
  if (isDemoCode(input)) {
    const started = startDemo(license, now);
    if (!started) return { kind: 'invalid', message: 'Le mode démo a déjà été utilisé sur cette licence.' };
    return { kind: 'demo', license: started, message: `Mode démo activé : ${DEMO_HOURS} h d’utilisation gratuite.` };
  }
  const code = clean(input);
  const match = /^(VIE|M(\d{6}))-([A-Z0-9]{6})$/.exec(code);
  if (!match) return { kind: 'invalid', message: 'Code non reconnu.' };
  const [, payload, month, sig] = match;
  if (signature(license.id, payload) !== sig) {
    return { kind: 'invalid', message: 'Ce code ne correspond pas à cette licence.' };
  }
  if (payload === 'VIE') {
    return { kind: 'activation', license: lifetime(license, now), message: 'Licence à vie activée.' };
  }
  const m = parseInt(month.slice(4, 6), 10);
  if (m < 1 || m > 12) return { kind: 'invalid', message: 'Mois invalide.' };
  const next = payMonth(license, month, now);
  return {
    kind: 'activation',
    license: next,
    message: `Abonnement payé jusqu’au ${new Date(next.paidUntil ?? now).toLocaleDateString('fr-FR')}.`,
  };
}
