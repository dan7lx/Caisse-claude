import * as Print from 'expo-print';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { PrinterSettings } from '../store/types';
import { bluetoothPrinterName, printBluetooth, subscribePrinter } from './bluetooth';
import type { PrintDoc } from './doc';
import { toEscPos } from './escpos';
import { toHtml } from './html';

export type PrintRoute = 'bluetooth' | 'systeme';

/** Impression par la fenêtre système (AirPrint sur iPhone, service d'impression Android, navigateur). */
async function printSystem(html: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Print.printAsync({ html });
    return;
  }
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) throw new Error('Impression indisponible.');
  const frame = doc.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  doc.body.appendChild(frame);
  await new Promise<void>((resolve) => {
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
        setTimeout(() => frame.remove(), 60_000);
      }, 250);
    };
  });
}

/**
 * Imprime un document : sur l'imprimante Bluetooth si elle est connectée,
 * sinon par la fenêtre d'impression du téléphone.
 */
export async function printDoc(doc: PrintDoc, settings: PrinterSettings): Promise<PrintRoute> {
  if (bluetoothPrinterName()) {
    await printBluetooth(toEscPos(doc, settings.paperWidth, settings.asciiOnly));
    return 'bluetooth';
  }
  await printSystem(toHtml(doc, settings.paperWidth));
  return 'systeme';
}

/** Nom de l'imprimante Bluetooth connectée (mis à jour en direct). */
export function useBluetoothPrinter(): string | null {
  return useSyncExternalStore(subscribePrinter, bluetoothPrinterName, () => null);
}
