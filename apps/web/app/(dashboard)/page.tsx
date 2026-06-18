"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, EmptyState, InlineError, PageHeader, PageSkeleton, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };
interface Appointment { id: string; starts_at: string; customer_name: string; service_name: string; staff_name: string; color: string; }
interface CustomerResponse { total: number; }
interface StaffMember { id: string; displayName: string; }
interface LoyaltySummary { leaders: Array<{ customer_id: string; name: string; total_points: number }>; }
interface NotificationItem { body?: string; category?: string; created_at: string; href?: string | null; id: string; priority?: string; title: string; type: string; }
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

function countOf<T>(state: Loadable<T>, count: (data: T) => number) {
  return state.status === "ready" ? count(state.data) : "—";
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
  const loyaltyEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const ranges = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const week = new Date(today); week.setDate(week.getDate() + 7);
    return { today, tomorrow, week };
  }, []);
  const salonPath = salon ? `${api}/api/salons/${salon.id}` : null;
  const todayAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.tomorrow.toISOString()}` : null);
  const weekAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.week.toISOString()}` : null);
  const customers = useResource<CustomerResponse>(salonPath ? `${salonPath}/customers` : null);
  const staff = useResource<StaffMember[]>(salonPath ? `${salonPath}/staff?active=true` : null);
  const notifications = useResource<NotificationResponse>(salonPath ? `${salonPath}/notifications` : null);
  const inventory = useResource<unknown[]>(salonPath && inventoryEnabled ? `${salonPath}/inventory?low_stock=true` : null);
  const reviews = useResource<unknown[]>(salonPath && reviewsEnabled ? `${salonPath}/reviews?published=false` : null);
  const waitlist = useResource<unknown[]>(salonPath && waitlistEnabled ? `${salonPath}/waitlist?status=waiting` : null);
  const loyalty = useResource<LoyaltySummary>(salonPath && loyaltyEnabled ? `${salonPath}/loyalty/summary` : null);

  if (loading) return <AppPage maxWidth="max-w-7xl"><PageSkeleton /></AppPage>;
  if (!user || !salon) return <AppPage><EmptyState action={<Link className="font-bold text-[#792f59]" href="/login">Vai al login</Link>} description="Accedi nuovamente per continuare." title="Sessione non disponibile" /></AppPage>;

  const priorities = notifications.status === "ready" ? notifications.data.items.filter((item) => !item.href || item.type === "staff_availability_request" || item.type === "online_booking_received").slice(0, 5) : [];

  return (
    <AppPage maxWidth="max-w-7xl">
      <PageHeader
        actions={<Link className="inline-flex min-h-11 items-center rounded-xl bg-[#402334] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5f2447]" href="/calendar/appointments/new">Nuovo appuntamento</Link>}
        eyebrow="Il tuo salone"
        subtitle={`Bentornato, ${user.full_name}. Agenda, attività e priorità sono raccolte nello stesso spazio.`}
        title={`Oggi da ${salon.name}`}
      />

      <StatGrid className="md:grid-cols-4">
        <StatCard detail="Appuntamenti in giornata" label="Oggi" value={countOf(todayAppointments, (items) => items.length)} />
        <StatCard detail="Carico dei prossimi 7 giorni" label="Settimana" value={countOf(weekAppointments, (items) => items.length)} />
        <StatCard detail="Profili presenti nel CRM" label="Clienti" value={countOf(customers, (item) => item.total)} />
        <StatCard detail="Richiedono attenzione" label="Da fare" value={notifications.status === "ready" ? notifications.data.unread_count : "—"} />
      </StatGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.8fr]">
        <SectionCard
          actions={<Link className="text-sm font-bold text-[#792f59] hover:underline" href="/calendar">Apri calendario</Link>}
          subtitle="Il lavoro della giornata, in ordine cronologico."
          title="Agenda di oggi"
        >
          {todayAppointments.status === "loading" && <div className="space-y-3">{[1, 2, 3].map((item) => <div className="h-16 animate-pulse rounded-xl bg-stone-100" key={item} />)}</div>}
          {todayAppointments.status === "error" && <InlineError>Non è stato possibile caricare l’agenda.</InlineError>}
          {todayAppointments.status === "ready" && todayAppointments.data.length === 0 && <EmptyState action={<Link className="font-bold text-[#792f59]" href="/calendar/appointments/new">Crea appuntamento</Link>} description="La giornata è libera." title="Nessun appuntamento oggi" />}
          {todayAppointments.status === "ready" && todayAppointments.data.length > 0 && (
            <div className="divide-y divide-stone-100">
              {todayAppointments.data.slice(0, 7).map((item) => (
                <Link className="grid grid-cols-[auto_54px_1fr_auto] items-center gap-3 py-3 transition hover:bg-[#faf7f9] sm:px-2" href={`/calendar/appointments/${item.id}`} key={item.id}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <time className="font-black text-[#402334]">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</time>
                  <span className="min-w-0"><b className="block truncate">{item.customer_name}</b><small className="block truncate text-stone-500">{item.service_name} · {item.staff_name}</small></span>
                  <span className="text-stone-300">›</span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          actions={<button className="text-sm font-bold text-[#792f59]" onClick={() => window.dispatchEvent(new Event("esse:open-notifications"))} type="button">Centro notifiche</button>}
          className="border-[#dec4d2] bg-[#fffafd]"
          subtitle="Richieste e nuovi ingressi da gestire."
          title="Da fare"
        >
          {notifications.status === "loading" && <div className="space-y-3">{[1, 2, 3].map((item) => <div className="h-16 animate-pulse rounded-xl bg-white" key={item} />)}</div>}
          {notifications.status === "error" && <InlineError>Priorità non disponibili.</InlineError>}
          {notifications.status === "ready" && priorities.length === 0 && <EmptyState description="Non ci sono attività urgenti." title="Tutto sotto controllo" />}
          {priorities.map((item) => (
            <Link className="mb-2 block rounded-xl border border-[#eadde4] bg-white p-3 transition hover:border-[#b85888]" href={item.href ?? "#"} key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8f3a68]">{notificationLabel(item)}</p><b className="mt-1 block text-sm">{item.title}</b></div>
                <StatusBadge status={item.priority === "high" ? "waiting" : "active"}>{item.priority ?? "normal"}</StatusBadge>
              </div>
              {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{item.body}</p>}
            </Link>
          ))}
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <SectionCard subtitle="Disponibilità immediata del team." title="Staff operativo">
          {staff.status === "loading" ? <div className="h-20 animate-pulse rounded-xl bg-stone-100" /> : staff.status === "error" ? <InlineError>Dati staff non disponibili.</InlineError> : (
            <div className="flex items-end justify-between gap-4"><div><strong className="text-4xl tracking-[-.04em] text-[#402334]">{staff.data.length}</strong><p className="mt-1 text-sm text-stone-500">collaboratori attivi</p></div><Link className="text-sm font-bold text-[#792f59]" href="/staff">Apri team</Link></div>
          )}
        </SectionCard>

        <SectionCard subtitle="Indicatori collegati alle aree operative." title="Moduli attivi">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {inventoryEnabled && <Link className="rounded-xl border border-stone-200 p-3 hover:border-[#b85888]" href="/inventory"><small className="text-stone-500">Scorte basse</small><b className="mt-1 block text-2xl">{countOf(inventory, (items) => items.length)}</b></Link>}
            {reviewsEnabled && <Link className="rounded-xl border border-stone-200 p-3 hover:border-[#b85888]" href="/reviews"><small className="text-stone-500">Recensioni</small><b className="mt-1 block text-2xl">{countOf(reviews, (items) => items.length)}</b></Link>}
            {waitlistEnabled && <Link className="rounded-xl border border-stone-200 p-3 hover:border-[#b85888]" href="/waitlist"><small className="text-stone-500">Lista d’attesa</small><b className="mt-1 block text-2xl">{countOf(waitlist, (items) => items.length)}</b></Link>}
            {loyaltyEnabled && <Link className="rounded-xl border border-stone-200 p-3 hover:border-[#b85888]" href="/settings/loyalty"><small className="text-stone-500">Top fedeltà</small><b className="mt-1 block truncate text-sm">{loyalty.status === "ready" ? loyalty.data.leaders[0]?.name ?? "Nessun dato" : "—"}</b></Link>}
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
