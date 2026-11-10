import { createDemoState, createEmptyState, uid } from './defaults';
import type {
  AppState,
  Category,
  LineStatus,
  MenuItem,
  Order,
  PaymentMethod,
  Settings,
  Station,
  Table,
  Updater,
} from './types';

// Toutes les actions sont des fonctions pures (état -> nouvel état),
// ce qui les rend faciles à tester et à combiner.

function mapOrder(state: AppState, orderId: string, fn: (order: Order) => Order): AppState {
  return { ...state, orders: state.orders.map((o) => (o.id === orderId ? fn(o) : o)) };
}

function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some((x) => x.id === entry.id)
    ? list.map((x) => (x.id === entry.id ? entry : x))
    : [...list, entry];
}

export function compose(...updaters: Updater[]): Updater {
  return (state) => updaters.reduce((s, u) => u(s), state);
}

/* ---------------------------- Commandes ---------------------------- */

export const createOrder =
  (id: string, tableId: string | null, label: string): Updater =>
  (s) => {
    if (tableId && s.orders.some((o) => o.status === 'ouverte' && o.tableId === tableId)) return s;
    const number = s.orderCounter + 1;
    const order: Order = {
      id,
      number,
      tableId,
      label,
      server: s.settings.currentServer,
      guests: tableId ? (s.tables.find((t) => t.id === tableId)?.seats ?? 1) : 1,
      lines: [],
      status: 'ouverte',
      createdAt: Date.now(),
      paidAt: null,
      payment: null,
      batchCount: 0,
    };
    return { ...s, orderCounter: number, orders: [...s.orders, order] };
  };

export const addItem =
  (orderId: string, item: MenuItem, station: Station): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => {
      const existing = o.lines.find((l) => l.status === 'brouillon' && l.itemId === item.id && !l.note);
      if (existing) {
        return { ...o, lines: o.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) };
      }
      return {
        ...o,
        lines: [
          ...o.lines,
          {
            id: uid(),
            itemId: item.id,
            name: item.name,
            unitPrice: item.price,
            qty: 1,
            note: '',
            station,
            status: 'brouillon',
            batch: null,
            sentAt: null,
            readyAt: null,
          },
        ],
      };
    });

/** Modifie la quantité d'une ligne non envoyée ; la supprime si elle tombe à 0. */
export const changeQty =
  (orderId: string, lineId: string, delta: number): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => ({
      ...o,
      lines: o.lines
        .map((l) => (l.id === lineId && l.status === 'brouillon' ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    }));

export const setLineNote =
  (orderId: string, lineId: string, note: string): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => ({
      ...o,
      lines: o.lines.map((l) => (l.id === lineId ? { ...l, note: note.trim() } : l)),
    }));

export const removeLine =
  (orderId: string, lineId: string): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => ({ ...o, lines: o.lines.filter((l) => l.id !== lineId) }));

export const setGuests =
  (orderId: string, guests: number): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => ({ ...o, guests: Math.max(0, guests) }));

/** Envoie toutes les lignes en brouillon vers la cuisine / le bar (un nouvel « envoi »). */
export const sendOrder =
  (orderId: string): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => {
      if (!o.lines.some((l) => l.status === 'brouillon')) return o;
      const batch = o.batchCount + 1;
      const now = Date.now();
      return {
        ...o,
        batchCount: batch,
        lines: o.lines.map((l) =>
          l.status === 'brouillon' ? { ...l, status: 'envoye', batch, sentAt: now } : l,
        ),
      };
    });

export const setLinesStatus =
  (orderId: string, lineIds: string[], status: LineStatus): Updater =>
  (s) =>
    mapOrder(s, orderId, (o) => ({
      ...o,
      lines: o.lines.map((l) => {
        if (!lineIds.includes(l.id) || l.status === 'brouillon') return l;
        const readyAt =
          status === 'pret' ? Date.now() : status === 'servi' ? (l.readyAt ?? Date.now()) : null;
        return { ...l, status, readyAt };
      }),
    }));

