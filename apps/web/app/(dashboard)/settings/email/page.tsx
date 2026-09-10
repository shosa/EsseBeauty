"use client";

import { useEffect, useState } from "react";
import { Mail, Reply, Signature } from "lucide-react";

import {
  AppPage,
  FormField,
  InlineError,
  PageHeader,
  PageSkeleton,
  SaveActionButton,
  SaveToast,
  SectionCard,
  Switch,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface EmailSettings {
  enabled: boolean;
  footer: string;
  fromName: string;
  replyToEmail: string;
  replyToName: string;
}

const emptySettings: EmailSettings = {
  enabled: true,
  footer: "",
  fromName: "",
  replyToEmail: "",
  replyToName: "",
};

export default function EmailSettingsPage() {
  const { salon, user } = useAuth();
  const [settings, setSettings] = useState<EmailSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`${api}/api/salons/${salon.id}/settings/control-center`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("EMAIL_SETTINGS_UNAVAILABLE");
        const body = await response.json() as { categories: Array<{ category: string; settings: Partial<EmailSettings> }> };
        const email = body.categories.find((item) => item.category === "email")?.settings ?? {};
        setSettings({
          enabled: email.enabled ?? true,
          footer: email.footer ?? "",
          fromName: email.fromName ?? salon.name,
          replyToEmail: email.replyToEmail ?? user?.email ?? "",
          replyToName: email.replyToName ?? salon.name,
        });
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("Impostazioni email non disponibili.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [salon, user?.email]);

  async function save() {
    if (!salon || !settings) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/categories/email`, {
        body: JSON.stringify({ settings }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setSaved(true);
    } catch {
      setError("Impostazioni email non salvate. Controlla i campi e riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return <AppPage maxWidth="max-w-[1600px]"><PageSkeleton /></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Comunicazioni" subtitle="Personalizza come il salone appare nelle email inviate dalla piattaforma." title="Personalizza email" />
      <SaveToast visible={saved}>Personalizzazione email salvata.</SaveToast>
      {error && <InlineError className="mb-5">{error}</InlineError>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard title="Identità mittente" subtitle="Il provider resta gestito da Platform; qui configuri nome, risposta e firma del salone.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nome mittente" required>
              <input className="w-full" onChange={(event) => setSettings({ ...settings, fromName: event.target.value })} placeholder={salon?.name ?? "Nome salone"} value={settings.fromName} />
            </FormField>
            <FormField label="Nome per le risposte">
              <input className="w-full" onChange={(event) => setSettings({ ...settings, replyToName: event.target.value })} placeholder={settings.fromName || salon?.name} value={settings.replyToName} />
            </FormField>
            <FormField className="md:col-span-2" description="Le risposte dei clienti arrivano a questo indirizzo." label="Email di risposta" required>
              <input className="w-full" onChange={(event) => setSettings({ ...settings, replyToEmail: event.target.value })} placeholder="info@salone.it" type="email" value={settings.replyToEmail} />
            </FormField>
            <FormField className="md:col-span-2" description="Testo aggiunto in fondo alle email operative e ai messaggi automatici." label="Firma o footer">
              <textarea className="min-h-32 w-full" onChange={(event) => setSettings({ ...settings, footer: event.target.value })} placeholder="Esse Beauty Milano · Via Roma 10 · info@salone.it" value={settings.footer} />
            </FormField>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 px-4 text-sm font-bold">
              <Switch aria-label="Email salone abilitate" checked={settings.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, enabled })} />
              Email salone abilitate
            </label>
            <SaveActionButton busy={saving} disabled={!settings.fromName.trim() || !settings.replyToEmail.trim()} idleLabel="Salva email" onClick={() => void save()} saved={saved} />
          </div>
        </SectionCard>

        <SectionCard title="Anteprima" subtitle="Aspetto dei dati salone dentro alle email.">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-white text-[#792f59] shadow-sm"><Mail aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-950">{settings.fromName || "Nome salone"}</p>
                <p className="truncate text-xs text-stone-500">Risposte a {settings.replyToEmail || "email salone"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 rounded-lg bg-white p-4 text-sm leading-6 text-stone-700">
              <p>Gentile cliente, trovi qui il riepilogo richiesto dal salone.</p>
              <div className="border-t border-stone-100 pt-3 text-xs leading-5 text-stone-500">
                <p className="flex items-center gap-2 font-bold text-stone-700"><Signature aria-hidden="true" className="size-4 text-[#792f59]" />Firma</p>
                <p className="mt-1 whitespace-pre-wrap">{settings.footer || "Footer non configurato."}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3 rounded-xl bg-[#f5fbf7] p-4 text-sm leading-6 text-stone-700">
            <Reply aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <p>Il mittente tecnico resta quello sicuro di Platform; il cliente vede il salone e può rispondere all’indirizzo indicato.</p>
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
