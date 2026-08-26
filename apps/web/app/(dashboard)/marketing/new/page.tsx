"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, LayoutTemplate, Mail, MessageCircleMore, Save, Send, UsersRound } from "lucide-react";
import { AppPage, Breadcrumbs, Button, InlineError, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type Channel = "email" | "whatsapp";
type Segment =
  | { type: "all" }
  | { type: "inactive"; days_since_last_visit: number }
  | { type: "tag"; tag: string }
  | { type: "high_loyalty"; min_points: number };

interface CampaignTemplate { channel: Channel; content: string; id: string; name: string; variables: string[]; whatsappApprovalStatus?: "approved" | null }
interface PreviewRow { customer_id: string; destination: string | null; name: string; reason?: string }
interface Preview { eligible: PreviewRow[]; eligible_count: number; excluded: PreviewRow[]; excluded_count: number }

export default function NewCampaignPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [segment, setSegment] = useState("all");
  const [content, setContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [readiness, setReadiness] = useState<Record<Channel, "ready" | "not_configured">>();
  const [testDestination, setTestDestination] = useState("");

  useEffect(() => {
    if (!salon) return;
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/campaign-templates`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/campaigns/readiness`, { credentials: "include" }),
    ]).then(async ([templatesResponse, readinessResponse]) => {
      if (templatesResponse.ok) setTemplates(await templatesResponse.json() as CampaignTemplate[]);
      if (readinessResponse.ok) setReadiness(await readinessResponse.json() as Record<Channel, "ready" | "not_configured">);
    });
  }, [salon]);

  function segmentConfig(data: FormData): Segment {
    if (segment === "inactive") return { type: segment, days_since_last_visit: Number(data.get("days")) };
    if (segment === "tag") return { type: segment, tag: String(data.get("tag") ?? "") };
    if (segment === "high_loyalty") return { type: segment, min_points: Number(data.get("points")) };
    return { type: "all" };
  }

  function invalidatePreview() { setPreview(undefined); setFeedback(""); }

  async function loadPreview() {
    if (!salon || !formRef.current) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns/preview`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, target_segment: segmentConfig(new FormData(formRef.current)) }),
    });
    if (!response.ok) { setError("Impossibile calcolare i destinatari. Controlla i filtri del segmento."); return; }
    const result = await response.json() as Preview;
    setPreview(result);
    setFeedback(result.eligible_count > 0 ? "Anteprima aggiornata." : "Nessun destinatario valido per questo segmento.");
  }

  async function sendTest() {
    if (!salon) return;
    setError(""); setFeedback("");
    if (readiness?.[channel] !== "ready") { setError("Provider non configurato per questo canale."); return; }
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns/test-send`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, content, destination: testDestination, ...(channel === "whatsapp" && { template_id: selectedTemplateId, whatsapp_template_parameters: templateParameters }) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "PROVIDER_NOT_CONFIGURED" ? "Provider non configurato per questo canale." : "Invio di prova non riuscito.");
      return;
    }
    setFeedback("Messaggio di prova accettato dal provider. La campagna non è stata inviata.");
  }

  async function create(data: FormData) {
    if (!salon) return;
    setError("");
    if (!preview || preview.eligible_count === 0) { setError("Genera prima l'anteprima destinatari e verifica che contenga almeno un recapito valido."); return; }
    if (channel === "whatsapp" && !selectedTemplateId) { setError("Seleziona un modello Meta WhatsApp approvato."); return; }
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), channel, target_segment: segmentConfig(data), ...(channel === "email" && { content }), ...(channel === "whatsapp" && { template_id: selectedTemplateId, whatsapp_template_parameters: templateParameters }), scheduled_at: data.get("scheduled") || undefined }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError("Campagna non salvata. Per WhatsApp seleziona un modello Meta approvato.");
      return;
    }
    const campaign = await response.json() as { id: string };
    router.push(`/marketing/${campaign.id}`);
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id); setChannel(template.channel); setContent(template.content); setTemplateParameters(template.variables.map(() => "")); invalidatePreview();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <form action={create} ref={formRef}>
        <Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: "Nuova campagna" }]} />
        <div className="mt-4 grid gap-4 xl:grid-cols-12">
          {error && <div className="xl:col-span-12"><InlineError>{error}</InlineError></div>}
          {feedback && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 xl:col-span-12" role="status">{feedback}</p>}

          <SectionCard
            actions={<Link className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-[#792f59] hover:bg-[#f8edf3]" href="/marketing/templates"><LayoutTemplate className="size-4" />Modelli</Link>}
            className="xl:col-span-7"
            title="Impostazioni campagna"
            subtitle="Dai un'identità alla campagna e scegli il canale di uscita."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="font-semibold">Nome<input name="name" required className="mt-2 min-h-12 w-full rounded-xl border px-3" placeholder="Es. Ritorna da noi" /></label>
              <label className="font-semibold">Modello<select defaultValue="" onChange={(event) => applyTemplate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3"><option value="">Nessun modello</option>{templates.filter((template) => template.channel !== "whatsapp" || template.whatsappApprovalStatus === "approved").map((template) => <option key={template.id} value={template.id}>{template.name} · {template.channel.toUpperCase()}</option>)}</select></label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["email", "whatsapp"] as const).map((value) => {
                const ready = readiness?.[value] === "ready";
                const ChannelIcon = value === "email" ? Mail : MessageCircleMore;
                return <button aria-pressed={channel === value} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition ${channel === value ? "border-[#792f59] bg-[#f8edf3] ring-2 ring-[#792f59]/10" : "border-stone-200 bg-white hover:bg-stone-50"}`} key={value} onClick={() => { setChannel(value); invalidatePreview(); }} type="button"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${channel === value ? "bg-[#792f59] text-white" : "bg-stone-100 text-stone-500"}`}><ChannelIcon className="size-5" /></span><span><strong className="block text-sm">{value === "whatsapp" ? "WhatsApp" : "Email"}</strong><span className={`mt-1 block text-xs font-semibold ${ready ? "text-emerald-700" : "text-amber-700"}`}>{ready ? "Provider pronto" : "Da configurare"}</span></span></button>;
              })}
            </div>
          </SectionCard>

          <SectionCard className="xl:col-span-5" title={<span className="flex items-center gap-2"><UsersRound className="size-5 text-[#792f59]" />Pubblico e pianificazione</span>} subtitle="Definisci chi riceverà il messaggio e quando prepararlo.">
            <label className="block font-semibold">Segmento<select value={segment} onChange={(event) => { setSegment(event.target.value); invalidatePreview(); }} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3"><option value="all">Tutti</option><option value="inactive">Clienti inattivi</option><option value="tag">Tag cliente</option><option value="high_loyalty">Punti fedeltà alti</option></select></label>
            {segment === "inactive" && <input name="days" type="number" min="1" required placeholder="Giorni dall'ultima visita" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
            {segment === "tag" && <input name="tag" required placeholder="Tag cliente" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
            {segment === "high_loyalty" && <input name="points" type="number" min="0" required placeholder="Punti minimi" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
            <label className="mt-5 block font-semibold"><span className="flex items-center gap-2"><CalendarClock className="size-4 text-stone-400" />Programma invio <span className="text-xs font-medium text-stone-400">facoltativo</span></span><input name="scheduled" type="datetime-local" className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label>
          </SectionCard>

          <SectionCard className="xl:col-span-8" title="Messaggio" subtitle={channel === "whatsapp" ? "Contenuto derivato dal modello Meta approvato." : "Scrivi il testo che riceveranno i destinatari."}>
            <label className="block font-semibold">Contenuto<textarea required value={content} readOnly={channel === "whatsapp"} onChange={(event) => setContent(event.target.value)} rows={9} className="mt-2 w-full resize-y rounded-xl border p-3" placeholder="Scrivi qui il messaggio della campagna..." /></label>
            {channel === "whatsapp" && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><MessageCircleMore className="size-4" />WhatsApp usa esclusivamente il modello Meta selezionato e approvato.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{templates.find((template) => template.id === selectedTemplateId)?.variables.map((variable, index) => <label className="font-semibold" key={variable}>{variable}<input required value={templateParameters[index] ?? ""} onChange={(event) => setTemplateParameters((current) => current.map((value, parameterIndex) => parameterIndex === index ? event.target.value : value))} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3" /></label>)}</div></div>}
          </SectionCard>

          <SectionCard className="xl:col-span-4" title={<span className="flex items-center gap-2"><Send className="size-5 text-[#792f59]" />Invio di prova</span>} subtitle="Verifica il risultato su un solo recapito, senza creare destinatari.">
            <div className="rounded-2xl bg-stone-50 p-4"><span className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Canale selezionato</span><div className="mt-2 flex items-center gap-2 text-sm font-bold">{channel === "email" ? <Mail className="size-4 text-[#792f59]" /> : <MessageCircleMore className="size-4 text-emerald-700" />}{channel === "email" ? "Email" : "WhatsApp"}</div></div>
            <input aria-label="Destinazione test" value={testDestination} onChange={(event) => setTestDestination(event.target.value)} placeholder={channel === "email" ? "nome@esempio.it" : "+39..."} className="mt-4 min-h-12 w-full rounded-xl border px-3" />
            <Button className="mt-3 w-full" type="button" variant="secondary" disabled={!content || !testDestination || (channel === "whatsapp" && !selectedTemplateId)} onClick={() => void sendTest()}><Send className="mr-2 size-4" />Invia test</Button>
          </SectionCard>

          <SectionCard actions={<Button type="button" variant="secondary" onClick={() => void loadPreview()}><Eye className="mr-2 size-4" />Calcola anteprima</Button>} className="xl:col-span-12" title={<span className="flex items-center gap-2"><UsersRound className="size-5 text-[#792f59]" />Anteprima destinatari</span>} subtitle="Obbligatoria prima di salvare: mostra recapiti validi ed esclusioni.">
            {!preview && <div className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 text-center"><div><Eye className="mx-auto size-5 text-stone-400" /><p className="mt-2 text-sm font-semibold text-stone-600">Calcola l'audience per verificare chi riceverà la campagna.</p></div></div>}
            {preview && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold">Destinatari validi · {preview.eligible_count}</h3><ul className="mt-2 space-y-1 text-sm">{preview.eligible.map((item) => <li key={item.customer_id}>{item.name} · {item.destination}</li>)}</ul></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold">Destinazioni escluse · {preview.excluded_count}</h3><ul className="mt-2 space-y-1 text-sm">{preview.excluded.map((item) => <li key={item.customer_id}>{item.name} · {item.reason === "MISSING_EMAIL" ? "email mancante" : item.reason === "MISSING_WHATSAPP_CONSENT" ? "consenso WhatsApp mancante" : "telefono mancante"}</li>)}</ul></div></div>}
          </SectionCard>

          <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between xl:col-span-12"><div><strong className="block text-sm text-stone-950">Pronta per il controllo finale</strong><p className="mt-1 text-xs text-stone-500">{preview?.eligible_count ? `${preview.eligible_count} destinatari validi. La campagna resterà in bozza.` : "Calcola prima l'anteprima destinatari per continuare."}</p></div><Button className="min-h-11 sm:min-w-56" type="submit" disabled={!preview?.eligible_count}><Save className="mr-2 size-4" />Salva bozza e continua</Button></div>
        </div>
      </form>
    </AppPage>
  );
}
