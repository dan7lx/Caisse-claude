import type { Billing, PaymentLinks, ServerConfig } from './store/types';

/** Tarifs des abonnements, en centimes. */
export const PRICES = { mensuel: 4599, vie: 59999 } as const;

/** Nombre de jours avant le 1er du mois où le rappel de paiement s'affiche. */
export const REMINDER_DAYS = 5;

/**
 * Liens de paiement par défaut (ex. liens Stripe « Payment Link »).
 * Modifiables aussi dans Gestion › Administration.
 */
export const DEFAULT_PAYMENT_LINKS: PaymentLinks = { mensuel: '', vie: '' };

/**
 * Empreinte SHA-256 du code administrateur (le code lui-même n'est pas stocké).
 * Voir src/license/license.ts › isAdminCode.
 */
export const ADMIN_CODE_HASH = '6dcba733a7992a1a5e17284f6cfa6fe9822eaaa4a7fa49eb45d8e54818978df2';

/** Empreinte SHA-256 du code du mode démo (voir license.ts › isDemoCode). */
export const DEMO_CODE_HASH = '7a17432dc32c35040f17cf39091772c12e167072d63a9ba7515e2cc52320f0a5';

/** Durée du mode démo, en heures. */
export const DEMO_HOURS = 24;

/** Coordonnées bancaires affichées au moment du paiement (modifiables dans Administration). */
export const DEFAULT_BILLING: Billing = { iban: 'BE71650156242169', holder: 'R Pereira' };

/** Assistance : WhatsApp et téléphone, disponibles 24 h/24. */
export const SUPPORT = {
  phone: '+32465538869',
  phoneLabel: '+32 465 53 88 69',
  whatsapp: '32465538869',
};

/** Sel des codes d'activation générés par l'administrateur. */
export const LICENSE_SALT = 'caisse-resto:licence:v1:7f3a9c2e';

/**
 * Serveur de synchronisation (Supabase) intégré au build, optionnel.
 * Sinon, le gérant le renseigne dans l'écran Équipe.
 */
export const BUILT_IN_SERVER: ServerConfig | null =
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY
    ? { url: process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey: process.env.EXPO_PUBLIC_SUPABASE_KEY }
    : null;
