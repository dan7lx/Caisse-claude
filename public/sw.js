// Service worker de Caisse Resto : uniquement pour afficher les notifications d'alerte
// et ouvrir le bon écran quand on les touche. Aucune mise en cache (l'app reste toujours à jour).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(href).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
