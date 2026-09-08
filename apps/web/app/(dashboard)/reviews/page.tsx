"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useReducer, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, Dialog, EmptyState, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import {
  initialReviewMutationState,
  initialReviewListState,
  requestReviewMutation,
  reviewListReducer,
  reviewMutationReducer,
  type ReviewItem,
} from "./reviews-controller";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Channel = "app" | "email" | "whatsapp";
type CollectionScope = "all" | "pending" | "reviewed" | "sent";
type ReviewScope = "all" | "unanswered" | "private" | "published";
const CHANNEL_LABELS: Record<Channel, string> = { app: "App", email: "Email", whatsapp: "WhatsApp" };
const COLLECTION_PAGE_SIZE = 10;
interface ReviewSettings { automaticEnabled: boolean; channels: Channel[]; delayPreset: "immediate" | "one_hour" | "three_hours" | "next_day" | "two_days" }
interface CollectionItem { appointment_date: string; appointment_id: string; customer_email?: string | null; customer_name: string; customer_phone?: string | null; customer_push_subscribed?: boolean; deliveries: Array<{ channel: Channel; delivered_at?: string | null; failure_reason?: string | null; generation: number; scheduled_at: string; status: string }>; invitation_consumed_at?: string | null; review_id?: string | null; service_name: string }
const presetOptions = [["immediate", "Subito"], ["one_hour", "Dopo 1 ora"], ["three_hours", "Dopo 3 ore"], ["next_day", "Il giorno successivo"], ["two_days", "Dopo 2 giorni"]] as const;

