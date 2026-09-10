"use client";

import { useState } from "react";
import {
  BellRing,
  Check,
  CircleAlert,
  Clock3,
  Info,
  MessageCircleMore,
  PackageSearch,
  Send,
  ShieldAlert,
  Volume2,
  X,
} from "lucide-react";

type FeedbackTone = "attention" | "danger" | "info" | "success";

const toneStyle: Record<FeedbackTone, { icon: typeof Check; iconClass: string; panelClass: string; progressClass: string }> = {
  attention: { icon: CircleAlert, iconClass: "bg-[#fff0dc] text-[#9a561b]", panelClass: "border-[#efc48f] bg-[#fffaf3]", progressClass: "bg-[#d47d25]" },
  danger: { icon: ShieldAlert, iconClass: "bg-red-100 text-red-700", panelClass: "border-red-200 bg-[#fff8f8]", progressClass: "bg-red-600" },
  info: { icon: Info, iconClass: "bg-[#f3e2eb] text-[#792f59]", panelClass: "border-[#dfb9ce] bg-[#fffafd]", progressClass: "bg-[#792f59]" },
  success: { icon: Check, iconClass: "bg-emerald-100 text-emerald-700", panelClass: "border-emerald-200 bg-[#f6fcf8]", progressClass: "bg-emerald-600" },
};

export function playFeedbackSound(tone: FeedbackTone) {
  const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return;
  const context = new Audio();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  const oscillator = context.createOscillator();
  oscillator.type = tone === "danger" ? "sawtooth" : "sine";
  oscillator.frequency.setValueAtTime(tone === "danger" ? 190 : tone === "attention" ? 520 : 680, context.currentTime);
  if (tone === "success") oscillator.frequency.exponentialRampToValueAtTime(910, context.currentTime + 0.14);
  oscillator.connect(gain);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.23);
  oscillator.addEventListener("ended", () => void context.close());
}

export function FeedbackToast({
  body,
  onClose,
  title,
  tone,
}: {
  body: string;
  onClose?: () => void;
  title: string;
  tone: FeedbackTone;
}) {
  const style = toneStyle[tone];
  const Icon = style.icon;
  return (
    <article aria-live={tone === "danger" ? "assertive" : "polite"} className={`overflow-hidden rounded-2xl border shadow-[0_16px_36px_rgb(64_35_52_/_0.14)] ${style.panelClass}`} role={tone === "danger" ? "alert" : "status"}>
      <div className="flex gap-3 px-4 py-3.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${style.iconClass}`}><Icon className="size-[18px]" strokeWidth={2.2} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-stone-950">{title}</p>
          <p className="mt-0.5 text-sm leading-5 text-stone-600">{body}</p>
        </div>
        {onClose && <button aria-label="Chiudi avviso" className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-white/70 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59]" onClick={onClose} type="button"><X className="size-4" /></button>}
      </div>
      <div className={`h-1 ${style.progressClass}`} />
    </article>
  );
}

export function FeedbackAlert({ action, children, title, tone }: { action?: React.ReactNode; children: React.ReactNode; title: string; tone: Exclude<FeedbackTone, "success"> }) {
  const style = toneStyle[tone];
  const Icon = style.icon;
  return <section className={`rounded-2xl border p-4 ${style.panelClass}`} role={tone === "danger" ? "alert" : "status"}>
    <div className="flex items-start gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${style.iconClass}`}><Icon className="size-[18px]" strokeWidth={2.2} /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold text-stone-950">{title}</h3><div className="mt-1 text-sm leading-5 text-stone-600">{children}</div>{action && <div className="mt-3">{action}</div>}</div>
    </div>
  </section>;
}

