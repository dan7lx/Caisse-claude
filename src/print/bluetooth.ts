import { Platform } from 'react-native';

// Imprimantes thermiques Bluetooth (BLE) via Web Bluetooth.
// Disponible dans Chrome sur Android, Windows, macOS et ChromeOS. Safari (iPhone, iPad) ne le permet pas.

interface BleCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: Uint8Array): Promise<void>;
  writeValueWithoutResponse?: (data: Uint8Array) => Promise<void>;
}
interface BleService {
  getCharacteristics(): Promise<BleCharacteristic[]>;
}
interface BleServer {
  connected: boolean;
  connect(): Promise<BleServer>;
  getPrimaryService(uuid: string): Promise<BleService>;
}
interface BleDevice {
  id?: string;
  name?: string;
  gatt?: BleServer;
  addEventListener(type: 'gattserverdisconnected', cb: () => void): void;
}
interface BleNavigator {
  bluetooth?: {
    requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice>;
    /** Appareils déjà autorisés (Chrome récent) : reconnexion sans nouvelle fenêtre de choix. */
    getDevices?: () => Promise<BleDevice[]>;
  };
}

/** Services d'impression des imprimantes thermiques BLE les plus courantes. */
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
];

let device: BleDevice | null = null;
let characteristic: BleCharacteristic | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const nav = () => (Platform.OS === 'web' ? (globalThis as { navigator?: BleNavigator }).navigator : undefined);

export const bluetoothSupported = (): boolean => !!nav()?.bluetooth;

/** Nom de l'imprimante Bluetooth connectée, ou null. */
export const bluetoothPrinterName = (): string | null => (characteristic ? device?.name || 'Imprimante Bluetooth' : null);

export function subscribeBluetooth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function findCharacteristic(server: BleServer): Promise<BleCharacteristic | null> {
  for (const uuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (writable) return writable;
    } catch {
      // Service absent sur cette imprimante : on essaie le suivant.
    }
  }
  return null;
}

async function attach(picked: BleDevice): Promise<string> {
  if (!picked.gatt) throw new Error('Cet appareil Bluetooth ne peut pas recevoir de données.');
  const server = await picked.gatt.connect();
  const found = await findCharacteristic(server);
  if (!found) throw new Error('Imprimante non reconnue. Il faut une imprimante thermique Bluetooth (BLE) au format ESC/POS.');
  device = picked;
  characteristic = found;
  picked.addEventListener('gattserverdisconnected', notify);
  notify();
  return picked.name || 'Imprimante Bluetooth';
}

/** Ouvre la fenêtre de choix de l'appareil Bluetooth et se connecte à l'imprimante. */
export async function connectBluetoothPrinter(): Promise<string> {
  const bt = nav()?.bluetooth;
  if (!bt) throw new Error('Bluetooth indisponible sur cet appareil ou ce navigateur.');
  const picked = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  return attach(picked);
}

/** Reconnexion silencieuse à une imprimante déjà autorisée (si le navigateur le permet). */
export async function reconnectBluetoothPrinter(name: string | null): Promise<string | null> {
  if (characteristic) return bluetoothPrinterName();
  const bt = nav()?.bluetooth;
  if (!bt?.getDevices) return null;
  try {
    const known = await bt.getDevices();
    const picked = known.find((d) => !name || d.name === name) ?? known[0];
    return picked ? await attach(picked) : null;
  } catch {
    return null;
  }
}

export function disconnectBluetoothPrinter(): void {
  device = null;
  characteristic = null;
  notify();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Taille des paquets envoyés (limite des imprimantes BLE). */
const CHUNK = 180;

/** Envoie les données à l'imprimante Bluetooth, par paquets. */
export async function printBluetooth(data: Uint8Array): Promise<void> {
  if (!device?.gatt || !characteristic) throw new Error('Aucune imprimante Bluetooth connectée.');
  if (!device.gatt.connected) {
    const server = await device.gatt.connect();
    characteristic = (await findCharacteristic(server)) ?? characteristic;
  }
  for (let i = 0; i < data.length; i += CHUNK) {
    const part = data.slice(i, i + CHUNK);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(part);
      await pause(25);
    } else {
      await characteristic.writeValue(part);
    }
  }
}