function stars(rating: number) {
  return (
    <span aria-label={`${rating} stelle su 5`} className="tracking-[.08em] text-[#9b3f70]">
      {"★".repeat(rating)}
      <span aria-hidden="true" className="text-stone-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const { hasPermission, salon } = useAuth();
  const pathname = usePathname();
  const activeTab = pathname.startsWith("/reviews/requests") ? "requests" : "overview";
  const [list, dispatchList] = useReducer(reviewListReducer, initialReviewListState);
  const [management, dispatchManagement] = useReducer(reviewMutationReducer, initialReviewMutationState);
  const items = list.items;
  const { reply, selected } = management;
  const [settings, setSettings] = useState<ReviewSettings>({ automaticEnabled: false, channels: ["email"], delayPreset: "one_hour" });
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [collectionError, setCollectionError] = useState("");
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [collectionScope, setCollectionScope] = useState<CollectionScope>("all");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [manualTarget, setManualTarget] = useState<CollectionItem>();
  const [manualChannels, setManualChannels] = useState<Channel[]>(["email"]);
  const [manualPending, setManualPending] = useState(false);
  const [reviewScope, setReviewScope] = useState<ReviewScope>("all");
  const [reviewQuery, setReviewQuery] = useState("");
  const [visibleReviewCount, setVisibleReviewCount] = useState(12);
  const load = async () => {
    if (!salon) return;
    dispatchList({ type: "load" });
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/reviews`, { credentials: "include" });
      if (!response.ok) throw new Error("REVIEW_LIST_FAILED");
      dispatchList({ items: await response.json() as ReviewItem[], type: "success" });
    } catch {
      dispatchList({ error: "Caricamento recensioni non riuscito. Riprova.", type: "failure" });
    }
  };
  useEffect(() => { void load(); }, [salon]);
  const loadCollection = async () => {
    if (!salon) return;
    setCollectionLoading(true); setCollectionError("");
    try {
      const [settingsResponse, collectionResponse] = await Promise.all([fetch(`${api}/api/salons/${salon.id}/reviews/request-settings`, { credentials: "include" }), fetch(`${api}/api/salons/${salon.id}/reviews/collection`, { credentials: "include" })]);
      if (!settingsResponse.ok || !collectionResponse.ok) throw new Error();
      setSettings(await settingsResponse.json()); setCollection(await collectionResponse.json());
    } catch { setCollectionError("Impossibile caricare la raccolta recensioni."); }
    finally { setCollectionLoading(false); }
  };
  useEffect(() => { void loadCollection(); }, [salon]);
  const average = useMemo(() => items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0, [items]);
  const published = useMemo(() => items.filter((item) => item.published).length, [items]);
  const unanswered = useMemo(() => items.filter((item) => !item.reply).length, [items]);
  const ratingDistribution = useMemo(() => [5, 4, 3, 2, 1].map((rating) => ({
    count: items.filter((item) => item.rating === rating).length,
    rating,
  })), [items]);
  const collectionCounts = useMemo(() => ({
    all: collection.length,
    pending: collection.filter((item) => !item.review_id && item.deliveries.length === 0).length,
    reviewed: collection.filter((item) => Boolean(item.review_id)).length,
    sent: collection.filter((item) => !item.review_id && item.deliveries.length > 0).length,
  }), [collection]);
  const filteredCollection = useMemo(() => {
    const query = collectionQuery.trim().toLocaleLowerCase("it-IT");
    return collection.filter((item) => {
      const matchesScope = collectionScope === "all"
        || (collectionScope === "pending" && !item.review_id && item.deliveries.length === 0)
        || (collectionScope === "sent" && !item.review_id && item.deliveries.length > 0)
        || (collectionScope === "reviewed" && Boolean(item.review_id));
      const searchable = `${item.customer_name} ${item.service_name} ${item.customer_email ?? ""} ${item.customer_phone ?? ""}`.toLocaleLowerCase("it-IT");
      return matchesScope && (!query || searchable.includes(query));
    });
  }, [collection, collectionQuery, collectionScope]);
  const collectionPageCount = Math.max(1, Math.ceil(filteredCollection.length / COLLECTION_PAGE_SIZE));
  const paginatedCollection = filteredCollection.slice((collectionPage - 1) * COLLECTION_PAGE_SIZE, collectionPage * COLLECTION_PAGE_SIZE);
  const filteredReviews = useMemo(() => {
    const query = reviewQuery.trim().toLocaleLowerCase("it-IT");
    return items.filter((item) => {
      const matchesScope = reviewScope === "all"
        || (reviewScope === "unanswered" && !item.reply)
        || (reviewScope === "private" && !item.published)
        || (reviewScope === "published" && item.published);
      const matchesQuery = !query || `${item.customer_name} ${item.comment ?? ""}`.toLocaleLowerCase("it-IT").includes(query);
      return matchesScope && matchesQuery;
    });
  }, [items, reviewQuery, reviewScope]);

  useEffect(() => { setVisibleReviewCount(12); }, [reviewQuery, reviewScope]);
  useEffect(() => { setCollectionPage(1); }, [collectionQuery, collectionScope]);
  useEffect(() => { setCollectionPage((page) => Math.min(page, collectionPageCount)); }, [collectionPageCount]);

  async function saveReply() {
    if (!salon || !selected) return;
    dispatchManagement({ type: "begin" });
    try {
      await requestReviewMutation(fetch, `${api}/api/salons/${salon.id}/reviews/${selected.id}/reply`, { reply });
    } catch (error) {
      dispatchManagement({ error: error instanceof Error ? error.message : "Salvataggio non riuscito.", type: "failure" });
      return;
    }
    dispatchManagement({ type: "replySuccess" });
    await load();
  }

  async function setPublished(item: ReviewItem, nextPublished: boolean) {
    if (!salon) return;
    dispatchManagement({ type: "begin" });
    try {
      await requestReviewMutation(fetch, `${api}/api/salons/${salon.id}/reviews/${item.id}/publish`, { published: nextPublished });
    } catch (error) {
      dispatchManagement({ error: error instanceof Error ? error.message : "Salvataggio non riuscito.", type: "failure" });
      return;
    }
    dispatchManagement({ type: "mutationSuccess" });
    await load();
  }

  function toggleChannel(channel: Channel, current: Channel[], apply: (channels: Channel[]) => void) {
    const next = current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel];
    if (next.length > 0) apply(next);
  }

  async function saveSettings() {
    if (!salon) return;
    setSettingsMessage("Salvataggio…");
    const response = await fetch(`${api}/api/salons/${salon.id}/reviews/request-settings`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
    setSettingsMessage(response.ok ? "Configurazione salvata." : "Salvataggio non riuscito.");
  }

  function openManual(item: CollectionItem) {
    setManualTarget(item);
    setManualChannels(settings.channels.filter((channel) => channel === "email" ? Boolean(item.customer_email) : channel === "whatsapp" ? Boolean(item.customer_phone) : Boolean(item.customer_push_subscribed)));
  }

  async function sendManual() {
    if (!salon || !manualTarget || manualChannels.length === 0) return;
    setManualPending(true); setCollectionError("");
    const resend = manualTarget.deliveries.length > 0;
    const response = await fetch(`${api}/api/salons/${salon.id}/reviews/collection/${manualTarget.appointment_id}/${resend ? "resend" : "send"}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ channels: manualChannels, confirm: resend }) });
    setManualPending(false);
    if (!response.ok) return setCollectionError("Invio della richiesta non riuscito. Verifica contatti e configurazione dei canali.");
    setManualTarget(undefined); await loadCollection();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="mb-7 border-b border-stone-200 pb-6 sm:mb-8 sm:pb-8">
        <p className="text-sm font-bold text-[#8b3b68]">Voce dei clienti</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl font-bold tracking-[-.035em] text-stone-950 sm:text-5xl">Recensioni</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-stone-600">Ascolta i feedback, rispondi ai clienti e cura ciò che appare nella pagina del salone.</p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 border-l-2 border-[#d7a6c1] pl-4 sm:pl-5">
            <div><strong className="block text-2xl font-black text-stone-950">{items.length}</strong><span className="text-sm text-stone-500">ricevute</span></div>
            <div><strong className="block text-2xl font-black text-stone-950">{published}</strong><span className="text-sm text-stone-500">pubblicate</span></div>
            <div><strong className="block text-2xl font-black text-[#792f59]">{unanswered}</strong><span className="text-sm text-stone-500">da rispondere</span></div>
          </div>
        </div>
      </header>

      {activeTab === "requests" && <div>
      <SectionCard title="Raccolta recensioni" subtitle="Configura gli inviti automatici e gestisci quelli manuali dopo gli appuntamenti completati.">
        <div className="space-y-5">
          <section aria-labelledby="review-automation-title" className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-black" id="review-automation-title">Richiesta automatica</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {settings.automaticEnabled ? `${presetOptions.find(([value]) => value === settings.delayPreset)?.[1]} · ${settings.channels.map((channel) => CHANNEL_LABELS[channel]).join(" + ")}` : "Invio automatico disattivato"}
                </p>
              </div>
              <StatusBadge status={settings.automaticEnabled ? "active" : "inactive"}>{settings.automaticEnabled ? "Attiva" : "Disattivata"}</StatusBadge>
            </div>
            <details className="group mt-4 rounded-xl border border-stone-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-[#792f59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59]">
                Modifica configurazione
                <span aria-hidden="true" className="text-lg transition group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-stone-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-black">Invio dopo il completamento</p>
                  <button aria-pressed={settings.automaticEnabled} className={`min-h-11 rounded-full px-4 text-sm font-bold ${settings.automaticEnabled ? "bg-[#792f59] text-white" : "border border-stone-300 bg-white"}`} onClick={() => setSettings((current) => ({ ...current, automaticEnabled: !current.automaticEnabled }))} type="button">{settings.automaticEnabled ? "Attivo" : "Disattivo"}</button>
                </div>
                <fieldset className="mt-5"><legend className="text-sm font-black">Quando inviare</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{presetOptions.map(([value, label]) => <button aria-pressed={settings.delayPreset === value} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-bold ${settings.delayPreset === value ? "border-[#792f59] bg-[#fff5fa] text-[#792f59]" : "border-stone-200 bg-white"}`} key={value} onClick={() => setSettings((current) => ({ ...current, delayPreset: value }))} type="button">{label}</button>)}</div></fieldset>
                <fieldset className="mt-5"><legend className="text-sm font-black">Canali</legend><div className="mt-2 grid max-w-md grid-cols-3 gap-2">{(["email", "whatsapp", "app"] as Channel[]).map((channel) => <button aria-pressed={settings.channels.includes(channel)} className={`min-h-11 rounded-xl border text-sm font-bold ${settings.channels.includes(channel) ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white"}`} key={channel} onClick={() => toggleChannel(channel, settings.channels, (channels) => setSettings((current) => ({ ...current, channels })))} type="button">{CHANNEL_LABELS[channel]}</button>)}</div><p className="mt-2 text-xs text-stone-600">Ogni canale necessita del relativo contatto cliente; WhatsApp richiede un provider configurato, App richiede notifiche push attive sul telefono del cliente.</p></fieldset>
                <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => void saveSettings()} variant="primary">Salva configurazione</Button>{settingsMessage && <p className="text-sm font-semibold" role="status">{settingsMessage}</p>}</div>
              </div>
            </details>
          </section>

          <section aria-labelledby="review-queue-title">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="font-black" id="review-queue-title">Appuntamenti completati</h2><p className="mt-1 text-sm text-stone-600">Invia ora o reinvia una richiesta già consegnata.</p></div>
              <label className="block lg:w-80"><span className="sr-only">Cerca negli appuntamenti completati</span><input className="min-h-11 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#792f59] focus:bg-white focus:ring-2 focus:ring-[#792f59]/15" onChange={(event) => setCollectionQuery(event.target.value)} placeholder="Cerca cliente o servizio…" type="search" value={collectionQuery} /></label>
            </div>
            <div aria-label="Filtra richieste recensione" className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group">
              {([['all', 'Tutte', collectionCounts.all], ['pending', 'Da inviare', collectionCounts.pending], ['sent', 'Inviate', collectionCounts.sent], ['reviewed', 'Recensione ricevuta', collectionCounts.reviewed]] as const).map(([value, label, count]) => <button aria-pressed={collectionScope === value} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59] ${collectionScope === value ? 'border-[#792f59] bg-[#792f59] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-[#c78baa]'}`} key={value} onClick={() => setCollectionScope(value)} type="button">{label} <span className={collectionScope === value ? 'text-white/70' : 'text-stone-400'}>{count}</span></button>)}
            </div>
            {collectionError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{collectionError}</p>}
            {collectionLoading ? <p className="mt-4 text-sm text-stone-500">Caricamento richieste…</p> : collection.length === 0 ? <EmptyState title="Nessun appuntamento completato" description="Gli appuntamenti conclusi compariranno qui." /> : filteredCollection.length === 0 ? <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center"><h3 className="font-black text-stone-900">Nessun risultato</h3><p className="mt-1 text-sm text-stone-500">Prova a cambiare ricerca o filtro.</p></div> : <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="divide-y divide-stone-200">{paginatedCollection.map((item) => <article className="p-4 transition-colors hover:bg-[#fffafd] sm:p-5" key={item.appointment_id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">{item.customer_name}</h3><p className="text-sm text-stone-600">{item.service_name} · {new Date(item.appointment_date).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="flex items-center gap-2">{item.review_id ? <StatusBadge status="completed">Recensione ricevuta</StatusBadge> : <Button disabled={Boolean(item.invitation_consumed_at)} onClick={() => openManual(item)} variant={item.deliveries.length ? "outline" : "primary"}>{item.deliveries.length ? "Reinvia" : "Invia ora"}</Button>}</div></div>{item.deliveries.length > 0 && <details className="group mt-2"><summary className="min-h-10 cursor-pointer list-none py-2 text-sm font-bold text-[#792f59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59]">Dettagli invii <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-90">›</span></summary><div className="flex flex-wrap gap-2 pb-1">{item.deliveries.map((delivery) => <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold" key={`${delivery.channel}-${delivery.generation}`}>{CHANNEL_LABELS[delivery.channel]}: {delivery.status}{delivery.failure_reason ? ` · ${delivery.failure_reason}` : ""}</span>)}</div></details>}</article>)}</div><nav aria-label="Paginazione richieste recensione" className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-stone-500"><strong className="text-stone-700">{(collectionPage - 1) * COLLECTION_PAGE_SIZE + 1}–{Math.min(collectionPage * COLLECTION_PAGE_SIZE, filteredCollection.length)}</strong> di {filteredCollection.length}</p><div className="flex items-center gap-2"><Button disabled={collectionPage === 1} onClick={() => setCollectionPage((page) => Math.max(1, page - 1))} variant="outline">Precedente</Button><span className="min-w-16 text-center text-sm font-bold text-stone-600" aria-current="page">{collectionPage} / {collectionPageCount}</span><Button disabled={collectionPage === collectionPageCount} onClick={() => setCollectionPage((page) => Math.min(collectionPageCount, page + 1))} variant="outline">Successiva</Button></div></nav></div>}
          </section>
        </div>
      </SectionCard>
      </div>}

      {activeTab === "overview" && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="reviews-list-title" className="esse-panel min-w-0 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_12px_36px_rgb(45_29_39_/_0.06)]">
        <div className="border-b border-stone-200 p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 className="text-2xl font-black tracking-[-.025em] text-stone-950" id="reviews-list-title">Recensioni ricevute</h2><p className="mt-1 text-sm text-stone-500">Trova rapidamente i feedback che richiedono attenzione.</p></div>
            <label className="block lg:w-72"><span className="sr-only">Cerca nelle recensioni</span><input className="min-h-11 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#792f59] focus:bg-white focus:ring-2 focus:ring-[#792f59]/15" onChange={(event) => setReviewQuery(event.target.value)} placeholder="Cerca cliente o commento…" type="search" value={reviewQuery} /></label>
          </div>
          <div aria-label="Filtra recensioni" className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group">
            {([['all', 'Tutte', items.length], ['unanswered', 'Da rispondere', unanswered], ['private', 'Private', items.length - published], ['published', 'Pubblicate', published]] as const).map(([value, label, count]) => <button aria-pressed={reviewScope === value} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59] ${reviewScope === value ? 'border-[#792f59] bg-[#792f59] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-[#c78baa]'}`} key={value} onClick={() => setReviewScope(value)} type="button">{label} <span className={reviewScope === value ? 'text-white/70' : 'text-stone-400'}>{count}</span></button>)}
          </div>
        </div>
        {management.error && !selected && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{management.error}</p>}
        {list.status === "loading" || list.status === "idle" ? (
          <p className="m-5 rounded-2xl bg-stone-50 p-5 text-sm font-semibold text-stone-500" role="status">Caricamento recensioni…</p>
        ) : list.status === "error" ? (
          <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="text-sm font-semibold text-red-800">{list.error}</p>
            <Button className="mt-3" onClick={() => void load()} variant="outline">Riprova</Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nessuna recensione" description="Le recensioni compariranno dopo gli appuntamenti completati." />
        ) : filteredReviews.length === 0 ? (
          <div className="p-8 text-center"><h3 className="font-black text-stone-900">Nessun risultato</h3><p className="mt-1 text-sm text-stone-500">Prova a cambiare ricerca o filtro.</p></div>
        ) : (
          <div>
            <div className="divide-y divide-stone-200">
            {filteredReviews.slice(0, visibleReviewCount).map((item) => (
              <article className="px-5 py-6 transition-colors hover:bg-[#fffafd] sm:px-7" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{stars(item.rating)}</p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-base font-black text-stone-950">{item.customer_name}</h3><time className="text-sm text-stone-400">{new Date(item.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</time></div>
                  </div>
                  <StatusBadge status={item.published ? "active" : "inactive"}>{item.published ? "Pubblicata" : "Privata"}</StatusBadge>
                </div>
                <p className="mt-4 max-w-3xl text-[15px] leading-7 text-stone-700">{item.comment || <span className="italic text-stone-400">Nessun commento.</span>}</p>
                {item.reply && <div className="mt-4 border-l-2 border-[#d7a6c1] pl-4"><p className="text-xs font-bold text-[#792f59]">Risposta del salone</p><p className="mt-1 text-sm leading-6 text-stone-600">{item.reply}</p></div>}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button onClick={() => dispatchManagement({ review: item, type: "open" })} variant={item.reply ? "outline" : "primary"}>{item.reply ? "Modifica risposta" : "Rispondi"}</Button>
                  {hasPermission(PERMISSION_KEYS.SETTINGS_SALON) && (
                    <Button disabled={management.pending} onClick={() => void setPublished(item, !item.published)} variant="tableAction">
                      {item.published ? "Rendi privata" : "Pubblica"}
                    </Button>
                  )}
                </div>
              </article>
            ))}
            </div>
            {visibleReviewCount < filteredReviews.length && <div className="border-t border-stone-200 p-5 text-center"><Button onClick={() => setVisibleReviewCount((count) => count + 12)} variant="outline">Mostra altre recensioni</Button><p className="mt-2 text-xs text-stone-400">{Math.min(visibleReviewCount, filteredReviews.length)} di {filteredReviews.length}</p></div>}
          </div>
        )}
      </section>

      <aside className="order-first xl:order-none xl:sticky xl:top-24">
        <section aria-labelledby="rating-summary-title" className="esse-panel overflow-hidden rounded-3xl border border-[#e2c2d3] bg-[#fffafd] p-5 sm:p-6">
          <h2 className="text-sm font-black text-stone-700" id="rating-summary-title">Valutazione complessiva</h2>
          <div className="mt-3 flex items-end gap-3"><strong className="font-serif text-6xl font-bold leading-none tracking-[-.06em] text-stone-950">{average.toFixed(1)}</strong><div className="pb-1"><div className="text-base">{stars(Math.round(average))}</div><p className="mt-1 text-xs text-stone-500">su {items.length} recensioni</p></div></div>
          <div className="mt-7 space-y-3">
            {ratingDistribution.map(({ count, rating }) => {
              const width = items.length ? (count / items.length) * 100 : 0;
              return <div className="grid grid-cols-[28px_1fr_28px] items-center gap-3" key={rating}><span className="text-sm font-bold text-stone-600">{rating}★</span><div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-stone-200"><div className="h-full rounded-full bg-[#a94c7d]" style={{ width: `${width}%` }} /></div><span className="text-right text-xs font-semibold text-stone-400">{count}</span></div>;
            })}
          </div>
        </section>
        {unanswered > 0 && <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm font-black text-stone-900">{unanswered} recensioni aspettano una risposta</p><p className="mt-1 text-sm leading-6 text-stone-500">Una risposta breve mostra attenzione e completa la conversazione con il cliente.</p><button className="mt-3 min-h-10 text-sm font-bold text-[#792f59] underline decoration-[#d7a6c1] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59]" onClick={() => setReviewScope("unanswered")} type="button">Mostra quelle da gestire</button></div>}
      </aside>
      </div>}

      <Dialog
        footer={<><Button onClick={() => dispatchManagement({ type: "close" })} variant="outline">Annulla</Button><Button disabled={management.pending} onClick={() => void saveReply()} variant="primary">{management.pending ? "Salvataggio…" : "Salva risposta"}</Button></>}
        onClose={() => dispatchManagement({ type: "close" })}
        open={Boolean(selected)}
        title={`Rispondi a ${selected?.customer_name ?? "cliente"}`}
      >
        {management.error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{management.error}</p>}
        <textarea className="w-full" onChange={(event) => dispatchManagement({ type: "changeReply", value: event.target.value })} rows={5} value={reply} />
      </Dialog>
      <Dialog footer={<><Button disabled={manualPending} onClick={() => setManualTarget(undefined)} variant="outline">Annulla</Button><Button disabled={manualPending || manualChannels.length === 0} onClick={() => void sendManual()} variant="primary">{manualPending ? "Invio…" : manualTarget?.deliveries.length ? "Reinvia" : "Invia ora"}</Button></>} onClose={() => !manualPending && setManualTarget(undefined)} open={Boolean(manualTarget)} title={manualTarget?.deliveries.length ? "Reinviare la richiesta?" : "Inviare la richiesta?"}>
        <p className="text-sm text-stone-600">{manualTarget?.deliveries.length ? "Il cliente ha già ricevuto almeno una richiesta. Verrà registrato un nuovo tentativo." : "La richiesta partirà subito sui canali selezionati."}</p>
        <fieldset className="mt-4"><legend className="text-sm font-black">Canali per {manualTarget?.customer_name}</legend><div className="mt-2 flex gap-2">{(["email", "whatsapp", "app"] as Channel[]).map((channel) => <button aria-pressed={manualChannels.includes(channel)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${manualChannels.includes(channel) ? "bg-[#792f59] text-white" : "bg-white"}`} disabled={channel === "email" ? !manualTarget?.customer_email : channel === "whatsapp" ? !manualTarget?.customer_phone : !manualTarget?.customer_push_subscribed} key={channel} onClick={() => toggleChannel(channel, manualChannels, setManualChannels)}>{CHANNEL_LABELS[channel]}</button>)}</div></fieldset>
      </Dialog>
    </AppPage>
  );
}
