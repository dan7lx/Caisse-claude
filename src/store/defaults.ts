import type { AppState, Category, MenuItem, Station, Table } from './types';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const defaultSettings = {
  restaurantName: 'Mon Restaurant',
  currency: '€',
  taxRate: 10,
  alertMinutes: 15,
  currentServer: 'Serveur 1',
};

/** État vide : aucune table ni carte, réglages conservés. */
export function createEmptyState(base?: Pick<AppState, 'settings' | 'servers'>): AppState {
  return {
    version: 1,
    settings: base?.settings ?? { ...defaultSettings },
    servers: base?.servers ?? [defaultSettings.currentServer],
    tables: [],
    categories: [],
    items: [],
    orders: [],
    orderCounter: 0,
  };
}

/** Données de démonstration pour démarrer rapidement. */
export function createDemoState(): AppState {
  const categories: Category[] = [];
  const items: MenuItem[] = [];

  const addCategory = (
    name: string,
    station: Station,
    color: string,
    entries: [string, number, string?][],
  ) => {
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

  addCategory('Entrées', 'cuisine', '#22C55E', [
    ['Salade César', 9.5],
    ['Soupe à l’oignon', 7.5],
    ['Œuf mayonnaise', 6],
    ['Planche mixte', 14, 'Charcuterie et fromages'],
  ]);
  addCategory('Plats', 'cuisine', '#F97316', [
    ['Entrecôte frites', 22, 'Cuisson au choix'],
    ['Burger maison', 16.5],
    ['Pavé de saumon', 19],
    ['Risotto aux champignons', 17],
    ['Plat du jour', 14.5],
  ]);
  addCategory('Desserts', 'cuisine', '#EC4899', [
    ['Mousse au chocolat', 7],
    ['Crème brûlée', 7.5],
    ['Café gourmand', 8.5],
    ['Tarte Tatin', 8],
  ]);
  addCategory('Softs', 'bar', '#3B82F6', [
    ['Eau minérale 50cl', 4],
    ['Coca-Cola', 4.5],
    ['Jus d’orange pressé', 5.5],
    ['Limonade', 4],
  ]);
  addCategory('Vins & Bières', 'bar', '#8B5CF6', [
    ['Verre de rouge', 6],
    ['Verre de blanc', 6],
    ['Bière pression 25cl', 4.5],
    ['Bouteille de Bordeaux', 28],
  ]);
  addCategory('Cafés', 'bar', '#6B7280', [
    ['Expresso', 2.5],
    ['Café allongé', 2.8],
    ['Cappuccino', 4],
    ['Thé', 3.5],
  ]);

  const tables: Table[] = [];
  for (let i = 1; i <= 8; i++) {
    tables.push({ id: uid(), name: `T${i}`, seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2, zone: 'Salle' });
  }
  for (let i = 9; i <= 12; i++) {
    tables.push({ id: uid(), name: `T${i}`, seats: 4, zone: 'Terrasse' });
  }
  tables.push({ id: uid(), name: 'Bar 1', seats: 2, zone: 'Bar' });
  tables.push({ id: uid(), name: 'Bar 2', seats: 2, zone: 'Bar' });

  return {
    ...createEmptyState(),
    servers: ['Serveur 1', 'Serveur 2'],
    tables,
    categories,
    items,
  };
}
