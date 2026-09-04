"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Share, SquarePlus, Smartphone, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_STEPS = [
  { icon: Share, text: "Tocca l'icona Condividi nella barra di Safari (il quadrato con la freccia verso l'alto)." },
  { icon: SquarePlus, text: "Scorri l'elenco e scegli “Aggiungi alla schermata Home”." },
  { icon: SquarePlus, text: "Conferma toccando “Aggiungi” in alto a destra." },
];

function InstallInstructionsModal({ onClose, primary }: { onClose: () => void; primary: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 grid place-items-end bg-[#2d1d27]/55 p-3 backdrop-blur-sm sm:place-items-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-t-[2.2rem] bg-white p-6 shadow-[0_-24px_70px_rgb(45_29_39_/_0.25)] sm:rounded-[2.2rem] sm:shadow-[0_24px_70px_rgb(45_29_39_/_0.25)]"
        exit={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        initial={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      >
        <button aria-label="Chiudi" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500" onClick={onClose} type="button">
          <X className="size-4" />
        </button>
        <h2 className="pr-10 text-xl font-bold text-stone-950">Come installare l'app</h2>
        <p className="mt-1 text-sm text-stone-500">Su iPhone e iPad l'installazione si fa da Safari, in tre passaggi.</p>
        <ol className="mt-5 space-y-4">
          {IOS_STEPS.map((step, index) => (
            <li className="flex items-start gap-3" key={step.text}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: primary }}>{index + 1}</span>
              <p className="flex items-center gap-2 pt-1 text-sm leading-5 text-stone-700"><step.icon className="size-4 shrink-0 text-stone-400" />{step.text}</p>
            </li>
          ))}
        </ol>
        <button className="mt-6 min-h-12 w-full rounded-2xl font-black text-white" onClick={onClose} style={{ background: primary }} type="button">Ho capito</button>
      </motion.section>
    </motion.div>
  );
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
  const [showInstructions, setShowInstructions] = useState(false);

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

  async function handleTap() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setPromptEvent(null);
      return;
    }
    setShowInstructions(true);
  }

  return (
    <>
      <motion.button
        className="animate-reveal mt-5 flex w-full items-center gap-4 rounded-3xl border p-5 text-left shadow-[0_12px_30px_rgb(45_29_39_/_0.1)]"
        onClick={() => void handleTap()}
        style={{ background: `linear-gradient(135deg, ${accent}45, ${accent}15)`, borderColor: `${primary}28` }}
        type="button"
        whileTap={{ scale: 0.98 }}
      >
        <span className="relative shrink-0">
          <span className="animate-install-ring absolute inset-0 rounded-2xl" style={{ "--esse-install-ring-color": `${primary}59` } as React.CSSProperties} />
          <span className="animate-install-bounce grid size-12 place-items-center rounded-2xl text-white" style={{ background: primary }}>
            <Smartphone className="size-6" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase tracking-[.18em]" style={{ color: primary }}>App Clienti</span>
          <span className="mt-1 block text-lg font-bold text-stone-950">Tienila sempre a portata di mano</span>
          <span className="mt-0.5 block text-sm leading-5 text-stone-600">
            {promptEvent ? "Installala sul telefono per aprirla direttamente dalla schermata Home." : "Scopri come aggiungerla alla schermata Home in tre passaggi."}
          </span>
        </span>
      </motion.button>
      <AnimatePresence>
        {showInstructions && <InstallInstructionsModal onClose={() => setShowInstructions(false)} primary={primary} />}
      </AnimatePresence>
    </>
  );
}
