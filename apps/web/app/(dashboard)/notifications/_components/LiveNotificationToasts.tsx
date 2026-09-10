"use client";

import * as Toast from "@radix-ui/react-toast";
import { CalendarDays, ChevronRight, X } from "lucide-react";

import { WhatsAppIcon } from "../../_components/Icons";

function ticketDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return { day: "—", month: "" };
  return {
    day: new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date).replace(".", "").toUpperCase(),
  };
}

export function WhatsAppIncomingToast({ body, onDismiss, onOpen, title }: { body?: string; onDismiss(): void; onOpen(): void; title: string }) {
  return <Toast.Root className="pointer-events-auto group relative overflow-visible" duration={8_000} onOpenChange={(open) => { if (!open) onDismiss(); }} type="foreground">
    <div className="relative overflow-hidden rounded-xl border-[1.5px] border-[#b8dfc9] bg-white shadow-[0_14px_30px_rgb(28_25_27_/_0.14)]">
      <div className="flex min-w-0 items-start gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f7ee] text-[#237449]"><WhatsAppIcon aria-hidden="true" className="size-5" /></span>
        <Toast.Title className="min-w-0 flex-1 text-left text-sm font-extrabold text-stone-950">{title}</Toast.Title>
        <Toast.Close aria-label="Chiudi messaggio" className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"><X className="size-4" /></Toast.Close>
      </div>
      {body && <Toast.Description className="px-4 pb-3 text-sm leading-5 text-stone-600">{body}</Toast.Description>}
      <div className="flex items-center justify-between border-t border-[#e4f3e9] px-4 py-2.5"><span className="text-xs font-semibold text-[#237449]">WhatsApp</span><Toast.Action altText="Apri la conversazione" asChild><button className="inline-flex items-center gap-1 text-xs font-extrabold text-[#237449] hover:underline" onClick={onOpen} type="button">Apri chat <ChevronRight className="size-3.5" /></button></Toast.Action></div>
      <div className="h-1 origin-left bg-[#25D366] motion-safe:animate-[notification-life_8s_linear_forwards]" />
    </div>
    <span aria-hidden="true" className="absolute -bottom-[10px] right-5 z-0 h-3 w-[18px] border-r border-b border-[#b8dfc9] bg-white" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
  </Toast.Root>;
}

export function BookingArrivalToast({ body, onDismiss, onOpen, startsAt, title }: { body?: string | null; onDismiss(): void; onOpen(): void; startsAt?: string; title: string }) {
  const date = ticketDate(startsAt);
  return <Toast.Root className="pointer-events-auto overflow-hidden rounded-xl border-[1.5px] border-[#d7a6c1] bg-white shadow-[0_14px_30px_rgb(28_25_27_/_0.14)]" duration={9_000} onOpenChange={(open) => { if (!open) onDismiss(); }} type="foreground">
    <div className="flex items-stretch">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-[#792f59] px-2 text-center text-white"><span className="text-2xl font-black leading-none">{date.day}</span>{date.month && <span className="mt-1 text-[10px] font-bold">{date.month}</span>}</div>
      <div className="min-w-0 flex-1 p-4"><div className="flex items-start gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f3e2eb] text-[#792f59]"><CalendarDays className="size-4" /></span><div className="min-w-0 flex-1"><Toast.Title className="text-sm font-extrabold text-stone-950">{title}</Toast.Title>{body && <Toast.Description className="mt-0.5 line-clamp-2 text-sm leading-5 text-stone-600">{body}</Toast.Description>}</div><Toast.Close aria-label="Chiudi prenotazione" className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"><X className="size-4" /></Toast.Close></div><Toast.Action altText="Gestisci richiesta appuntamento" asChild><button className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#402334] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2d1824] active:translate-y-px" onClick={onOpen} type="button">Gestisci richiesta <ChevronRight className="size-3.5" /></button></Toast.Action></div>
    </div>
    <div className="h-1 bg-[#792f59] motion-safe:animate-[notification-life_9s_linear_forwards]" />
  </Toast.Root>;
}
