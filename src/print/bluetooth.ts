import { Platform } from 'react-native';

// Imprimantes thermiques Bluetooth (BLE) via Web Bluetooth.
// Disponible dans Chrome sur Android, Windows, macOS et ChromeOS. Safari sur iPhone ne le permet pas.

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
  name?: string;
  gatt?: BleServer;
  addEventListener(type: 'gattserverdisconnected', cb: () => void): void;
}
interface BleNavigator {
  bluetooth?: {
    requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice>;
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

export const bluetoothSupported = () => !!nav()?.bluetooth;

export const bluetoothPrinterName = () => (characteristic ? device?.name || 'Imprimante Bluetooth' : null);

export function subscribePrinter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function findCharacteristic(server: BleServer): Promise<BleCharacteristic | null> {
  for (const uuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (writable) return writable;
    } catch {
      // service absent sur cette imprimante : on essaie le suivant
    }
  }
  return null;
}

/** Ouvre la fenêtre de choix de l'appareil Bluetooth et se connecte à l'imprimante. */
export async function connectBluetoothPrinter(): Promise<string> {
  const bt = nav()?.bluetooth;
  if (!bt) throw new Error('Bluetooth non disponible sur cet appareil ou ce navigateur.');
  const picked = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  if (!picked.gatt) throw new Error('Cet appareil Bluetooth ne peut pas recevoir de données.');
  const server = await picked.gatt.connect();
  const found = await findCharacteristic(server);
  if (!found) throw new Error('Imprimante non reconnue. Vérifiez qu’il s’agit d’une imprimante thermique Bluetooth (BLE) ESC/POS.');
  device = picked;
  characteristic = found;
  picked.addEventListener('gattserverdisconnected', notify);
  notify();
  return picked.name || 'Imprimante Bluetooth';
}

export function disconnectBluetoothPrinter() {
  device = null;
  characteristic = null;
  notify();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envoie les données par paquets (limite des imprimantes BLE). */
export async function printBluetooth(data: Uint8Array): Promise<void> {
  if (!device?.gatt || !characteristic) throw new Error('Aucune imprimante Bluetooth connectée.');
  if (!device.gatt.connected) {
    const server = await device.gatt.connect();
    characteristic = (await findCharacteristic(server)) ?? characteristic;
  }
  const chunk = 180;
  for (let i = 0; i < data.length; i += chunk) {
    const part = data.slice(i, i + chunk);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(part);
      await pause(25);
    } else {
      await characteristic.writeValue(part);
    }
  }
}
