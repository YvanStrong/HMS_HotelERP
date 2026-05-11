/* Minimal service worker for guest self-order "notify when ready" Web Push. */
self.addEventListener("push", (event) => {
  let title = "Order update";
  let body = "";
  let url = "/";
  try {
    if (event.data) {
      const j = event.data.json();
      if (j.title) title = String(j.title);
      if (j.body) body = String(j.body);
      if (j.url) url = String(j.url);
    }
  } catch {
    try {
      body = event.data ? event.data.text() : "";
    } catch {
      /* ignore */
    }
  }
  event.waitUntil(self.registration.showNotification(title, { body, data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
