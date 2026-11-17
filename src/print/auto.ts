import { kitchenTickets, type Ticket } from '../store/selectors';
import type { AppState, Station } from '../store/types';

// Impression automatique des bons : chaque envoi en cuisine / au bar n'est imprimé qu'une fois.
// Au premier calcul, les bons déjà présents sont considérés comme imprimés (pas de rafale à l'ouverture).
// Sans React Native : testable.

export type PrintedMemory = ReadonlySet<string>;

export function ticketsToPrint(
  memory: PrintedMemory | null,
  state: AppState,
  stations: Station[],
  now: number,
): { memory: PrintedMemory; fresh: Ticket[] } {
  const active = stations.flatMap((s) => kitchenTickets(state, s, now).active);
  const next = new Set(memory ?? []);
  for (const t of active) next.add(t.key);
  if (memory === null) return { memory: next, fresh: [] };
  const fresh = active.filter((t) => !memory.has(t.key)).sort((a, b) => a.sentAt - b.sentAt);
  return { memory: next, fresh };
}
