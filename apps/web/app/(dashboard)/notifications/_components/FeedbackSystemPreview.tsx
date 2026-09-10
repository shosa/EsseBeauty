"use client";

import { useRef, useState, type ReactNode } from "react";
import * as Toast from "@radix-ui/react-toast";
import { SaveToast } from "@esse-beauty/ui";
import { createUISFX, type CueName, type UISFXPlayer } from "uisfx";
import { BellRing, Check, PackageSearch, Volume2 } from "lucide-react";

import { BookingArrivalToast, WhatsAppIncomingToast } from "./LiveNotificationToasts";
type PreviewKind = "booking" | "whatsapp" | null;

function PreviewButton({ children, cue, onClick, play }: { children: ReactNode; cue: CueName; onClick: () => void; play(cue: CueName): void }) {
  return <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 transition hover:border-[#b87898] hover:text-[#792f59] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59]" onClick={() => { play(cue); onClick(); }} type="button"><Volume2 className="size-4" />{children}</button>;
}

export function FeedbackSystemPreview() {
  const [preview, setPreview] = useState<PreviewKind>("whatsapp");
  const [notice, setNotice] = useState("");
  const soundPlayer = useRef<UISFXPlayer | null>(null);
  function openPreview(kind: Exclude<PreviewKind, null>) { setPreview(null); setNotice(kind === "whatsapp" ? "In produzione questo aprirà la conversazione WhatsApp." : "In produzione questo aprirà la richiesta nel calendario."); }
  function play(cue: CueName) {
    if (!soundPlayer.current) soundPlayer.current = createUISFX({ pack: "studio", volume: 0.82 });
    // I cue UI SFX sono volutamente calibrati a circa il 20% del master.
    // In questa prova vogliamo giudicare il timbro, quindi li riproduciamo a
    // pieno livello e lasciamo allo slider il solo controllo del master.
    void soundPlayer.current.unlock().then(() => soundPlayer.current?.play(cue, { volume: 1 }));
  }

  return <Toast.Provider swipeDirection="right"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-stone-950">Un evento, una forma riconoscibile</p><p className="mt-1 max-w-xl text-sm leading-5 text-stone-500">Il messaggio conserva la bolla WhatsApp già presente. La prenotazione usa il giorno e l’orario come informazione dominante.</p></div><BellRing className="size-5 text-[#792f59]" /></div><div className="mt-4 flex flex-wrap items-center gap-3"><PreviewButton cue="mention" onClick={() => { setNotice(""); setPreview("whatsapp"); }} play={play}>Simula WhatsApp</PreviewButton><PreviewButton cue="notification" onClick={() => { setNotice(""); setPreview("booking"); }} play={play}>Simula prenotazione</PreviewButton><PreviewButton cue="receive" onClick={() => setNotice("Avviso urgente: il suono è solo un test, non apre un toast.")} play={play}>Prova urgenza</PreviewButton></div></section>
      <section className="rounded-2xl border border-[#efc48f] bg-[#fffaf3] p-4" role="status"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff0dc] text-[#9a561b]"><PackageSearch className="size-[18px]" /></span><div><h3 className="text-sm font-extrabold text-stone-950">Scorta bassa: Olaplex N°3</h3><p className="mt-1 text-sm leading-5 text-stone-600">Questo resta nel Magazzino. Non è un toast e non fa suoni: è un problema da risolvere, non un semplice aggiornamento.</p></div></div></section>
      <section className="rounded-2xl border border-emerald-200 bg-[#f6fcf8] p-4" role="status"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Check className="size-[18px]" /></span><div><h3 className="text-sm font-extrabold text-stone-950">Pagamento registrato</h3><p className="mt-1 text-sm leading-5 text-stone-600">Micro-conferma silenziosa. Un suono per ogni salvataggio diventa rumore dopo pochi minuti.</p></div></div></section>
    </div>
    <aside className="relative min-h-[370px] overflow-hidden rounded-2xl border border-stone-200 bg-[#f6f2f4] p-5"><p className="text-sm font-extrabold text-stone-800">Come appare nell’app</p><p className="mt-1 text-sm leading-5 text-stone-500">Radix gestisce focus, coda, pausa su hover e swipe. Il visual resta EsseBeauty.</p><Toast.Viewport className="absolute inset-x-5 top-24 m-0 flex list-none flex-col gap-3 p-0 outline-none">{preview === "whatsapp" && <WhatsAppIncomingToast body="Posso spostare l’appuntamento di domani alle 17:00?" onDismiss={() => setPreview(null)} onOpen={() => openPreview("whatsapp")} title="Nuovo messaggio da Elena Ferri" />}{preview === "booking" && <BookingArrivalToast body="Giulia Bianchi · Colore e piega · 15:30" onDismiss={() => setPreview(null)} onOpen={() => openPreview("booking")} startsAt="2026-09-12T15:30:00" title="Nuova prenotazione online" />}</Toast.Viewport>{!preview && <div className="absolute inset-x-5 top-28 rounded-xl border border-dashed border-stone-300 bg-white/70 p-5 text-center text-sm text-stone-500">Scegli un evento per riprodurre la sua notifica.</div>}{notice && <p className="absolute inset-x-5 bottom-5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#792f59]" role="status">{notice}</p>}</aside>
    <SaveToast visible>Trattamento aggiornato. Le modifiche sono subito disponibili in agenda.</SaveToast>
  </div></Toast.Provider>;
}