function SoundButton({ label, tone, onClick }: { label: string; tone: FeedbackTone; onClick: () => void }) {
  return <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 transition hover:border-[#b87898] hover:text-[#792f59] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59]" onClick={() => { playFeedbackSound(tone); onClick(); }} type="button"><Volume2 className="size-4" />{label}</button>;
}

export function FeedbackSystemPreview() {
  const [toast, setToast] = useState<FeedbackTone | null>("success");
  const [messageSent, setMessageSent] = useState(false);
  const toastContent: Record<FeedbackTone, { body: string; title: string }> = {
    attention: { title: "Conferma richiesta", body: "Giulia Bianchi attende una risposta per venerdì alle 15:30." },
    danger: { title: "Invio non riuscito", body: "Il promemoria WhatsApp non è partito. Riprova o scegli un altro canale." },
    info: { title: "Nuova prenotazione online", body: "Marco Rinaldi ha richiesto Colore e piega." },
    success: { title: "Pagamento registrato", body: "La vendita di € 64,00 è stata chiusa correttamente." },
  };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-stone-950">Avviso che richiede attenzione</p><p className="mt-1 text-sm leading-5 text-stone-500">Resta nel contesto finché la persona non completa l’azione.</p></div><PackageSearch className="size-5 text-[#792f59]" /></div>
        <div className="mt-4"><FeedbackAlert action={<button className="rounded-lg bg-[#402334] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#2d1824] active:translate-y-px">Rivedi scorte</button>} title="Scorta bassa: Olaplex N°3" tone="attention">Restano 2 pezzi. La soglia minima impostata per il magazzino è 4.</FeedbackAlert></div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-stone-950">Messaggio operativo</p><p className="mt-1 text-sm leading-5 text-stone-500">Conferma puntuale, vicina alla conversazione o al record coinvolto.</p></div><MessageCircleMore className="size-5 text-[#792f59]" /></div>
        <div className="mt-4 max-w-xl rounded-2xl bg-[#f6f2f4] p-4">
          <div className="rounded-2xl rounded-tl-md bg-white p-3 shadow-sm"><p className="text-sm font-bold text-stone-900">Elena Ferri</p><p className="mt-1 text-sm leading-5 text-stone-600">Posso spostare l’appuntamento di domani alle 17:00?</p><p className="mt-2 text-xs font-medium text-stone-400">Adesso</p></div>
          {messageSent ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">Risposta inviata a Elena.</p> : <button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#792f59] px-3 text-sm font-bold text-white transition hover:bg-[#66264b] active:translate-y-px" onClick={() => { playFeedbackSound("success"); setMessageSent(true); }} type="button"><Send className="size-4" />Invia conferma</button>}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-stone-950">Notifiche temporanee</p><p className="mt-1 text-sm leading-5 text-stone-500">Brevi, non bloccanti e con suono solo dopo un gesto dell’utente o un evento nuovo.</p></div><BellRing className="size-5 text-[#792f59]" /></div>
        <div className="mt-4 flex flex-wrap gap-2"><SoundButton label="Successo" onClick={() => setToast("success")} tone="success" /><SoundButton label="Nuova attività" onClick={() => setToast("info")} tone="info" /><SoundButton label="Attenzione" onClick={() => setToast("attention")} tone="attention" /><SoundButton label="Errore" onClick={() => setToast("danger")} tone="danger" /></div>
      </section>
    </div>

    <aside className="relative min-h-[360px] rounded-2xl border border-stone-200 bg-[#f6f2f4] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold text-stone-800"><Clock3 className="size-4 text-[#792f59]" />Anteprima in-app</div>
      <p className="mt-1 text-sm leading-5 text-stone-500">Il toast compare in alto a destra, senza interrompere il lavoro.</p>
      <div className="absolute inset-x-5 top-24 space-y-3">{toast && <FeedbackToast {...toastContent[toast]} onClose={() => setToast(null)} tone={toast} />}</div>
      {!toast && <div className="absolute inset-x-5 top-28 rounded-2xl border border-dashed border-stone-300 bg-white/70 p-5 text-center text-sm text-stone-500">Scegli un esempio per vedere l’avviso.</div>}
    </aside>
  </div>;
}
