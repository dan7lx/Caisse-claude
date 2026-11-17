import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { printDoc } from '../print';
import { printerOf } from '../print/settings';
import { setPrintStatus } from '../print/status';
import { useStore } from '../store/StoreProvider';
import type { TicketDoc } from '../ticket/doc';
import { useToast } from './Toast';
import { notify } from './ui';

/** Impression à la demande (bouton « Imprimer ») avec l'imprimante de cet appareil. */
export function usePrint(): (doc: TicketDoc) => Promise<boolean> {
  const { device } = useStore();
  const router = useRouter();
  const toast = useToast();
  const printer = printerOf(device);
  return useCallback(
    async (doc: TicketDoc) => {
      if (printer.mode === 'aucune') {
        toast('Choisissez d’abord une imprimante', '🖨️');
        router.push('/imprimante');
        return false;
      }
      try {
        await printDoc(doc, printer);
        setPrintStatus({ ok: true, message: `Imprimé : ${doc.title}`, at: Date.now() });
        if (printer.mode !== 'systeme') toast(`${doc.title} imprimé`, '🖨️');
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Impression impossible.';
        setPrintStatus({ ok: false, message: msg, at: Date.now() });
        notify('Impression impossible', msg);
        return false;
      }
    },
    [printer, router, toast],
  );
}
