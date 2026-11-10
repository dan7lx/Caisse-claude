import type {
  AppState,
  Category,
  License,
  LineStatus,
  MenuItem,
  Order,
  PaymentLinks,
  PaymentMethod,
  RestaurantData,
  Security,
  Settings,
  Station,
  Table,
} from './types';

/**
 * Une opération décrit une modification. Elle contient toutes les valeurs générées
 * (identifiants, horodatages) : appliquée dans le même ordre sur chaque appareil,
 * elle donne exactement le même résultat. C'est la base de la synchronisation du lobby.
 */
export type Op =
  | { t: 'createOrder'; id: string; tableId: string | null; label: string; server: string; at: number }
  | { t: 'addItem'; orderId: string; lineId: string; item: MenuItem; station: Station }
  | { t: 'changeQty'; orderId: string; lineId: string; delta: number }
  | { t: 'setLineNote'; orderId: string; lineId: string; note: string }
  | { t: 'removeLine'; orderId: string; lineId: string }
  | { t: 'setGuests'; orderId: string; guests: number }
  | { t: 'sendOrder'; orderId: string; at: number }
  | { t: 'setLinesStatus'; orderId: string; lineIds: string[]; status: LineStatus; at: number }
  | { t: 'payOrder'; orderId: string; payment: PaymentMethod; at: number }
  | { t: 'cancelOrder'; orderId: string; at: number }
  | { t: 'removeIfEmpty'; orderId: string }
  | { t: 'clearHistory' }
  | { t: 'updateSettings'; patch: Partial<Settings> }
  | { t: 'upsertTable'; table: Table }
  | { t: 'addTables'; tables: Table[] }
  | { t: 'deleteTable'; id: string }
  | { t: 'upsertCategory'; category: Category }
  | { t: 'deleteCategory'; id: string }
  | { t: 'moveCategory'; id: string; direction: -1 | 1 }
  | { t: 'upsertItem'; item: MenuItem }
  | { t: 'deleteItem'; id: string }
  | { t: 'setItemAvailable'; id: string; available: boolean }
  | { t: 'addServer'; name: string }
  | { t: 'renameServer'; oldName: string; newName: string }
  | { t: 'removeServer'; name: string }
  | { t: 'replaceData'; data: RestaurantData }
  | { t: 'setManagerPin'; hash: string | null }
  | { t: 'setSecurity'; patch: Partial<Security> }
  | { t: 'setLicense'; license: License }
  | { t: 'setPaymentLinks'; links: PaymentLinks };

function mapOrder(state: AppState, orderId: string, fn: (order: Order) => Order): AppState {
  return { ...state, orders: state.orders.map((o) => (o.id === orderId ? fn(o) : o)) };
}

function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some((x) => x.id === entry.id)
    ? list.map((x) => (x.id === entry.id ? entry : x))
    : [...list, entry];
}

function sendLines(o: Order, at: number): Order {
  if (!o.lines.some((l) => l.status === 'brouillon')) return o;
  const batch = o.batchCount + 1;
  return {
    ...o,
    batchCount: batch,
    lines: o.lines.map((l) => (l.status === 'brouillon' ? { ...l, status: 'envoye', batch, sentAt: at } : l)),
  };
}

