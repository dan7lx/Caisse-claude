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
}

export interface MenuItem {
  id: string;
  name: string;
  /** Prix TTC en centimes. */
  price: number;
  categoryId: string;
  description: string;
  available: boolean;
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
  /** null pour une commande à emporter. */
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
  /** Serveur utilisant cet appareil. */
  currentServer: string;
}

export interface AppState {
  version: 1;
  settings: Settings;
  servers: string[];
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
  orders: Order[];
  orderCounter: number;
}

export type Updater = (state: AppState) => AppState;
