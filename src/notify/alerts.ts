import { kitchenTickets } from '../store/selectors';
import type { AppState, Role, Station } from '../store/types';

// Alertes de service, calculées en comparant l'état actuel à ce qui a déjà été signalé.
// Sans React Native : testable.

export type AlertKind = 'nouveau_bon' | 'pret' | 'annulee' | 'retard';

export interface ServiceAlert {
  /** Identifiant stable : une alerte n'est jamais signalée deux fois. */
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Écran à ouvrir quand on touche l'alerte. */
  href: string;
}

/** Ce qui a déjà été vu par cet appareil (identifiants d'alertes). */
export type AlertMemory = ReadonlySet<string>;

export interface AlertContext {
  /** Poste de l'appareil dans le lobby. */
  role: Role;
  /** Prénom affiché sur l'appareil (le serveur ne reçoit que les plats prêts de ses tables). */
  me: string;
  now: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Toutes les alertes possibles pour ce poste, dans l'état actuel. */
export function currentAlerts(state: AppState, ctx: AlertContext): ServiceAlert[] {
  const out: ServiceAlert[] = [];
  if (ctx.role === 'cuisine' || ctx.role === 'bar') {
    const station: Station = ctx.role;
    const where = station === 'bar' ? 'au bar' : 'en cuisine';
    const alertMs = state.settings.alertMinutes * 60_000;
    for (const t of kitchenTickets(state, station, ctx.now).active) {
      const qty = t.lines.reduce((n, l) => n + l.qty, 0);
      out.push({
        id: `bon:${t.key}`,
        kind: 'nouveau_bon',
        title: `Nouvelle commande ${where}`,
        body: `${t.order.label} · ${plural(qty, 'article')} · ${t.order.server}`,
        href: '/cuisine',
      });
      if (alertMs > 0 && ctx.now - t.sentAt >= alertMs) {
        out.push({
          id: `retard:${t.key}`,
          kind: 'retard',
          title: 'Commande en retard',
          body: `${t.order.label} attend depuis plus de ${state.settings.alertMinutes} min`,
          href: '/cuisine',
        });
      }
    }
    // Commande annulée alors que des articles avaient été envoyés à ce poste.
    for (const o of state.orders) {
      if (o.status !== 'annulee' || !o.lines.some((l) => l.station === station && l.batch !== null)) continue;
      out.push({
        id: `annulee:${o.id}`,
        kind: 'annulee',
        title: 'Commande annulée',
        body: `${o.label} · ne pas préparer`,
        href: '/cuisine',
      });
    }
  } else {
    // Salle : plats et boissons prêts à servir sur les tables de ce serveur.
    for (const o of state.orders) {
      if (o.status !== 'ouverte' || o.server !== ctx.me) continue;
      const ready = o.lines.filter((l) => l.status === 'pret');
      if (!ready.length) continue;
      const qty = ready.reduce((n, l) => n + l.qty, 0);
      // Une alerte par vague « prêt » (l'heure du dernier article prêt).
      const wave = Math.max(...ready.map((l) => l.readyAt ?? 0));
      out.push({
        id: `pret:${o.id}:${wave}`,
        kind: 'pret',
        title: 'Prêt à servir',
        body: `${o.label} · ${plural(qty, 'article')} à servir`,
        href: `/commande/${o.id}`,
      });
    }
  }
  return out;
}

/**
 * Nouvelles alertes depuis la dernière fois. Au premier appel (`memory` null), tout ce qui existe
 * déjà est considéré comme vu : on ne sonne pas pour des commandes antérieures à l'ouverture.
 */
export function detectAlerts(
  memory: AlertMemory | null,
  state: AppState,
  ctx: AlertContext,
): { memory: AlertMemory; fresh: ServiceAlert[] } {
  const all = currentAlerts(state, ctx);
  const next = new Set(all.map((a) => a.id));
  if (memory === null) return { memory: next, fresh: [] };
  const fresh = all.filter((a) => !memory.has(a.id));
  // On garde aussi les anciennes alertes vues (un bon remis « en préparation » ne doit pas resonner),
  // dans une limite raisonnable pour un long service.
  if (memory.size < 3000) for (const id of memory) next.add(id);
  return { memory: next, fresh };
}
