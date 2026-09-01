"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useReducer, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, Dialog, EmptyState, PageHeaderMetrics, SectionCard, StatusBadge } from "@esse-beauty/ui";

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
type Channel = "email" | "whatsapp";
interface ReviewSettings { automaticEnabled: boolean; channels: Channel[]; delayPreset: "immediate" | "one_hour" | "three_hours" | "next_day" | "two_days" }
interface CollectionItem { appointment_date: string; appointment_id: string; customer_email?: string | null; customer_name: string; customer_phone?: string | null; deliveries: Array<{ channel: Channel; delivered_at?: string | null; failure_reason?: string | null; generation: number; scheduled_at: string; status: string }>; invitation_consumed_at?: string | null; review_id?: string | null; service_name: string }
const presetOptions = [["immediate", "Subito"], ["one_hour", "Dopo 1 ora"], ["three_hours", "Dopo 3 ore"], ["next_day", "Il giorno successivo"], ["two_days", "Dopo 2 giorni"]] as const;

function stars(rating: number) {
  return (
    <span className="text-[#b85888]">
      {"★".repeat(rating)}
      <span className="text-stone-200">{"★".repeat(5 - rating)}</span>
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
  const [settingsMessage, setSettingsMessage] = useState("");
  const [manualTarget, setManualTarget] = useState<CollectionItem>();
  const [manualChannels, setManualChannels] = useState<Channel[]>(["email"]);
  const [manualPending, setManualPending] = useState(false);
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
    setManualChannels(settings.channels.filter((channel) => channel === "email" ? Boolean(item.customer_email) : Boolean(item.customer_phone)));
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
      <PageHeaderMetrics
        eyebrow="Voce dei clienti"
        metrics={[
          { detail: "Su 5 stelle", label: "Media", value: average.toFixed(1) },
          { detail: "Visibili ai clienti", label: "Pubblicate", value: published },
          { detail: "Senza risposta", label: "Da rispondere", value: unanswered },
        ]}
        title="Recensioni"
        subtitle="Rispondi ai feedback e scegli cosa rendere pubblico nella pagina del salone."
      />

      {activeTab === "requests" && <div>
      <SectionCard title="Raccolta recensioni" subtitle="Configura gli inviti automatici e gestisci quelli manuali dopo gli appuntamenti completati.">
        <div className="space-y-5">
          <section aria-labelledby="review-automation-title" className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-black" id="review-automation-title">Richiesta automatica</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {settings.automaticEnabled ? `${presetOptions.find(([value]) => value === settings.delayPreset)?.[1]} · ${settings.channels.map((channel) => channel === "email" ? "Email" : "WhatsApp").join(" + ")}` : "Invio automatico disattivato"}
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
                <fieldset className="mt-5"><legend className="text-sm font-black">Canali</legend><div className="mt-2 grid max-w-md grid-cols-2 gap-2">{(["email", "whatsapp"] as Channel[]).map((channel) => <button aria-pressed={settings.channels.includes(channel)} className={`min-h-11 rounded-xl border text-sm font-bold ${settings.channels.includes(channel) ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white"}`} key={channel} onClick={() => toggleChannel(channel, settings.channels, (channels) => setSettings((current) => ({ ...current, channels })))} type="button">{channel === "email" ? "Email" : "WhatsApp"}</button>)}</div><p className="mt-2 text-xs text-stone-600">Ogni canale necessita del relativo contatto cliente; WhatsApp richiede un provider configurato.</p></fieldset>
                <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => void saveSettings()} variant="primary">Salva configurazione</Button>{settingsMessage && <p className="text-sm font-semibold" role="status">{settingsMessage}</p>}</div>
              </div>
            </details>
          </section>

          <section aria-labelledby="review-queue-title">
            <div><h2 className="font-black" id="review-queue-title">Appuntamenti completati</h2><p className="mt-1 text-sm text-stone-600">Invia ora o reinvia una richiesta già consegnata.</p></div>
            {collectionError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{collectionError}</p>}
            {collectionLoading ? <p className="mt-4 text-sm text-stone-500">Caricamento richieste…</p> : collection.length === 0 ? <EmptyState title="Nessun appuntamento completato" description="Gli appuntamenti conclusi compariranno qui." /> : <div className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">{collection.map((item) => <article className="p-4" key={item.appointment_id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">{item.customer_name}</h3><p className="text-sm text-stone-600">{item.service_name} · {new Date(item.appointment_date).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="flex items-center gap-2">{item.review_id ? <StatusBadge status="completed">Recensione ricevuta</StatusBadge> : <Button disabled={Boolean(item.invitation_consumed_at)} onClick={() => openManual(item)} variant={item.deliveries.length ? "outline" : "primary"}>{item.deliveries.length ? "Reinvia" : "Invia ora"}</Button>}</div></div>{item.deliveries.length > 0 && <details className="group mt-2"><summary className="min-h-10 cursor-pointer list-none py-2 text-sm font-bold text-[#792f59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59]">Dettagli invii <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-90">›</span></summary><div className="flex flex-wrap gap-2 pb-1">{item.deliveries.map((delivery) => <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold" key={`${delivery.channel}-${delivery.generation}`}>{delivery.channel === "email" ? "Email" : "WhatsApp"}: {delivery.status}{delivery.failure_reason ? ` · ${delivery.failure_reason}` : ""}</span>)}</div></details>}</article>)}</div>}
          </section>
        </div>
      </SectionCard>
      </div>}

      {activeTab === "overview" && <div>
      <SectionCard title="Distribuzione voti" subtitle="Una lettura rapida della soddisfazione recente.">
        <div className="grid gap-3 md:grid-cols-5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = items.filter((item) => item.rating === star).length;
            const height = items.length ? (count / items.length) * 100 : 0;
            return (
              <div className="rounded-2xl border border-[#ead1df] bg-[#fffafd] p-3 text-center" key={star}>
                <b className="text-sm text-[#792f59]">{star}★</b>
                <div className="mx-auto mt-3 flex h-24 w-8 items-end rounded-full bg-white p-1 shadow-inner">
                  <div className="w-full rounded-full bg-[linear-gradient(180deg,#b85888,#792f59)]" style={{ height: `${height}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold text-stone-500">{count}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard className="mt-6" title="Recensioni ricevute" subtitle="Ogni recensione resta gestibile senza uscire dalla pagina.">
        {management.error && !selected && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{management.error}</p>}
        {list.status === "loading" || list.status === "idle" ? (
          <p className="rounded-2xl bg-stone-50 p-5 text-sm font-semibold text-stone-500" role="status">Caricamento recensioni…</p>
        ) : list.status === "error" ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="text-sm font-semibold text-red-800">{list.error}</p>
            <Button className="mt-3" onClick={() => void load()} variant="outline">Riprova</Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nessuna recensione" description="Le recensioni compariranno dopo gli appuntamenti completati." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article className="rounded-2xl border border-white/80 bg-white/82 p-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.06)] ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:border-[#d7a6c1]" key={item.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">{stars(item.rating)}</p>
                    <h2 className="mt-1 text-lg font-bold text-stone-950">{item.customer_name}</h2>
                    <time className="text-xs font-semibold uppercase tracking-[.08em] text-stone-400">{new Date(item.created_at).toLocaleDateString("it-IT")}</time>
                  </div>
                  <StatusBadge status={item.published ? "active" : "inactive"}>{item.published ? "Pubblicata" : "Privata"}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-stone-600">{item.comment || "Nessun commento."}</p>
                {item.reply && <details className="group mt-3 rounded-xl border border-[#ead1df] bg-[#fffafd]"><summary className="min-h-10 cursor-pointer list-none px-4 py-2.5 text-sm font-bold text-[#792f59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59]">Risposta del salone <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-90">›</span></summary><p className="border-t border-[#ead1df] px-4 py-3 text-sm leading-6 text-stone-600">{item.reply}</p></details>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => dispatchManagement({ review: item, type: "open" })} variant="outline">Rispondi</Button>
                  {hasPermission(PERMISSION_KEYS.SETTINGS_SALON) && (
                    <Button disabled={management.pending} onClick={() => void setPublished(item, !item.published)} variant="tableAction">
                      {item.published ? "Rendi privata" : "Pubblica"}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
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
        <fieldset className="mt-4"><legend className="text-sm font-black">Canali per {manualTarget?.customer_name}</legend><div className="mt-2 flex gap-2">{(["email", "whatsapp"] as Channel[]).map((channel) => <button aria-pressed={manualChannels.includes(channel)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${manualChannels.includes(channel) ? "bg-[#792f59] text-white" : "bg-white"}`} disabled={channel === "email" ? !manualTarget?.customer_email : !manualTarget?.customer_phone} key={channel} onClick={() => toggleChannel(channel, manualChannels, setManualChannels)}>{channel === "email" ? "Email" : "WhatsApp"}</button>)}</div></fieldset>
      </Dialog>
    </AppPage>
  );
}
