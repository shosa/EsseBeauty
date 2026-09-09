"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * next-pwa@5.6.0's auto-register only injects into the Pages Router "main.js" webpack
 * entry, which doesn't exist under App Router (this app has no pages/ directory) — so
 * its registration script never runs and the service worker, though built and served
 * correctly, never actually registers. Registering it ourselves is the fix.
 */
export function ServiceWorkerRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* offline caching and push degrade gracefully without a service worker */ });
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Tapping a push notification while the PWA is already open can't rely on the
    // service worker to navigate (see worker/index.js) — it focuses the running
    // instance and asks it to route itself here instead.
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "navigate" && typeof event.data.href === "string") router.push(event.data.href);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
