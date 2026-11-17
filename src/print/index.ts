import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { TicketDoc } from '../ticket/doc';
import type { PrinterSettings } from '../store/types';
import { bluetoothPrinterName, printBluetooth, subscribeBluetooth } from './bluetooth';
import { eposBody, eposUrl, parseEposResponse } from './epos';
import { toEscPos } from './escpos';
import { toHtml } from './html';

/** Délai maximum d'une impression réseau. */
const NETWORK_TIMEOUT_MS = 12_000;

export const modeLabel: Record<PrinterSettings['mode'], string> = {
  aucune: 'Aucune imprimante',
  bluetooth: 'Bluetooth',
  reseau: 'Wi-Fi (Epson ePOS)',
  systeme: 'Impression du téléphone (AirPrint)',
};

/** Fenêtre d'impression du système : AirPrint (iPhone), service d'impression Android, imprimante de l'ordinateur. */
async function printSystem(html: string): Promise<void> {
  const doc = (globalThis as { document?: Document }).document;
  if (Platform.OS !== 'web' || !doc) throw new Error('Impression indisponible sur cet appareil.');
  const frame = doc.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-print-frame', 'true');
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' });
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
    frame.srcdoc = html;
  });
}

/** Envoi à une imprimante réseau Epson (ePOS-Print) : la réponse de l'imprimante confirme l'impression. */
async function printNetwork(data: Uint8Array, host: string): Promise<void> {
  const page = (globalThis as { location?: Location }).location;
  const url = eposUrl(host, page?.protocol ?? 'https:');
  if (!url) throw new Error('Adresse de l’imprimante manquante ou invalide.');
  if (page?.protocol === 'https:' && url.startsWith('http:')) {
    throw new Error('L’application est en HTTPS : l’imprimante doit aussi être jointe en HTTPS (retirez « http:// »).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: eposBody(data),
      signal: ctrl.signal,
    });
  } catch {
    throw new Error(
      'Imprimante injoignable. Vérifiez qu’elle est allumée, sur le même Wi-Fi, et son adresse IP. ' +
        'La première fois, ouvrez son adresse en HTTPS dans le navigateur et acceptez son certificat.',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`L’imprimante a répondu une erreur (${res.status}).`);
  const result = parseEposResponse(await res.text());
  if (!result.ok) throw new Error(result.error);
}

/** Imprime un ticket selon le réglage de l'appareil. Lève une erreur lisible en cas d'échec. */
export async function printDoc(doc: TicketDoc, settings: PrinterSettings): Promise<void> {
  if (settings.mode === 'bluetooth') return printBluetooth(toEscPos(doc, settings.paperWidth, settings.asciiOnly));
  if (settings.mode === 'reseau') return printNetwork(toEscPos(doc, settings.paperWidth, settings.asciiOnly), settings.host);
  return printSystem(toHtml(doc, settings.paperWidth));
}

/** Nom de l'imprimante Bluetooth connectée (mis à jour en direct). */
export function useBluetoothPrinter(): string | null {
  return useSyncExternalStore(subscribeBluetooth, bluetoothPrinterName, () => null);
}
