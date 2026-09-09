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
  // client.navigate() has patchy cross-browser support (notably on iOS Safari's
  // push implementation) and can fail silently, leaving the tap looking like it
  // did nothing. openWindow() is the one API every platform actually implements —
  // for an installed standalone PWA it focuses the existing app instance rather
  // than truly opening a second window. But focusing an already-open instance
  // doesn't navigate it anywhere (openWindow's url is ignored in that case on
  // iOS), so it's left sitting on whatever page it already had open — usually
  // the home screen. Posting a message lets the page itself perform the
  // navigation, which works even where navigate()/openWindow() don't.
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(async (clientsList) => {
      const existing = clientsList.find((client) => client.url.includes(href));
      if (existing && "focus" in existing) {
        await existing.focus();
        return;
      }
      const anyOpen = clientsList[0];
      if (anyOpen && "focus" in anyOpen) {
        await anyOpen.focus();
        anyOpen.postMessage({ href, type: "navigate" });
        return;
      }
      if (self.clients.openWindow) await self.clients.openWindow(href);
    }),
  );
});
