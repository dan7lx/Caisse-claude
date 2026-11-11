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
}

export interface Settings {
  restaurantName: string;
  currency: string;
  /** Taux de TVA en pourcentage, utilisé pour l'affichage de la TVA incluse. */
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
  /** Verrouillage automatique de la Gestion après N minutes sans activité (0 = jamais). */
  autoLockMinutes: number;
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
  servers: string[];
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
  orders: Order[];
  orderCounter: number;
  security: Security;
  license: License;
  paymentLinks: PaymentLinks;
  billing: Billing;
}

/** Données de la carte et de la salle, sans la sécurité ni la licence. */
export type RestaurantData = Pick<
  AppState,
  'settings' | 'servers' | 'tables' | 'categories' | 'items' | 'orders' | 'orderCounter'
>;

export type Role = 'serveur' | 'cuisine';

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
}
