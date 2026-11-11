import type { PendingPayment } from '../license/server';

export type Station = 'cuisine' | 'bar';

/** Cycle de vie d'une ligne de commande. */
export type LineStatus = 'brouillon' | 'envoye' | 'en_preparation' | 'pret' | 'servi';

export type PaymentMethod = 'especes' | 'carte' | 'autre';

export type OrderStatus = 'ouverte' | 'payee' | 'annulee';

export interface Category {
  id: string;
  name: string;
  station: Station;
  color: string;
  /** Emoji affiché en 3D (ex. « 🥗 »). */
  emoji: string;
}

export interface MenuItem {
  id: string;
  name: string;
  /** Prix TTC en centimes. */
  price: number;
  categoryId: string;
  description: string;
  available: boolean;
  /** Emoji propre à l'article ('' = emoji de la catégorie). */
  emoji: string;
  /** Choix à faire à la commande (ex. cuissons). Vide = pas de choix. */
  choices: string[];
  allergens: string[];
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  zone: string;
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note: string;
  station: Station;
  status: LineStatus;
  /** Numéro d'envoi en cuisine/bar (null tant que la ligne n'est pas envoyée). */
  batch: number | null;
  sentAt: number | null;
  readyAt: number | null;
}

export interface Order {
  id: string;
  number: number;
  /** null pour une commande sans table. */
  tableId: string | null;
  label: string;
  server: string;
  guests: number;
  lines: OrderLine[];
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  payment: PaymentMethod | null;
  batchCount: number;
  /** Remise en pourcentage appliquée à l'encaissement. */
  discountPct?: number;
  /** Pourboire en centimes (en plus du total). */
  tip?: number;
  /** Espèces reçues (pour calculer la monnaie rendue). */
  cashReceived?: number | null;
  /**
   * Taux de TVA choisi à l'encaissement (0, 6, 12 ou 21 %), ajouté au montant.
   * Absent sur les commandes encaissées avant ce choix : leur TVA était incluse dans les prix.
   */
  vatRate?: number | null;
}

export interface Settings {
  restaurantName: string;
  currency: string;
  /**
   * Ancien taux de TVA « incluse » (plus modifiable) : sert seulement à afficher la TVA
   * des commandes et clôtures antérieures au choix de TVA à l'encaissement.
   */
  taxRate: number;
  /** Délai (minutes) après lequel un ticket cuisine/bar passe en alerte. */
  alertMinutes: number;
  /** Revenir au plan de salle après « Envoyer ». */
  returnAfterSend: boolean;
  /** Logo du commerce (image en data URI), ou null. */
  logo: string | null;
  slogan: string;
  address: string;
  phone: string;
  /**
   * Verrouillage de la Gestion : après N minutes sans activité (0 = jamais),
   * ou -1 = automatique, dès qu'on quitte la Gestion.
   */
  autoLockMinutes: number;
  /** Numéro de TVA de l'entreprise (imprimé sur les tickets). */
  vatNumber: string;
  /** Message en bas du ticket de caisse. */
  receiptFooter: string;
}

export interface Security {
  /** Empreinte du code gérant (null tant qu'il n'est pas créé). */
  managerPinHash: string | null;
  /** Nombre de chiffres du code gérant (validation automatique). */
  managerPinLength: number | null;
  /** L'administrateur peut retirer au gérant l'accès à la Gestion… */
  managerCanManage: boolean;
  /** … ou la création de lobby. */
  managerCanCreateLobby: boolean;
}

export type Role = 'serveur' | 'cuisine' | 'bar';

/** Membre de l'équipe : son poste et son code personnel (empreinte). */
export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  pinHash: string | null;
  pinLength: number | null;
}

/** Clôture journalière (« Z de caisse »), faite automatiquement à minuit. */
export interface DailyClosure {
  /** Jour clôturé, AAAA-MM-JJ (heure locale). */
  date: string;
  closedAt: number;
  count: number;
  cancelled: number;
  guests: number;
  /** Chiffre d'affaires TTC (remises déduites, hors pourboires). */
  revenue: number;
  /** TVA ajoutée à l'encaissement, par taux (« 21 » → montant). Absent sur les anciennes clôtures. */
  vatByRate?: Record<string, number>;
  tips: number;
  discounts: number;
  byPayment: Record<PaymentMethod, number>;
  topItems: { name: string; qty: number; total: number }[];
}

export type Plan = 'aucun' | 'mensuel' | 'vie';

export interface License {
  /** Identifiant de la licence du restaurant (sert aux codes d'activation). */
  id: string;
  plan: Plan;
  /** Abonnement mensuel : payé jusqu'à cette date (1er du mois suivant, 00:00). */
  paidUntil: number | null;
  activatedAt: number | null;
  /** Début du mode démo de 24 h (null = jamais utilisé). */
  demoStartedAt: number | null;
}

export interface PaymentLinks {
  mensuel: string;
  vie: string;
}

/** Coordonnées du virement affichées au moment du paiement. */
export interface Billing {
  iban: string;
  holder: string;
}

/** Données du restaurant, partagées entre tous les appareils d'un lobby. */
export interface AppState {
  version: 2;
  settings: Settings;
  staff: StaffMember[];
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
  orders: Order[];
  orderCounter: number;
  security: Security;
  license: License;
  paymentLinks: PaymentLinks;
  billing: Billing;
  closures: DailyClosure[];
}

/** Données de la carte et de la salle, sans la sécurité ni la licence. */
export type RestaurantData = Pick<
  AppState,
  'settings' | 'staff' | 'tables' | 'categories' | 'items' | 'orders' | 'orderCounter'
>;

export interface ServerConfig {
  url: string;
  anonKey: string;
}

export interface LobbyLink {
  lobbyId: string;
  code: string;
  server: ServerConfig;
}

/** Réglages propres à cet appareil (jamais partagés). */
export interface DeviceState {
  version: 1;
  deviceId: string;
  currentServer: string;
  role: Role;
  lobby: LobbyLink | null;
  /** Dernier serveur de synchronisation utilisé (pour créer / rejoindre). */
  server: ServerConfig | null;
  /** Date (AAAA-MM-JJ) du dernier rappel de paiement fermé. */
  reminderDismissedOn: string | null;
  /** Essais de code gérant ratés d'affilée, et blocage temporaire qui en découle. */
  pinFailures: number;
  pinLockedUntil: number | null;
  /** Commande de paiement en cours de ce client (identifiant + jeton secret de suivi). */
  pendingPayment: PendingPayment | null;
}