export const payOrder =
  (orderId: string, payment: PaymentMethod): Updater =>
  (s) =>
    mapOrder(compose(sendOrder(orderId))(s), orderId, (o) => ({
      ...o,
      status: 'payee',
      paidAt: Date.now(),
      payment,
    }));

export const cancelOrder =
  (orderId: string): Updater =>
  (s) => {
    const order = s.orders.find((o) => o.id === orderId);
    if (!order) return s;
    // Une commande dont rien n'a été envoyé est simplement supprimée.
    if (order.lines.every((l) => l.status === 'brouillon')) {
      return { ...s, orders: s.orders.filter((o) => o.id !== orderId) };
    }
    return mapOrder(s, orderId, (o) => ({ ...o, status: 'annulee', paidAt: Date.now() }));
  };

/** Supprime une commande ouverte restée vide (table ouverte puis quittée sans rien commander). */
export const removeIfEmpty =
  (orderId: string): Updater =>
  (s) => {
    const order = s.orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'ouverte' || order.lines.length > 0) return s;
    return { ...s, orders: s.orders.filter((o) => o.id !== orderId) };
  };

export const clearHistory: Updater = (s) => ({
  ...s,
  orders: s.orders.filter((o) => o.status === 'ouverte'),
});

/* ----------------------------- Gestion ----------------------------- */

export const updateSettings =
  (patch: Partial<Settings>): Updater =>
  (s) => ({ ...s, settings: { ...s.settings, ...patch } });

export const upsertTable =
  (table: Table): Updater =>
  (s) => ({ ...s, tables: upsert(s.tables, table) });

export const addTables =
  (tables: Table[]): Updater =>
  (s) => ({ ...s, tables: [...s.tables, ...tables] });

export const deleteTable =
  (id: string): Updater =>
  (s) => ({ ...s, tables: s.tables.filter((t) => t.id !== id) });

export const upsertCategory =
  (category: Category): Updater =>
  (s) => ({ ...s, categories: upsert(s.categories, category) });

/** Supprime une catégorie et tous ses articles. */
export const deleteCategory =
  (id: string): Updater =>
  (s) => ({
    ...s,
    categories: s.categories.filter((c) => c.id !== id),
    items: s.items.filter((i) => i.categoryId !== id),
  });

export const moveCategory =
  (id: string, direction: -1 | 1): Updater =>
  (s) => {
    const index = s.categories.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= s.categories.length) return s;
    const categories = [...s.categories];
    [categories[index], categories[target]] = [categories[target], categories[index]];
    return { ...s, categories };
  };

export const upsertItem =
  (item: MenuItem): Updater =>
  (s) => ({ ...s, items: upsert(s.items, item) });

export const deleteItem =
  (id: string): Updater =>
  (s) => ({ ...s, items: s.items.filter((i) => i.id !== id) });

export const setItemAvailable =
  (id: string, available: boolean): Updater =>
  (s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, available } : i)) });

export const addServer =
  (name: string): Updater =>
  (s) => {
    const clean = name.trim();
    if (!clean || s.servers.includes(clean)) return s;
    return { ...s, servers: [...s.servers, clean] };
  };

export const renameServer =
  (oldName: string, newName: string): Updater =>
  (s) => {
    const clean = newName.trim();
    if (!clean || (clean !== oldName && s.servers.includes(clean))) return s;
    return {
      ...s,
      servers: s.servers.map((n) => (n === oldName ? clean : n)),
      settings:
        s.settings.currentServer === oldName ? { ...s.settings, currentServer: clean } : s.settings,
    };
  };

export const removeServer =
  (name: string): Updater =>
  (s) => {
    if (s.servers.length <= 1) return s;
    const servers = s.servers.filter((n) => n !== name);
    return {
      ...s,
      servers,
      settings:
        s.settings.currentServer === name ? { ...s.settings, currentServer: servers[0] } : s.settings,
    };
  };

export const resetDemo: Updater = () => createDemoState();

export const wipeAll: Updater = (s) => createEmptyState({ settings: s.settings, servers: s.servers });
