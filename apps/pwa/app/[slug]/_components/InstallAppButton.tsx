"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton({
  accent,
  enabled,
  primary,
}: {
  accent: string;
  enabled: boolean;
  primary: string;
}) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function capturePrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    function markInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (!enabled || installed || (!promptEvent && !isIos)) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  }

  return (
    <section
      className="mt-5 rounded-3xl border p-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.07)]"
      style={{ background: `${accent}30`, borderColor: `${primary}24` }}
    >
      <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: primary }}>App Clienti</p>
      <h2 className="mt-2 text-lg font-bold text-stone-950">Tienila sempre a portata di mano</h2>
      <p className="mt-1 text-sm leading-5 text-stone-600">
        {promptEvent
          ? "Installala sul telefono per aprirla direttamente dalla schermata Home."
          : "Su iPhone usa Condividi e poi “Aggiungi alla schermata Home”."}
      </p>
      {promptEvent && (
        <button
          className="mt-4 min-h-11 rounded-xl px-5 text-sm font-black text-white"
          onClick={() => void install()}
          style={{ background: primary }}
          type="button"
        >
          Installa App Clienti
        </button>
      )}
    </section>
  );
}
