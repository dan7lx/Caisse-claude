import { useSyncExternalStore } from 'react';

// Dernier résultat d'impression de l'appareil (affiché sur l'écran Cuisine / Bar et l'écran Imprimante).

export interface PrintStatus {
  ok: boolean;
  /** Ce qui a été imprimé, ou le message d'erreur. */
  message: string;
  at: number;
}

let status: PrintStatus | null = null;
const listeners = new Set<() => void>();

export function setPrintStatus(next: PrintStatus | null): void {
  status = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function usePrintStatus(): PrintStatus | null {
  return useSyncExternalStore(subscribe, () => status, () => null);
}
