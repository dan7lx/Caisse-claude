import { createDemoData, createEmptyData, uid } from './defaults';
import type { Op } from './ops';
import type {
  Category,
  License,
  LineStatus,
  MenuItem,
  PaymentLinks,
  PaymentMethod,
  Security,
  Settings,
  Station,
  Table,
} from './types';

// Créateurs d'opérations : c'est ici (et seulement ici) que sont générés
// les identifiants et les horodatages, pour que les opérations soient rejouables.

export const createOrder = (id: string, tableId: string | null, label: string, server: string): Op => ({
  t: 'createOrder',
  id,
  tableId,
  label,
  server,
  at: Date.now(),
});

export const addItem = (orderId: string, item: MenuItem, station: Station): Op => ({
  t: 'addItem',
  orderId,
  lineId: uid(),
  item,
  station,
});

export const changeQty = (orderId: string, lineId: string, delta: number): Op => ({
  t: 'changeQty',
  orderId,
  lineId,
  delta,
});

export const setLineNote = (orderId: string, lineId: string, note: string): Op => ({
  t: 'setLineNote',
  orderId,
  lineId,
  note,
});

export const removeLine = (orderId: string, lineId: string): Op => ({ t: 'removeLine', orderId, lineId });

export const setGuests = (orderId: string, guests: number): Op => ({ t: 'setGuests', orderId, guests });

export const sendOrder = (orderId: string): Op => ({ t: 'sendOrder', orderId, at: Date.now() });

export const setLinesStatus = (orderId: string, lineIds: string[], status: LineStatus): Op => ({
  t: 'setLinesStatus',
  orderId,
  lineIds,
  status,
  at: Date.now(),
});

export const payOrder = (orderId: string, payment: PaymentMethod): Op => ({
  t: 'payOrder',
  orderId,
  payment,
  at: Date.now(),
});

export const cancelOrder = (orderId: string): Op => ({ t: 'cancelOrder', orderId, at: Date.now() });

export const removeIfEmpty = (orderId: string): Op => ({ t: 'removeIfEmpty', orderId });

export const clearHistory: Op = { t: 'clearHistory' };

export const updateSettings = (patch: Partial<Settings>): Op => ({ t: 'updateSettings', patch });

export const upsertTable = (table: Table): Op => ({ t: 'upsertTable', table });
export const addTables = (tables: Table[]): Op => ({ t: 'addTables', tables });
export const deleteTable = (id: string): Op => ({ t: 'deleteTable', id });

export const upsertCategory = (category: Category): Op => ({ t: 'upsertCategory', category });
export const deleteCategory = (id: string): Op => ({ t: 'deleteCategory', id });
export const moveCategory = (id: string, direction: -1 | 1): Op => ({ t: 'moveCategory', id, direction });

export const upsertItem = (item: MenuItem): Op => ({ t: 'upsertItem', item });
export const deleteItem = (id: string): Op => ({ t: 'deleteItem', id });
export const setItemAvailable = (id: string, available: boolean): Op => ({
  t: 'setItemAvailable',
  id,
  available,
});

export const addServer = (name: string): Op => ({ t: 'addServer', name });
export const renameServer = (oldName: string, newName: string): Op => ({ t: 'renameServer', oldName, newName });
export const removeServer = (name: string): Op => ({ t: 'removeServer', name });

export const resetDemo = (): Op => ({ t: 'replaceData', data: createDemoData() });
export const wipeAll = (settings: Settings, servers: string[]): Op => ({
  t: 'replaceData',
  data: createEmptyData(settings, servers),
});

export const setManagerPin = (hash: string | null): Op => ({ t: 'setManagerPin', hash });
export const setSecurity = (patch: Partial<Security>): Op => ({ t: 'setSecurity', patch });
export const setLicense = (license: License): Op => ({ t: 'setLicense', license });
export const setPaymentLinks = (links: PaymentLinks): Op => ({ t: 'setPaymentLinks', links });
