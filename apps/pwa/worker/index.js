self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const href = payload.href || "/";
  event.waitUntil(
    self.registration.showNotification(payload.title || "EsseBeauty", {
      badge: "/icon-192.png",
      body: payload.body,
      data: { href },
      icon: "/icon-192.png",
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clientsList) => {
      const existing = clientsList.find((client) => client.url.includes(href));
      if (existing && "focus" in existing) return existing.focus();
      if (clientsList[0] && "focus" in clientsList[0]) {
        clientsList[0].navigate(href);
        return clientsList[0].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(href);
    }),
  );
});
