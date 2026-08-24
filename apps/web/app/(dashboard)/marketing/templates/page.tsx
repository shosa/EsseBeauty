"use client";

import { useCallback, useEffect, useState } from "react";
import { AppPage, Breadcrumbs, Button, EmptyState, InlineError, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface CampaignTemplate {
  active: boolean;
  channel: "email" | "sms";
  content: string;
  id: string;
  name: string;
}

export default function CampaignTemplatesPage() {
  const { salon } = useAuth();
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [editing, setEditing] = useState<CampaignTemplate>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates?include_archived=true`, { credentials: "include" });
    if (!response.ok) { setError("Impossibile caricare i modelli."); return; }
    setTemplates(await response.json() as CampaignTemplate[]);
  }, [salon]);

  useEffect(() => { void load(); }, [load]);

  async function save(data: FormData) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates${editing ? `/${editing.id}` : ""}`, {
      method: editing ? "PATCH" : "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: data.get("channel"), content: data.get("content"), name: data.get("name") }),
    });
    if (!response.ok) { setError("Modello non salvato. Per gli SMS usa al massimo 160 caratteri."); return; }
    setEditing(undefined);
    await load();
  }

  async function archive(templateId: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/campaign-templates/${templateId}/archive`, { method: "POST", credentials: "include" });
    if (!response.ok) { setError("Modello non archiviato."); return; }
    if (editing?.id === templateId) setEditing(undefined);
    await load();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: "Modelli" }]} />
      {error && <div className="mt-5"><InlineError>{error}</InlineError></div>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        <SectionCard title={editing ? "Modifica modello" : "Nuovo modello"} subtitle="Il contenuto viene copiato nella bozza e resta modificabile.">
          <form action={save} key={editing?.id ?? "new"} className="grid gap-4">
            <label className="text-sm font-semibold">Nome<input name="name" defaultValue={editing?.name} required className="mt-1 min-h-12 w-full rounded-xl border px-3" /></label>
            <label className="text-sm font-semibold">Canale<select name="channel" defaultValue={editing?.channel ?? "email"} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"><option value="email">Email</option><option value="sms">SMS</option></select></label>
            <label className="text-sm font-semibold">Contenuto<textarea name="content" defaultValue={editing?.content} required rows={8} className="mt-1 w-full rounded-xl border p-3" /></label>
            <div className="flex justify-end gap-2">{editing && <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>Annulla</Button>}<Button type="submit">{editing ? "Salva modifiche" : "Crea modello"}</Button></div>
          </form>
        </SectionCard>
        <SectionCard title="Libreria modelli" subtitle="I modelli archiviati restano nello storico ma non sono applicabili.">
          {templates.length === 0 ? <EmptyState title="Nessun modello" description="Crea il primo modello riutilizzabile per email o SMS." /> : <div className="grid gap-3">
            {templates.map((template) => <article key={template.id} className="rounded-xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{template.name}</h2><p className="mt-1 text-sm text-stone-500">{template.channel.toUpperCase()}</p></div><StatusBadge status={template.active ? "active" : "archived"}>{template.active ? "Attivo" : "Archiviato"}</StatusBadge></div>
              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-stone-700">{template.content}</p>
              {template.active && <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(template)}>Modifica</Button><Button type="button" variant="ghost" onClick={() => void archive(template.id)}>Archivia</Button></div>}
            </article>)}
          </div>}
        </SectionCard>
      </div>
    </AppPage>
  );
}
