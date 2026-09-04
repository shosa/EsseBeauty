"use client";

import { useEffect } from "react";

/**
 * next-pwa@5.6.0's auto-register only injects into the Pages Router "main.js" webpack
 * entry, which doesn't exist under App Router (this app has no pages/ directory) — so
 * its registration script never runs and the service worker, though built and served
 * correctly, never actually registers. Registering it ourselves is the fix.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* offline caching and push degrade gracefully without a service worker */ });
  }, []);

  return null;
}
