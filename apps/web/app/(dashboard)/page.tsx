"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, EmptyState, InboxItem, InlineError, PageHeader, PageSkeleton, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../lib/auth-context";
import { OperationalInbox } from "./_components/OperationalInbox";
import { TodayTimeline } from "./_components/TodayTimeline";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };
interface Appointment { id: string; starts_at: string; customer_name: string; service_name: string; staff_name: string; color: string; status: string; }
interface NotificationItem { body?: string; category?: string; created_at: string; href?: string | null; id: string; priority?: string; title: string; type: string; unread: boolean; }
interface NotificationResponse { items: NotificationItem[]; unread_count: number; }

function useResource<T>(url: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(url, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setState({ status: "ready", data: (await response.json()) as T });
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}

function notificationLabel(item: NotificationItem) {
  if (item.type === "staff_availability_request") return "Richiesta staff";
  if (item.type === "online_booking_received") return "Prenotazione online";
  return item.category ?? "Attività";
}

export default function DashboardPage() {
  const { loading, salon, user } = useAuth();
  const inventoryEnabled = useModuleEnabled(MODULE_KEYS.INVENTORY);
  const reviewsEnabled = useModuleEnabled(MODULE_KEYS.REVIEWS);
  const waitlistEnabled = useModuleEnabled(MODULE_KEYS.WAITLIST);
  const ranges = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const week = new Date(today); week.setDate(week.getDate() + 7);
    return { today, tomorrow, week };
  }, []);
  const salonPath = salon ? `${api}/api/salons/${salon.id}` : null;
  const todayAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.tomorrow.toISOString()}` : null);
  const weekAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.week.toISOString()}` : null);
  const notifications = useResource<NotificationResponse>(salonPath ? `${salonPath}/notifications` : null);
  const inventory = useResource<unknown[]>(salonPath && inventoryEnabled ? `${salonPath}/inventory?low_stock=true` : null);
  const reviews = useResource<unknown[]>(salonPath && reviewsEnabled ? `${salonPath}/reviews?published=false` : null);
  const waitlist = useResource<unknown[]>(salonPath && waitlistEnabled ? `${salonPath}/waitlist?status=waiting` : null);
  const operationalToday = todayAppointments.status === "ready"
    ? todayAppointments.data.filter((item) => item.status === "pending" || item.status === "confirmed")
    : [];
  const operationalWeek = weekAppointments.status === "ready"
    ? weekAppointments.data.filter((item) => item.status === "pending" || item.status === "confirmed")
    : [];

  if (loading) return <AppPage maxWidth="max-w-[1600px]"><PageSkeleton /></AppPage>;
  if (!user || !salon) return <AppPage maxWidth="max-w-[1600px]"><EmptyState action={<Link className="font-bold text-[#792f59]" href="/login">Vai al login</Link>} description="Accedi nuovamente per continuare." title="Sessione non disponibile" /></AppPage>;

  const priorities = notifications.status === "ready" ? notifications.data.items
    .filter((item) => item.unread)
    .sort((left, right) => Number(right.priority === "high") - Number(left.priority === "high"))
    .slice(0, 5) : [];
  const todayLabel = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(ranges.today);
  const firstName = user.full_name.trim().split(/\s+/)[0] || user.full_name;
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(ranges.today);
    date.setDate(date.getDate() + offset);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const appointments = operationalWeek.filter((item) => {
      const start = new Date(item.starts_at);
      return start >= date && start < nextDate;
    }).sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
    return { appointments, date };
  });
  const actionQueues: Array<{ count: number; description: string; href: string; label: string }> = [];
  if (inventory.status === "ready" && inventory.data.length > 0) actionQueues.push({ count: inventory.data.length, description: "Prodotti da riordinare o verificare", href: "/inventory", label: "Scorte basse" });
  if (reviews.status === "ready" && reviews.data.length > 0) actionQueues.push({ count: reviews.data.length, description: "Recensioni in attesa di gestione", href: "/reviews", label: "Recensioni da gestire" });
  if (waitlist.status === "ready" && waitlist.data.length > 0) actionQueues.push({ count: waitlist.data.length, description: "Clienti in attesa di una disponibilità", href: "/waitlist", label: "Lista d’attesa" });
  const actionQueuesLoading = (inventoryEnabled && inventory.status === "loading")
    || (reviewsEnabled && reviews.status === "loading")
    || (waitlistEnabled && waitlist.status === "loading");

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        actionsAlign="right"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-[#792f59] bg-[#792f59] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#66264b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href="/calendar/appointments/new">Nuovo appuntamento</Link>
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href="/calendar">Apri agenda</Link>
          </div>
        }
        eyebrow={todayLabel}
        subtitle={`Agenda, priorità e carico dei prossimi giorni per ${salon.name}.`}
        title={`Buongiorno, ${firstName}`}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <TodayTimeline action={<Link className="text-sm font-bold text-[#792f59] hover:underline" href="/calendar">Apri calendario</Link>}>
          {todayAppointments.status === "loading" && <div aria-label="Caricamento agenda" className="space-y-3" role="status">{[1, 2, 3].map((item) => <div aria-hidden="true" className="h-16 animate-pulse rounded-xl bg-stone-100" key={item} />)}</div>}
          {todayAppointments.status === "error" && <InlineError>Non è stato possibile caricare l’agenda.</InlineError>}
          {todayAppointments.status === "ready" && operationalToday.length === 0 && <EmptyState action={<Link className="font-bold text-[#792f59]" href="/calendar/appointments/new">Crea appuntamento</Link>} description="Non ci sono appuntamenti ancora da gestire." title="Agenda operativa libera" />}
          {todayAppointments.status === "ready" && operationalToday.length > 0 && (
            <div className="divide-y divide-stone-100">
              {operationalToday.slice(0, 7).map((item) => (
                <Link className="grid grid-cols-[auto_54px_1fr_auto] items-center gap-3 rounded-xl py-3 transition-colors hover:bg-[#faf7f9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 sm:px-2" href={`/calendar/appointments/${item.id}`} key={item.id}>
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <time className="font-black text-[#402334]">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</time>
                  <span className="min-w-0"><b className="block truncate">{item.customer_name}</b><small className="block truncate text-stone-500">{item.service_name} · {item.staff_name}</small></span>
                  <ChevronRight aria-hidden="true" className="size-4 text-stone-400" />
                </Link>
              ))}
            </div>
          )}
        </TodayTimeline>

        <OperationalInbox action={<button className="rounded-lg text-sm font-bold text-[#792f59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" onClick={() => window.dispatchEvent(new Event("esse:open-notifications"))} type="button">Centro notifiche</button>}>
          {notifications.status === "loading" && <div aria-label="Caricamento priorità" className="space-y-3" role="status">{[1, 2, 3].map((item) => <div aria-hidden="true" className="h-16 animate-pulse rounded-xl bg-stone-100" key={item} />)}</div>}
          {notifications.status === "error" && <InlineError>Priorità non disponibili.</InlineError>}
          {notifications.status === "ready" && priorities.length === 0 && actionQueues.length === 0 && !actionQueuesLoading && <EmptyState description="Non risultano richieste o anomalie da gestire." title="Tutto sotto controllo" />}
          {priorities.map((item) => (
            item.href ? (
            <Link className="mb-2 block rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:border-[#b85888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={item.href} key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8f3a68]">{notificationLabel(item)}</p><b className="mt-1 block text-sm">{item.title}</b></div>
                {item.priority === "high" && <span className="text-[10px] font-black uppercase tracking-[.12em] text-rose-700">Urgente</span>}
              </div>
              {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{item.body}</p>}
            </Link>
            ) : (
              <InboxItem description={item.body} key={item.id} label={<><span className="block text-[10px] font-black uppercase tracking-[.14em] text-[#8f3a68]">{notificationLabel(item)}</span><span className="mt-1 block">{item.title}</span></>} priority={item.priority === "high" ? "high" : "normal"} />
            )
          ))}
          {actionQueues.length > 0 && (
            <div className={`${priorities.length > 0 ? "mt-3 border-t border-stone-100 pt-3" : ""} space-y-2`}>
              {actionQueues.map((item) => (
                <Link className="flex min-h-16 items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:border-[#b85888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={item.href} key={item.href}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#faf3f7] text-sm font-bold text-[#792f59]">{item.count}</span>
                  <span className="min-w-0 flex-1"><b className="block text-sm">{item.label}</b><small className="block text-stone-600">{item.description}</small></span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-stone-400" />
                </Link>
              ))}
            </div>
          )}
          {notifications.status === "ready" && priorities.length === 0 && actionQueuesLoading && <div aria-label="Caricamento attività operative" className="h-16 animate-pulse rounded-xl bg-stone-100" role="status" />}
        </OperationalInbox>
      </div>

      <div className="mt-5">
        <SectionCard actions={<Link className="text-sm font-bold text-[#792f59] hover:underline" href="/calendar">Pianifica la settimana</Link>} subtitle="Carico degli appuntamenti confermati o in attesa nei prossimi sette giorni." title="Prossimi sette giorni">
          {weekAppointments.status === "loading" && <div aria-label="Caricamento settimana" className="space-y-2" role="status">{[1, 2, 3, 4].map((item) => <div aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-stone-100" key={item} />)}</div>}
          {weekAppointments.status === "error" && <InlineError>Non è stato possibile caricare la settimana.</InlineError>}
          {weekAppointments.status === "ready" && (
            <div className="divide-y divide-stone-100">
              {weekDays.map(({ appointments, date }, index) => {
                const first = appointments[0];
                const last = appointments[appointments.length - 1];
                const dayName = index === 0 ? "Oggi" : new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(date);
                const dateLabel = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(date);
                return (
                  <div className="grid min-h-16 items-center gap-2 py-3 sm:grid-cols-[150px_1fr_auto] sm:gap-4" key={date.toISOString()}>
                    <div><p className="font-bold capitalize text-stone-950">{dayName}</p><p className="text-xs text-stone-600">{dateLabel}</p></div>
                    {appointments.length > 0 ? (
                      <p className="text-sm text-stone-700"><strong>{appointments.length} {appointments.length === 1 ? "appuntamento" : "appuntamenti"}</strong><span className="text-stone-600"> · primo alle {new Date(first!.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}{appointments.length > 1 ? ` · ultimo alle ${new Date(last!.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}</span></p>
                    ) : <p className="text-sm text-stone-600">Nessun appuntamento</p>}
                    {appointments.length > 0 && <Link aria-label={`Apri il primo appuntamento di ${dayName}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[#792f59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={`/calendar/appointments/${first!.id}`}>Apri il primo<ChevronRight aria-hidden="true" className="size-4" /></Link>}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </AppPage>
  );
}