/** Applique une opération. Fonction pure : aucune date ni identifiant n'est généré ici. */
export function reduce(s: AppState, op: Op): AppState {
  switch (op.t) {
    case 'createOrder': {
      if (s.orders.some((o) => o.id === op.id)) return s;
      if (op.tableId && s.orders.some((o) => o.status === 'ouverte' && o.tableId === op.tableId)) return s;
      const number = s.orderCounter + 1;
      const order: Order = {
        id: op.id,
        number,
        tableId: op.tableId,
        label: op.label,
        server: op.server,
        guests: op.tableId ? (s.tables.find((t) => t.id === op.tableId)?.seats ?? 1) : 1,
        lines: [],
        status: 'ouverte',
        createdAt: op.at,
        paidAt: null,
        payment: null,
        batchCount: 0,
      };
      return { ...s, orderCounter: number, orders: [...s.orders, order] };
    }
    case 'addItem':
      return mapOrder(s, op.orderId, (o) => {
        if (o.status !== 'ouverte') return o;
        const existing = o.lines.find((l) => l.status === 'brouillon' && l.itemId === op.item.id && !l.note);
        if (existing) {
          return { ...o, lines: o.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) };
        }
        return {
          ...o,
          lines: [
            ...o.lines,
            {
              id: op.lineId,
              itemId: op.item.id,
              name: op.item.name,
              unitPrice: op.item.price,
              qty: 1,
              note: '',
              station: op.station,
              status: 'brouillon',
              batch: null,
              sentAt: null,
              readyAt: null,
            },
          ],
        };
      });
    case 'changeQty':
      return mapOrder(s, op.orderId, (o) => ({
        ...o,
        lines: o.lines
          .map((l) => (l.id === op.lineId && l.status === 'brouillon' ? { ...l, qty: l.qty + op.delta } : l))
          .filter((l) => l.qty > 0),
      }));
    case 'setLineNote':
      return mapOrder(s, op.orderId, (o) => ({
        ...o,
        lines: o.lines.map((l) => (l.id === op.lineId ? { ...l, note: op.note.trim() } : l)),
      }));
    case 'removeLine':
      return mapOrder(s, op.orderId, (o) => ({ ...o, lines: o.lines.filter((l) => l.id !== op.lineId) }));
    case 'setGuests':
      return mapOrder(s, op.orderId, (o) => ({ ...o, guests: Math.max(0, op.guests) }));
    case 'sendOrder':
      return mapOrder(s, op.orderId, (o) => sendLines(o, op.at));
    case 'setLinesStatus':
      return mapOrder(s, op.orderId, (o) => ({
        ...o,
        lines: o.lines.map((l) => {
          if (!op.lineIds.includes(l.id) || l.status === 'brouillon') return l;
          const readyAt = op.status === 'pret' ? op.at : op.status === 'servi' ? (l.readyAt ?? op.at) : null;
          return { ...l, status: op.status, readyAt };
        }),
      }));
    case 'payOrder':
      return mapOrder(s, op.orderId, (o) =>
        o.status !== 'ouverte' ? o : { ...sendLines(o, op.at), status: 'payee', paidAt: op.at, payment: op.payment },
      );
    case 'cancelOrder': {
      const order = s.orders.find((o) => o.id === op.orderId);
      if (!order) return s;
      if (order.lines.every((l) => l.status === 'brouillon')) {
        return { ...s, orders: s.orders.filter((o) => o.id !== op.orderId) };
      }
      return mapOrder(s, op.orderId, (o) => ({ ...o, status: 'annulee', paidAt: op.at }));
    }
    case 'removeIfEmpty': {
      const order = s.orders.find((o) => o.id === op.orderId);
      if (!order || order.status !== 'ouverte' || order.lines.length > 0) return s;
      return { ...s, orders: s.orders.filter((o) => o.id !== op.orderId) };
    }
    case 'clearHistory':
      return { ...s, orders: s.orders.filter((o) => o.status === 'ouverte') };
    case 'updateSettings':
      return { ...s, settings: { ...s.settings, ...op.patch } };
    case 'upsertTable':
      return { ...s, tables: upsert(s.tables, op.table) };
    case 'addTables':
      return { ...s, tables: [...s.tables, ...op.tables] };
    case 'deleteTable':
      return { ...s, tables: s.tables.filter((t) => t.id !== op.id) };
    case 'upsertCategory':
      return { ...s, categories: upsert(s.categories, op.category) };
    case 'deleteCategory':
      return {
        ...s,
        categories: s.categories.filter((c) => c.id !== op.id),
        items: s.items.filter((i) => i.categoryId !== op.id),
      };
    case 'moveCategory': {
      const index = s.categories.findIndex((c) => c.id === op.id);
      const target = index + op.direction;
      if (index < 0 || target < 0 || target >= s.categories.length) return s;
      const categories = [...s.categories];
      [categories[index], categories[target]] = [categories[target], categories[index]];
      return { ...s, categories };
    }
    case 'upsertItem':
      return { ...s, items: upsert(s.items, op.item) };
    case 'deleteItem':
      return { ...s, items: s.items.filter((i) => i.id !== op.id) };
    case 'setItemAvailable':
      return { ...s, items: s.items.map((i) => (i.id === op.id ? { ...i, available: op.available } : i)) };
    case 'addServer': {
      const clean = op.name.trim();
      if (!clean || s.servers.includes(clean)) return s;
      return { ...s, servers: [...s.servers, clean] };
    }
    case 'renameServer': {
      const clean = op.newName.trim();
      if (!clean || (clean !== op.oldName && s.servers.includes(clean))) return s;
      return { ...s, servers: s.servers.map((n) => (n === op.oldName ? clean : n)) };
    }
    case 'removeServer':
      if (s.servers.length <= 1) return s;
      return { ...s, servers: s.servers.filter((n) => n !== op.name) };
    case 'replaceData':
      return { ...s, ...op.data };
    case 'setManagerPin':
      return { ...s, security: { ...s.security, managerPinHash: op.hash } };
    case 'setSecurity':
      return { ...s, security: { ...s.security, ...op.patch } };
    case 'setLicense':
      return { ...s, license: op.license };
    case 'setPaymentLinks':
      return { ...s, paymentLinks: op.links };
    default:
      return s;
  }
}

export function reduceAll(state: AppState, ops: Op[]): AppState {
  return ops.reduce(reduce, state);
}
