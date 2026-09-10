"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Mail, MessageCircleMore } from "lucide-react";
import { AppPage, Breadcrumbs, Button, EmptyState, InlineError, SectionCard, StatusBadge } from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { useAuth } from "../../../../lib/auth-context";
import { EmailPreview, PushPreview, PushTextEditor, RichTextEditor } from "../_components/MarketingEditors";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Channel = "app" | "email" | "whatsapp";
interface CampaignTemplate { active: boolean; channel: Channel; content: string; id: string; name: string; variables: string[]; whatsappApprovalStatus?: "approved" | "pending" | "rejected" | "revoked" | null; whatsappTemplateLocale?: string | null; whatsappTemplateName?: string | null }
const tabs = [{ id: "email" as const, label: "Email", icon: Mail }, { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircleMore }, { id: "app" as const, label: "Push app", icon: Bell }];

export default function CampaignTemplatesPage() {
  const { salon } = useAuth(); const moduleEnabled = useModuleEnabled(MODULE_KEYS.MARKETING); const [templates, setTemplates] = useState<CampaignTemplate[]>([]); const [editing, setEditing] = useState<CampaignTemplate>(); const [channel, setChannel] = useState<Channel>("email"); const [content, setContent] = useState(""); const [name, setName] = useState(""); const [variables, setVariables] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!moduleEnabled) return; if (!salon) return; const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates?include_archived=true`, { credentials: "include" }); if (!response.ok) return setError("Impossibile caricare i modelli."); setTemplates(await response.json() as CampaignTemplate[]); }, [moduleEnabled, salon]);
  useEffect(() => { void load(); }, [load]);
  function reset(nextChannel = channel) { setEditing(undefined); setName(""); setContent(""); setVariables(""); setChannel(nextChannel); }
  function edit(template: CampaignTemplate) { setEditing(template); setChannel(template.channel); setName(template.name); setContent(template.content); setVariables(template.variables.join(", ")); }
  async function save(data: FormData) { if (!salon) return; setError(""); const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, content, name, variables: channel === "whatsapp" ? variables.split(",").map((item) => item.trim()).filter(Boolean) : [], whatsapp_template_name: channel === "whatsapp" ? data.get("whatsapp_template_name") : null, whatsapp_template_locale: channel === "whatsapp" ? data.get("whatsapp_template_locale") : null }) }); if (!response.ok) return setError("Modello non salvato. Controlla i campi richiesti."); reset(channel); await load(); }
  async function archive(id: string) { if (!salon) return; const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates/${id}/archive`, { method: "POST", credentials: "include" }); if (!response.ok) return setError("Modello non archiviato."); if (editing?.id === id) reset(channel); await load(); }
  const visible = templates.filter((item) => item.channel === channel);

  if (!moduleEnabled) {
    return <AppPage maxWidth="max-w-[1600px]">
      <Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: "Modelli" }]} />
      <div className="mt-5">
        <EmptyState
          action={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#792f59] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#63204a]" href="/apps">Vai a App e moduli</Link>}
          description="Attiva il modulo Marketing dalla pagina App e moduli per gestire la libreria modelli."
          title="Modulo Marketing non attivo"
        />
      </div>
    </AppPage>;
  }

  return <AppPage maxWidth="max-w-[1600px]"><Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: "Modelli" }]} />
    <header className="mt-5 border-b border-stone-200 pb-6"><h1 className="text-3xl font-bold tracking-tight">Libreria modelli</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Ogni canale ha un formato proprio. I modelli non vengono più mescolati nello stesso elenco.</p></header>
    <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Tipo di modello">{tabs.map(({ id, icon: Icon, label }) => <button aria-selected={channel === id} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${channel === id ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white text-stone-700"}`} key={id} onClick={() => reset(id)} role="tab" type="button"><Icon className="size-4" />{label}<span className={`rounded-full px-2 py-0.5 text-xs ${channel === id ? "bg-white/20" : "bg-stone-100"}`}>{templates.filter((item) => item.channel === id && item.active).length}</span></button>)}</div>
    {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(340px,480px)_1fr]">
      <SectionCard title={editing ? "Modifica modello" : `Nuovo modello ${tabs.find((item) => item.id === channel)?.label}`} subtitle={channel === "whatsapp" ? "Registra esattamente i dati del modello creato in Meta." : channel === "email" ? "Crea contenuti formattati riutilizzabili." : "Prepara notifiche brevi per l’app."}>
        <form action={save} className="grid gap-4"><label className="text-sm font-semibold">Nome interno<input className="mt-2 min-h-12 w-full rounded-xl border px-3" onChange={(e) => setName(e.target.value)} required value={name} /></label>
          {channel === "whatsapp" && <><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Prima crea il modello in Meta Business.</strong><p className="mt-1">Dopo l’approvazione, registra qui nome, lingua, corpo e variabili nello stesso ordine.</p></div><label className="text-sm font-semibold">Nome modello Meta<input className="mt-2 min-h-12 w-full rounded-xl border px-3" defaultValue={editing?.whatsappTemplateName ?? ""} name="whatsapp_template_name" required /></label><label className="text-sm font-semibold">Lingua Meta<input className="mt-2 min-h-12 w-full rounded-xl border px-3" defaultValue={editing?.whatsappTemplateLocale ?? "it"} name="whatsapp_template_locale" required /></label><label className="text-sm font-semibold">Variabili, separate da virgola<input className="mt-2 min-h-12 w-full rounded-xl border px-3" onChange={(e) => setVariables(e.target.value)} placeholder="Nome cliente, Data appuntamento" value={variables} /></label><label className="text-sm font-semibold">Corpo approvato<textarea className="mt-2 w-full rounded-xl border p-3" onChange={(e) => setContent(e.target.value)} required rows={8} value={content} /></label></>}
          {channel === "email" && <RichTextEditor onChange={setContent} value={content} />}
          {channel === "app" && <label className="text-sm font-semibold">Testo push<div className="mt-2"><PushTextEditor onChange={setContent} value={content} /></div></label>}
          <div className="flex justify-end gap-2">{editing && <Button onClick={() => reset(channel)} type="button" variant="ghost">Annulla</Button>}<Button disabled={!name || !content} type="submit">{editing ? "Salva modifiche" : "Crea modello"}</Button></div></form>
      </SectionCard>
      <div className="grid content-start gap-5">{channel === "email" && <SectionCard title="Anteprima HTML" subtitle="Aspetto indicativo nella casella del destinatario."><EmailPreview html={content} salonName={salon?.name} subject={name} /></SectionCard>}{channel === "app" && <SectionCard title="Anteprima push" subtitle="Aspetto indicativo sul telefono del cliente."><PushPreview body={content} title={name} /></SectionCard>}
        <SectionCard title={`Modelli ${tabs.find((item) => item.id === channel)?.label}`} subtitle="I modelli archiviati restano visibili nello storico.">{visible.length === 0 ? <EmptyState title="Nessun modello" description={`Crea il primo modello ${tabs.find((item) => item.id === channel)?.label}.`} /> : <div className="grid gap-3">{visible.map((template) => <article className="esse-panel rounded-xl border border-stone-200 p-4" key={template.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{template.name}</h2>{channel === "whatsapp" && <p className="mt-1 text-xs text-stone-500">{template.whatsappTemplateName} · {template.whatsappTemplateLocale}</p>}</div><div className="flex gap-2"><StatusBadge status={template.active ? "active" : "archived"}>{template.active ? "Attivo" : "Archiviato"}</StatusBadge>{channel === "whatsapp" && <StatusBadge status={template.whatsappApprovalStatus === "approved" ? "active" : "pending"}>{template.whatsappApprovalStatus === "approved" ? "Meta approvato" : template.whatsappApprovalStatus ?? "Da verificare"}</StatusBadge>}</div></div><div className="mt-3 line-clamp-3 text-sm text-stone-700" dangerouslySetInnerHTML={channel === "email" ? { __html: template.content } : undefined}>{channel === "email" ? undefined : template.content}</div>{template.active && <div className="mt-4 flex justify-end gap-2"><Button onClick={() => edit(template)} type="button" variant="secondary">Modifica</Button><Button onClick={() => void archive(template.id)} type="button" variant="ghost">Archivia</Button></div>}</article>)}</div>}</SectionCard>
      </div>
    </div>
  </AppPage>;
}
