import { DEFAULT_PAYMENT_LINKS } from '../config';
import type {
  AppState,
  Category,
  DeviceState,
  MenuItem,
  RestaurantData,
  Settings,
  Station,
  Table,
} from './types';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Identifiant de licence lisible : « K7M2-9QXA ». */
export function newLicenseId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export const defaultSettings: Settings = {
  restaurantName: 'Le Comptoir',
  currency: '€',
  taxRate: 10,
  alertMinutes: 15,
  returnAfterSend: true,
};

export function createEmptyData(settings: Settings = defaultSettings, servers: string[] = ['Serveur 1']): RestaurantData {
  return {
    settings: { ...settings },
    servers: [...servers],
    tables: [],
    categories: [],
    items: [],
    orders: [],
    orderCounter: 0,
  };
}

/** Carte et salle de démonstration. */
export function createDemoData(): RestaurantData {
  const categories: Category[] = [];
  const items: MenuItem[] = [];

  const addCategory = (name: string, station: Station, color: string, entries: [string, number, string?][]) => {
    const category: Category = { id: uid(), name, station, color };
    categories.push(category);
    for (const [itemName, euros, description] of entries) {
      items.push({
        id: uid(),
        name: itemName,
        price: Math.round(euros * 100),
        categoryId: category.id,
        description: description ?? '',
        available: true,
      });
    }
  };

  addCategory('Entrées', 'cuisine', '#2F7D5B', [
    ['Salade César', 9.5],
    ['Soupe à l’oignon', 7.5],
    ['Œuf mayonnaise', 6],
    ['Planche mixte', 14, 'Charcuterie et fromages'],
  ]);
  addCategory('Plats', 'cuisine', '#B5502A', [
    ['Entrecôte frites', 22, 'Cuisson au choix'],
    ['Burger maison', 16.5],
    ['Pavé de saumon', 19],
    ['Risotto aux champignons', 17],
    ['Plat du jour', 14.5],
  ]);
  addCategory('Desserts', 'cuisine', '#A23B6B', [
    ['Mousse au chocolat', 7],
    ['Crème brûlée', 7.5],
    ['Café gourmand', 8.5],
    ['Tarte Tatin', 8],
  ]);
  addCategory('Softs', 'bar', '#2B5A8C', [
    ['Eau minérale 50cl', 4],
    ['Coca-Cola', 4.5],
    ['Jus d’orange pressé', 5.5],
    ['Limonade', 4],
  ]);
  addCategory('Vins & Bières', 'bar', '#6E2639', [
    ['Verre de rouge', 6],
    ['Verre de blanc', 6],
    ['Bière pression 25cl', 4.5],
    ['Bouteille de Bordeaux', 28],
  ]);
  addCategory('Cafés', 'bar', '#6B4F3A', [
    ['Expresso', 2.5],
    ['Café allongé', 2.8],
    ['Cappuccino', 4],
    ['Thé', 3.5],
  ]);

  const tables: Table[] = [];
  for (let i = 1; i <= 8; i++) {
    tables.push({ id: uid(), name: `${i}`, seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2, zone: 'Salle' });
  }
  for (let i = 9; i <= 12; i++) tables.push({ id: uid(), name: `${i}`, seats: 4, zone: 'Terrasse' });
  tables.push({ id: uid(), name: 'B1', seats: 2, zone: 'Bar' });
  tables.push({ id: uid(), name: 'B2', seats: 2, zone: 'Bar' });

  return { ...createEmptyData(), servers: ['Serveur 1', 'Serveur 2'], tables, categories, items };
}

export function createInitialState(): AppState {
  return {
    version: 2,
    ...createDemoData(),
    security: { managerPinHash: null, managerCanManage: true, managerCanCreateLobby: true },
    license: { id: newLicenseId(), plan: 'aucun', paidUntil: null, activatedAt: null },
    paymentLinks: { ...DEFAULT_PAYMENT_LINKS },
  };
}

export function createDevice(): DeviceState {
  return {
    version: 1,
    deviceId: uid(),
    currentServer: 'Serveur 1',
    role: 'serveur',
    lobby: null,
    server: null,
    reminderDismissedOn: null,
  };
}

/** Données de la version 1 de l'application (avant lobby et abonnement). */
interface LegacyState {
  version: 1;
  settings: Omit<Settings, 'returnAfterSend'> & { currentServer?: string };
  servers: string[];
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
  orders: AppState['orders'];
  orderCounter: number;
}

export function migrate(raw: unknown): { state: AppState; currentServer?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = (raw as { version?: number }).version;
  if (v === 2) return { state: raw as AppState };
  if (v === 1) {
    const old = raw as LegacyState;
    const { currentServer, ...settings } = old.settings;
    const base = createInitialState();
    return {
      currentServer,
      state: {
        ...base,
        settings: { ...defaultSettings, ...settings },
        servers: old.servers,
        tables: old.tables,
        categories: old.categories,
        items: old.items,
        orders: old.orders,
        orderCounter: old.orderCounter,
      },
    };
  }
  return null;
}
