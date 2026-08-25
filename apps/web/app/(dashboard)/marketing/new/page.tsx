"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
      <form action={create} ref={formRef} className="grid gap-5">
        <Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: "Nuova campagna" }]} />
        <SectionCard title="Prepara il messaggio" subtitle="La bozza non parte finché non confermi l'invio dalla pagina di dettaglio.">
          {error && <div className="mb-5"><InlineError>{error}</InlineError></div>}
          {feedback && <p className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{feedback}</p>}
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="font-semibold">Nome<input name="name" required className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label>
            <label className="font-semibold">Modello
              <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3">
                <option value="">Nessun modello</option>{templates.filter((template) => template.channel !== "whatsapp" || template.whatsappApprovalStatus === "approved").map((template) => <option key={template.id} value={template.id}>{template.name} · {template.channel.toUpperCase()}</option>)}
              </select>
              <Link href="/marketing/templates" className="mt-2 inline-block text-sm font-bold text-[#792f59]">Gestisci modelli</Link>
            </label>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["email", "whatsapp"] as const).map((value) => <button key={value} type="button" onClick={() => { setChannel(value); invalidatePreview(); }} className={`rounded-xl border p-4 font-bold ${channel === value ? "border-rose-700 bg-rose-50" : ""}`}>{value === "whatsapp" ? "WhatsApp" : "EMAIL"} · {readiness?.[value] === "ready" ? "pronto" : "Provider non configurato"}</button>)}
          </div>
          <label className="mt-5 block font-semibold">Segmento
            <select value={segment} onChange={(event) => { setSegment(event.target.value); invalidatePreview(); }} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3"><option value="all">Tutti</option><option value="inactive">Clienti inattivi</option><option value="tag">Tag cliente</option><option value="high_loyalty">Punti fedeltà alti</option></select>
          </label>
          {segment === "inactive" && <input name="days" type="number" min="1" required placeholder="Giorni dall'ultima visita" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
          {segment === "tag" && <input name="tag" required placeholder="Tag" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
          {segment === "high_loyalty" && <input name="points" type="number" min="0" required placeholder="Punti minimi" onChange={invalidatePreview} className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
          <label className="mt-5 block font-semibold">Contenuto<textarea required value={content} readOnly={channel === "whatsapp"} onChange={(event) => setContent(event.target.value)} rows={7} className="mt-2 w-full rounded-xl border p-3" /></label>
          {channel === "whatsapp" && <div className="mt-5 grid gap-3"><p className="text-sm text-slate-600">WhatsApp usa esclusivamente il modello Meta selezionato e approvato.</p>{templates.find((template) => template.id === selectedTemplateId)?.variables.map((variable, index) => <label className="font-semibold" key={variable}>{variable}<input required value={templateParameters[index] ?? ""} onChange={(event) => setTemplateParameters((current) => current.map((value, parameterIndex) => parameterIndex === index ? event.target.value : value))} className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label>)}</div>}
          <label className="mt-5 block font-semibold">Programma invio (facoltativo)<input name="scheduled" type="datetime-local" className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label>
        </SectionCard>

        <SectionCard title="Anteprima destinatari" subtitle="Obbligatoria prima di salvare: mostra recapiti validi ed esclusioni.">
          <Button type="button" variant="secondary" onClick={() => void loadPreview()}>Calcola anteprima</Button>
          {preview && <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold">Destinatari validi · {preview.eligible_count}</h3><ul className="mt-2 space-y-1 text-sm">{preview.eligible.map((item) => <li key={item.customer_id}>{item.name} · {item.destination}</li>)}</ul></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold">Destinazioni escluse · {preview.excluded_count}</h3><ul className="mt-2 space-y-1 text-sm">{preview.excluded.map((item) => <li key={item.customer_id}>{item.name} · {item.reason === "MISSING_EMAIL" ? "email mancante" : item.reason === "MISSING_WHATSAPP_CONSENT" ? "consenso WhatsApp mancante" : "telefono mancante"}</li>)}</ul></div>
          </div>}
        </SectionCard>

        <SectionCard title="Invio di prova" subtitle="Invia solo al recapito indicato; non crea destinatari nella campagna.">
          <div className="flex flex-col gap-3 sm:flex-row"><input value={testDestination} onChange={(event) => setTestDestination(event.target.value)} placeholder={channel === "email" ? "nome@esempio.it" : "+39..."} className="min-h-12 flex-1 rounded-xl border px-3" /><Button type="button" variant="secondary" disabled={!content || !testDestination || (channel === "whatsapp" && !selectedTemplateId)} onClick={() => void sendTest()}>Invia test</Button></div>
        </SectionCard>
        <Button className="min-h-12 w-full" type="submit" disabled={!preview?.eligible_count}>Salva bozza e continua</Button>
      </form>
    </AppPage>
  );
}
