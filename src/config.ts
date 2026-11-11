import type { Billing, PaymentLinks, ServerConfig } from './store/types';

/** Tarifs des abonnements, en centimes. */
export const PRICES = { mensuel: 4599, vie: 59999 } as const;

/** Taux de TVA proposés à l'encaissement (Belgique), ajoutés au montant. */
export const VAT_RATES = [0, 6, 12, 21] as const;

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

/**
 * Empreinte SHA-256 du code créateur (réservé au propriétaire de l'application) : il débloque la
 * suppression des données (partir de zéro, recharger la démo, effacer l'historique des tickets).
 * Voir license.ts › isCreatorCode. Le code lui-même n'est jamais écrit dans le dépôt.
 */
export const CREATOR_CODE_HASH = '1ce0a2cc3634e3178b0623b89401c4e28910c8ce4de10881763e5453fa33096e';

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

/**
 * Serveur de synchronisation (Supabase) intégré au build, optionnel.
 * Sinon, le gérant le renseigne dans l'écran Équipe.
 */
export const BUILT_IN_SERVER: ServerConfig | null =
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY
    ? { url: process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey: process.env.EXPO_PUBLIC_SUPABASE_KEY }
    : null;

/**
 * Serveur des paiements et des licences (Supabase du créateur, schéma supabase/schema.sql).
 * Défini au moment du build : EXPO_PUBLIC_LICENSE_URL / EXPO_PUBLIC_LICENSE_KEY,
 * sinon le même serveur que le lobby (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY).
 * Seule la clé PUBLIQUE (publishable / anon) est permise ici, jamais la clé secrète.
 */
export const LICENSE_SERVER: ServerConfig | null =
  process.env.EXPO_PUBLIC_LICENSE_URL && process.env.EXPO_PUBLIC_LICENSE_KEY
    ? { url: process.env.EXPO_PUBLIC_LICENSE_URL, anonKey: process.env.EXPO_PUBLIC_LICENSE_KEY }
    : BUILT_IN_SERVER;

/** Durée d'un abonnement mensuel, en jours (à partir de l'activation de la clé). */
export const MONTHLY_DAYS = 30;
