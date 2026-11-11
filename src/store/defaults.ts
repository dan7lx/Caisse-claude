import { DEFAULT_BILLING, DEFAULT_PAYMENT_LINKS } from '../config';
import type {
  AppState,
  Category,
  DeviceState,
  MenuItem,
  RestaurantData,
  Role,
  Settings,
  StaffMember,
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

/** Les 14 allergènes à déclarer (règlement européen INCO). */
export const ALLERGENS = [
  'Gluten',
  'Crustacés',
  'Œufs',
  'Poissons',
  'Arachides',
  'Soja',
  'Lait',
  'Fruits à coque',
  'Céleri',
  'Moutarde',
  'Sésame',
  'Sulfites',
  'Lupin',
  'Mollusques',
];

export const COOKING_CHOICES = ['Bleu', 'Saignant', 'À point', 'Bien cuit'];

export const defaultSettings: Settings = {
  restaurantName: 'Le Comptoir',
  currency: '€',
  taxRate: 10,
  alertMinutes: 15,
  returnAfterSend: true,
  logo: null,
  slogan: '',
  address: '',
  phone: '',
  autoLockMinutes: 10,
  vatNumber: '',
  receiptFooter: 'Merci de votre visite et à bientôt !',
};

export function newStaff(name: string, role: Role = 'serveur'): StaffMember {
  return { id: uid(), name, role, pinHash: null, pinLength: null };
}

export function createEmptyData(
  settings: Settings = defaultSettings,
  staff: StaffMember[] = [newStaff('Serveur 1')],
): RestaurantData {
  return {
    settings: { ...settings },
    staff: staff.map((m) => ({ ...m })),
    tables: [],
    categories: [],
    items: [],
    orders: [],
    orderCounter: 0,
  };
}

type Entry = [name: string, euros: number, emoji: string, extra?: { description?: string; choices?: string[]; allergens?: string[] }];

/** Carte et salle de démonstration. */
export function createDemoData(): RestaurantData {
  const categories: Category[] = [];
  const items: MenuItem[] = [];

  const addCategory = (name: string, station: Station, color: string, emoji: string, entries: Entry[]) => {
    const category: Category = { id: uid(), name, station, color, emoji };
    categories.push(category);
    for (const [itemName, euros, itemEmoji, extra] of entries) {
      items.push({
        id: uid(),
        name: itemName,
        price: Math.round(euros * 100),
        categoryId: category.id,
        description: extra?.description ?? '',
        available: true,
        emoji: itemEmoji,
        choices: extra?.choices ?? [],
        allergens: extra?.allergens ?? [],
      });
    }
  };

  addCategory('Entrées', 'cuisine', '#2F7D5B', '🥗', [
    ['Salade César', 9.5, '🥗', { allergens: ['Gluten', 'Œufs', 'Lait', 'Poissons'] }],
    ['Soupe à l’oignon', 7.5, '🍲', { allergens: ['Gluten', 'Lait'] }],
    ['Œuf mayonnaise', 6, '🥚', { allergens: ['Œufs', 'Moutarde'] }],
    ['Planche mixte', 14, '🧀', { description: 'Charcuterie et fromages', allergens: ['Lait'] }],
  ]);
  addCategory('Plats', 'cuisine', '#B5502A', '🍽️', [
    ['Entrecôte frites', 22, '🥩', { description: 'Sauce au poivre', choices: COOKING_CHOICES }],
    ['Burger maison', 16.5, '🍔', { choices: ['Saignant', 'À point', 'Bien cuit'], allergens: ['Gluten', 'Lait', 'Sésame'] }],
    ['Pavé de saumon', 19, '🐟', { allergens: ['Poissons'] }],
    ['Risotto aux champignons', 17, '🍄', { allergens: ['Lait'] }],
    ['Plat du jour', 14.5, '🥘'],
  ]);
  addCategory('Desserts', 'cuisine', '#A23B6B', '🍰', [
    ['Mousse au chocolat', 7, '🍫', { allergens: ['Œufs', 'Lait'] }],
    ['Crème brûlée', 7.5, '🍮', { allergens: ['Œufs', 'Lait'] }],
    ['Café gourmand', 8.5, '☕', { allergens: ['Gluten', 'Lait', 'Œufs'] }],
    ['Tarte Tatin', 8, '🥧', { allergens: ['Gluten', 'Lait', 'Œufs'] }],
  ]);
  addCategory('Softs', 'bar', '#2B5A8C', '🥤', [
    ['Eau minérale 50cl', 4, '💧', { choices: ['Plate', 'Pétillante'] }],
    ['Coca-Cola', 4.5, '🥤', { choices: ['Normal', 'Zéro'] }],
    ['Jus d’orange pressé', 5.5, '🍊'],
    ['Limonade', 4, '🍋'],
  ]);
  addCategory('Vins & Bières', 'bar', '#6E2639', '🍷', [
    ['Verre de rouge', 6, '🍷', { allergens: ['Sulfites'] }],
    ['Verre de blanc', 6, '🥂', { allergens: ['Sulfites'] }],
    ['Bière pression 25cl', 4.5, '🍺', { allergens: ['Gluten'] }],
    ['Bouteille de Bordeaux', 28, '🍾', { allergens: ['Sulfites'] }],
  ]);
  addCategory('Cafés', 'bar', '#6B4F3A', '☕', [
    ['Expresso', 2.5, '☕'],
    ['Café allongé', 2.8, '☕'],
    ['Cappuccino', 4, '☕', { allergens: ['Lait'] }],
    ['Thé', 3.5, '🍵', { choices: ['Vert', 'Noir', 'Infusion'] }],
  ]);

  const tables: Table[] = [];
  for (let i = 1; i <= 8; i++) {
    tables.push({ id: uid(), name: `${i}`, seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2, zone: 'Salle' });
  }
  for (let i = 9; i <= 12; i++) tables.push({ id: uid(), name: `${i}`, seats: 4, zone: 'Terrasse' });
  tables.push({ id: uid(), name: 'B1', seats: 2, zone: 'Bar' });
  tables.push({ id: uid(), name: 'B2', seats: 2, zone: 'Bar' });

  const staff = [newStaff('Serveur 1'), newStaff('Serveur 2'), newStaff('Chef', 'cuisine'), newStaff('Barman', 'bar')];
  return { ...createEmptyData(), staff, tables, categories, items };
}

export function createInitialState(): AppState {
  return {
    version: 2,
    ...createDemoData(),
    security: { managerPinHash: null, managerPinLength: null, managerCanManage: true, managerCanCreateLobby: true },
    license: { id: newLicenseId(), plan: 'aucun', paidUntil: null, activatedAt: null, demoStartedAt: null },
    paymentLinks: { ...DEFAULT_PAYMENT_LINKS },
    billing: { ...DEFAULT_BILLING },
    closures: [],
  };
}

/** Emoji par défaut d'une catégorie selon son nom et son poste. */
function guessCategoryEmoji(name: string, station: Station): string {
  const n = name.toLowerCase();
  if (/entr|salade|starter/.test(n)) return '🥗';
  if (/dessert|sucr|glace/.test(n)) return '🍰';
  if (/vin|bi[eè]re|alcool|ap[ée]ritif/.test(n)) return '🍷';
  if (/caf|th[ée]|chaud/.test(n)) return '☕';
  if (/cocktail/.test(n)) return '🍸';
  if (/pizza/.test(n)) return '🍕';
  return station === 'bar' ? '🥤' : '🍽️';
}

/** Complète les données enregistrées par une version précédente (champs ajoutés depuis). */
export function normalize(raw: AppState): AppState {
  const base = createInitialState();
  const legacyServers = (raw as unknown as { servers?: string[] }).servers;
  const staff: StaffMember[] = raw.staff ?? (legacyServers ?? ['Serveur 1']).map((name) => newStaff(name));
  const { servers: _servers, ...rest } = raw as AppState & { servers?: string[] };
  return {
    ...rest,
    staff: staff.map((m) => ({ ...m, role: m.role ?? 'serveur', pinHash: m.pinHash ?? null, pinLength: m.pinLength ?? null })),
    closures: raw.closures ?? [],
    orders: raw.orders.map((o) => ({ ...o, tip: o.tip ?? 0, discountPct: o.discountPct ?? 0 })),
    settings: { ...defaultSettings, ...raw.settings },
    categories: raw.categories.map((c) => ({ ...c, emoji: c.emoji ?? guessCategoryEmoji(c.name, c.station) })),
    items: raw.items.map((i) => ({ ...i, emoji: i.emoji ?? '', choices: i.choices ?? [], allergens: i.allergens ?? [] })),
    security: { ...base.security, ...raw.security, managerPinLength: raw.security?.managerPinLength ?? null },
    license: { ...base.license, ...raw.license, demoStartedAt: raw.license?.demoStartedAt ?? null },
    paymentLinks: { ...base.paymentLinks, ...raw.paymentLinks },
    billing: { ...base.billing, ...(raw.billing ?? {}) },
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
    printer: { paperWidth: 58, autoPrintReceipt: false, autoPrintKitchen: false, asciiOnly: false },
    pinFailures: 0,
    pinLockedUntil: null,
  };
}

/** Données de la version 1 de l'application (avant lobby et abonnement). */
interface LegacyState {
  version: 1;
  settings: Partial<Settings> & { currentServer?: string };
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
  if (v === 2) return { state: normalize(raw as AppState) };
  if (v === 1) {
    const old = raw as LegacyState;
    const { currentServer, ...settings } = old.settings;
    const base = createInitialState();
    return {
      currentServer,
      state: normalize({
        ...base,
        settings: { ...defaultSettings, ...settings },
        staff: old.servers.map((name) => newStaff(name)),
        tables: old.tables,
        categories: old.categories,
        items: old.items,
        orders: old.orders,
        orderCounter: old.orderCounter,
      }),
    };
  }
  return null;
}
