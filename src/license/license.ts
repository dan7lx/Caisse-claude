import { ADMIN_CODE_HASH, CREATOR_CODE_HASH, DEMO_CODE_HASH, DEMO_HOURS, REMINDER_DAYS } from '../config';
import { normalizeKey } from './server';
import type { License } from '../store/types';
import { sha256 } from '../utils/sha256';

// Règles de l'abonnement :
// - mensuel : chaque clé activée donne 30 jours (cumulables) ; `paidUntil` = fin de validité.
//   Passé ce moment, l'application est bloquée immédiatement et le paiement est redemandé ;
// - rappel affiché à partir de REMINDER_DAYS jours avant l'échéance ;
// - à vie : jamais bloquée ;
// - démo : 24 h d'utilisation gratuite, une seule fois par licence, puis blocage.

export interface LicenseStatus {
  active: boolean;
  plan: License['plan'];
  /** Échéance (fin des 30 jours) pour l'abonnement mensuel. */
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

/* --------------------------- Codes ---------------------------- */

export function isDemoCode(code: string): boolean {
  return sha256(`caisse-resto:demo:${code.trim()}`) === DEMO_CODE_HASH;
}

export function isAdminCode(code: string): boolean {
  return sha256(`caisse-resto:admin:${code.trim()}`) === ADMIN_CODE_HASH;
}

/** Code créateur : seul le propriétaire de l'application peut effacer les données. */
export function isCreatorCode(code: string): boolean {
  return sha256(`caisse-resto:createur:${code.trim()}`) === CREATOR_CODE_HASH;
}

export function hashManagerPin(pin: string, licenseId: string): string {
  return sha256(`caisse-resto:gerant:${licenseId}:${pin.trim()}`);
}

export type CodeResult =
  | { kind: 'demo'; license: License; message: string }
  | { kind: 'key'; key: string }
  | { kind: 'invalid'; message: string };

/**
 * Interprète un code saisi dans l'écran d'abonnement.
 * - code démo : 24 h d'essai (une fois par licence) ;
 * - clé d'activation XXXX-XXXX-XXXX-XXXX : à faire valider par le serveur (licenseApi.redeem).
 * Les anciens codes (administrateur à vie, M202612-…, VIE-…) n'activent plus de licence :
 * seules les clés générées par le créateur sur son serveur le peuvent.
 */
export function applyCode(license: License, input: string, now = Date.now()): CodeResult {
  if (isDemoCode(input)) {
    const started = startDemo(license, now);
    if (!started) return { kind: 'invalid', message: 'Le mode démo a déjà été utilisé sur cette licence.' };
    return { kind: 'demo', license: started, message: `Mode démo activé : ${DEMO_HOURS} h d’utilisation gratuite.` };
  }
  const key = normalizeKey(input);
  if (key) return { kind: 'key', key };
  return { kind: 'invalid', message: 'Clé non reconnue. Format attendu : XXXX-XXXX-XXXX-XXXX.' };
}
