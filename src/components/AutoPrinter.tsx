import { useEffect, useRef } from 'react';

import { printDoc } from '../print';
import { ticketsToPrint, type PrintedMemory } from '../print/auto';
import { reconnectBluetoothPrinter } from '../print/bluetooth';
import { canPrintSilently, printerOf, stationsFor } from '../print/settings';
import { setPrintStatus } from '../print/status';
import type { Ticket } from '../store/selectors';
import { useNow, useStore } from '../store/StoreProvider';
import { kitchenDoc } from '../ticket/kitchen';
import { useToast } from './Toast';

/**
 * Impression automatique des bons de commande : sur l'appareil de la cuisine ou du bar (ou l'appareil
 * unique hors lobby), chaque nouvel envoi du serveur sort sur l'imprimante connectée, une seule fois.
 */
export function AutoPrinter() {
  const { state, device } = useStore();
  const toast = useToast();
  const now = useNow(15_000);
  const printer = printerOf(device);
  const enabled = printer.autoKitchen && canPrintSilently(printer);
  const memory = useRef<PrintedMemory | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const settings = useRef(printer);
  useEffect(() => {
    settings.current = printer;
  });
  const stations = stationsFor(device.role).join(',');

  // Reconnexion à l'imprimante Bluetooth déjà autorisée (si le navigateur le permet).
  useEffect(() => {
    if (printer.mode === 'bluetooth') void reconnectBluetoothPrinter(printer.bluetoothName);
  }, [printer.mode, printer.bluetoothName]);

  // Nouveau lobby, nouveau poste, impression coupée : on repart de zéro (pas de rafale de vieux bons).
  useEffect(() => {
    memory.current = null;
  }, [device.lobby?.lobbyId, stations, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const { memory: next, fresh } = ticketsToPrint(memory.current, state, stations.split(',') as Ticket['station'][], now);
    memory.current = next;
    for (const t of fresh) {
      queue.current = queue.current.then(async () => {
        try {
          await printDoc(kitchenDoc(t), settings.current);
          setPrintStatus({ ok: true, message: `Bon imprimé : ${t.order.label}`, at: Date.now() });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Impression impossible.';
          setPrintStatus({ ok: false, message: `${t.order.label} non imprimé : ${msg}`, at: Date.now() });
          toast(`Bon ${t.order.label} non imprimé`, '⚠️');
        }
      });
    }
  }, [state, now, enabled, stations, toast]);

  return null;
}
