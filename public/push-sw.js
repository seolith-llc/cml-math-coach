/* Imported by the generated service worker: shows practice reminders and opens the app when tapped. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Math Coach', {
      body: data.body || 'Ready for today’s practice?',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'daily-practice',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          if ('navigate' in w) w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/*
 * The app is behind Cloudflare Access. If this device isn't signed in (or its sign-in expired),
 * the offline copy would otherwise keep showing an old version forever, without ever asking to sign in.
 * When a new version installs, check; if signed out, drop the offline copy so the next open goes to the sign-in page.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(new URL('./?auth-check=1', self.registration.scope).href, { redirect: 'manual', cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (res.type !== 'opaqueredirect' && res.status !== 401 && res.status !== 403) return;
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        await self.registration.unregister();
      })
      .catch(() => {}) // offline: keep the copy
  );
});
