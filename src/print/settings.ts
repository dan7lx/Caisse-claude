import type { DeviceState, PrinterSettings, Role, Station } from '../store/types';

// Réglages d'impression de l'appareil. Sans React Native : testable.

export const DEFAULT_PRINTER: PrinterSettings = {
  mode: 'aucune',
  paperWidth: 80,
  asciiOnly: false,
  host: '',
  bluetoothName: null,
  autoKitchen: true,
  autoReceipt: false,
};

export const printerOf = (device: Pick<DeviceState, 'printer'>): PrinterSettings => ({ ...DEFAULT_PRINTER, ...device.printer });

/** L'impression peut-elle partir sans geste (Bluetooth ou imprimante réseau) ? */
export const canPrintSilently = (p: PrinterSettings): boolean => p.mode === 'bluetooth' || p.mode === 'reseau';

/** Postes dont cet appareil imprime les bons : le sien en cuisine / au bar, les deux sur l'appareil de salle. */
export const stationsFor = (role: Role): Station[] => (role === 'serveur' ? ['cuisine', 'bar'] : [role]);
