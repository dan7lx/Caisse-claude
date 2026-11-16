import { Platform } from 'react-native';

// Notifications du système (bannière du téléphone) pour l'application web, via le service worker.
// iPhone : seulement dans l'app ajoutée à l'écran d'accueil (iOS 16.4 ou plus), après autorisation.

type Perm = 'granted' | 'denied' | 'default' | 'unsupported';

interface NotificationLike {
  permission: 'granted' | 'denied' | 'default';
  requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
}

const NotificationApi = (): NotificationLike | null =>
  Platform.OS === 'web' ? ((globalThis as { Notification?: NotificationLike }).Notification ?? null) : null;

const serviceWorker = () =>
  Platform.OS === 'web'
    ? (globalThis as { navigator?: { serviceWorker?: ServiceWorkerContainer } }).navigator?.serviceWorker
    : undefined;

export function notificationPermission(): Perm {
  const api = NotificationApi();
  if (!api || !serviceWorker()) return 'unsupported';
  return api.permission;
}

/** Enregistre le service worker (sans effet s'il l'est déjà). */
export function registerServiceWorker() {
  const sw = serviceWorker();
  if (!sw) return;
  sw.register('/sw.js').catch(() => undefined);
}

/** Demande l'autorisation (à appeler depuis un bouton). */
export async function askNotificationPermission(): Promise<Perm> {
  const api = NotificationApi();
  if (!api || !serviceWorker()) return 'unsupported';
  registerServiceWorker();
  try {
    return await api.requestPermission();
  } catch {
    return api.permission;
  }
}

/** Affiche une notification du système (si autorisée). */
export async function showSystemNotification(title: string, body: string, href: string, tag: string) {
  if (notificationPermission() !== 'granted') return;
  const sw = serviceWorker();
  try {
    const reg = await sw?.ready;
    await reg?.showNotification(title, { body, tag, data: { href }, icon: '/icon-192.png', badge: '/icon-192.png' });
  } catch {
    // notification impossible : l'alerte reste affichée dans l'application
  }
}
