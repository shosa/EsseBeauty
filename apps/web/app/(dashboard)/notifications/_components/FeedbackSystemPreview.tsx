"use client";

import { useRef, useState, type ReactNode } from "react";
import * as Toast from "@radix-ui/react-toast";
import { SaveToast } from "@esse-beauty/ui";
import { createUISFX, type CueName, type UISFXPlayer } from "uisfx";
import { BellRing, CalendarDays, Check, ChevronRight, PackageSearch, Volume2, X } from "lucide-react";

import { WhatsAppIcon } from "../../_components/Icons";
type PreviewKind = "booking" | "whatsapp" | null;

function PreviewButton({ children, cue, onClick, play }: { children: ReactNode; cue: CueName; onClick: () => void; play(cue: CueName): void }) {
  return <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 transition hover:border-[#b87898] hover:text-[#792f59] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59]" onClick={() => { play(cue); onClick(); }} type="button"><Volume2 className="size-4" />{children}</button>;
}

export function WhatsAppIncomingToast({ onOpen }: { onOpen?: () => void }) {
  return <Toast.Root className="group relative overflow-visible" duration={8_000} type="foreground">
    <div className="relative overflow-hidden rounded-xl border border-[#b8dfc9] bg-white shadow-[0_16px_36px_rgb(35_116_73_/_0.16)]">
      <div className="flex min-w-0 items-start gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f7ee] text-[#237449]"><WhatsAppIcon aria-hidden="true" className="size-5" /></span>
        <Toast.Title className="min-w-0 flex-1 text-left text-sm font-extrabold text-stone-950">Nuovo messaggio da Elena Ferri</Toast.Title>
        <Toast.Close aria-label="Chiudi messaggio" className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"><X className="size-4" /></Toast.Close>
      </div>
      <Toast.Description className="px-4 pb-3 text-sm leading-5 text-stone-600">Posso spostare l’appuntamento di domani alle 17:00?</Toast.Description>
      <div className="flex items-center justify-between border-t border-[#e4f3e9] px-4 py-2.5"><span className="text-xs font-semibold text-[#237449]">WhatsApp</span><Toast.Action altText="Apri la conversazione con Elena" asChild><button className="inline-flex items-center gap-1 text-xs font-extrabold text-[#237449] hover:underline" onClick={onOpen} type="button">Apri chat <ChevronRight className="size-3.5" /></button></Toast.Action></div>
      <div className="h-1 origin-left bg-[#25D366] motion-safe:animate-[notification-life_8s_linear_forwards]" />
    </div>
    <span aria-hidden="true" className="absolute -bottom-[10px] right-5 z-0 h-3 w-[18px] border-r border-b border-[#b8dfc9] bg-white" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
  </Toast.Root>;
}

export function BookingArrivalToast({ onOpen }: { onOpen?: () => void }) {
  return <Toast.Root className="overflow-hidden rounded-xl border border-[#d7a6c1] bg-white shadow-[0_16px_36px_rgb(121_47_89_/_0.16)]" duration={9_000} type="foreground">
    <div className="flex items-stretch">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-[#792f59] px-2 text-center text-white"><span className="text-[10px] font-bold uppercase tracking-[.08em]">Ven</span><span className="mt-0.5 text-2xl font-black leading-none">12</span><span className="mt-1 text-[10px] font-bold">SET</span></div>
      <div className="min-w-0 flex-1 p-4"><div className="flex items-start gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f3e2eb] text-[#792f59]"><CalendarDays className="size-4" /></span><div className="min-w-0 flex-1"><Toast.Title className="text-sm font-extrabold text-stone-950">Nuova prenotazione online</Toast.Title><Toast.Description className="mt-0.5 text-sm text-stone-600">Giulia Bianchi · Colore e piega · 15:30</Toast.Description></div><Toast.Close aria-label="Chiudi prenotazione" className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"><X className="size-4" /></Toast.Close></div><Toast.Action altText="Apri la richiesta di Giulia Bianchi" asChild><button className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#402334] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2d1824] active:translate-y-px" onClick={onOpen} type="button">Gestisci richiesta <ChevronRight className="size-3.5" /></button></Toast.Action></div>
    </div>
    <div className="h-1 bg-[#792f59] motion-safe:animate-[notification-life_9s_linear_forwards]" />
  </Toast.Root>;
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
    <aside className="relative min-h-[370px] overflow-hidden rounded-2xl border border-stone-200 bg-[#f6f2f4] p-5"><p className="text-sm font-extrabold text-stone-800">Come appare nell’app</p><p className="mt-1 text-sm leading-5 text-stone-500">Radix gestisce focus, coda, pausa su hover e swipe. Il visual resta EsseBeauty.</p><Toast.Viewport className="absolute inset-x-5 top-24 m-0 flex list-none flex-col gap-3 p-0 outline-none">{preview === "whatsapp" && <WhatsAppIncomingToast onOpen={() => openPreview("whatsapp")} />}{preview === "booking" && <BookingArrivalToast onOpen={() => openPreview("booking")} />}</Toast.Viewport>{!preview && <div className="absolute inset-x-5 top-28 rounded-xl border border-dashed border-stone-300 bg-white/70 p-5 text-center text-sm text-stone-500">Scegli un evento per riprodurre la sua notifica.</div>}{notice && <p className="absolute inset-x-5 bottom-5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#792f59]" role="status">{notice}</p>}</aside>
    <SaveToast visible>Trattamento aggiornato. Le modifiche sono subito disponibili in agenda.</SaveToast>
  </div></Toast.Provider>;
}
