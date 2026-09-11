"use client";

import { useEffect, useState } from "react";
import { Palette, Sparkles, UserCircle2 } from "lucide-react";

import { AppPage, FormField, PageHeader, PageSkeleton, SaveActionButton, SaveToast, SectionCard, Switch, Select } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { CustomerAvatar, type DiceBearStyleKey } from "../../../../lib/customer-avatar";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface UiPreferences {
  accentColor: string;
  diceBearEnabled: boolean;
  diceBearStyle: DiceBearStyleKey;
  primaryColor: string;
}

const defaults: UiPreferences = {
  accentColor: "#b85888",
  diceBearEnabled: true,
  diceBearStyle: "initial-face",
  primaryColor: "#543147",
};

const palettePresets = [
  { accentColor: "#b85888", label: "EsseBeauty", primaryColor: "#543147" },
  { accentColor: "#c88943", label: "Gold", primaryColor: "#6f3f1f" },
  { accentColor: "#48a994", label: "Botanical", primaryColor: "#2f6f63" },
  { accentColor: "#8e7ac8", label: "Lavender", primaryColor: "#5f4a95" },
  { accentColor: "#df6f5f", label: "Coral", primaryColor: "#934236" },
];

const diceBearStyles: Array<{ label: string; value: DiceBearStyleKey }> = [
  { label: "Initial face", value: "initial-face" },
  { label: "Lorelei", value: "lorelei" },
  { label: "Micah", value: "micah" },
  { label: "Adventurer", value: "adventurer" },
];

function validColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function ColorField({ fallback, label, onChange, value }: { fallback: string; label: string; onChange(value: string): void; value: string }) {
  const color = validColor(value, fallback);
  return (
    <FormField label={label}>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-[var(--esse-petal,#f2e1eb)] px-3">
        <span className="size-8 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(214_211_209)]" style={{ background: color }} />
        <span className="sr-only">{label}</span>
        <input aria-label={label} className="min-h-0 w-28 border-0 bg-transparent p-0 text-sm font-black uppercase shadow-none" onChange={(event) => onChange(event.target.value)} value={value} />
        <input aria-label={`${label} picker`} className="ml-auto size-9 min-h-0 cursor-pointer border-0 bg-transparent p-0 shadow-none" onChange={(event) => onChange(event.target.value)} type="color" value={color} />
      </label>
    </FormField>
  );
}

export default function PersonalizationSettingsPage() {
  const { salon } = useAuth();
  const [preferences, setPreferences] = useState<UiPreferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    void fetch(`${api}/api/salons/${salon.id}/settings/categories/ui`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("LOAD_FAILED");
        const body = await response.json() as { settings?: Partial<UiPreferences> };
        setPreferences({ ...defaults, ...body.settings });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Personalizzazione non disponibile.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [salon]);

  async function save() {
    if (!salon) return;
    const next = {
      ...preferences,
      accentColor: validColor(preferences.accentColor, defaults.accentColor),
      primaryColor: validColor(preferences.primaryColor, defaults.primaryColor),
    };
    setSaving(true);
    setSaved(false);
    setMessage("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/categories/ui`, {
        body: JSON.stringify({ settings: next }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setPreferences(next);
      window.dispatchEvent(new CustomEvent("esse:ui-preferences-updated", { detail: next }));
      setSaved(true);
      setMessage("Personalizzazione salvata.");
    } catch {
      setMessage("Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppPage maxWidth="max-w-[1600px]"><PageSkeleton /></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast variant={message.includes("non riuscito") ? "error" : "success"} visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Esperienza" title="Personalizzazione" subtitle="Palette principale del gestionale e stile avatar usato nelle schede clienti." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard icon={Palette} title="Palette principale" subtitle="Aggiorna colore primario, accento e stati evidenziati dell’interfaccia.">
          <div className="grid gap-4 md:grid-cols-2">
            <ColorField fallback={defaults.primaryColor} label="Colore principale" onChange={(primaryColor) => setPreferences({ ...preferences, primaryColor })} value={preferences.primaryColor} />
            <ColorField fallback={defaults.accentColor} label="Colore accento" onChange={(accentColor) => setPreferences({ ...preferences, accentColor })} value={preferences.accentColor} />
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-stone-400">Preset</p>
              <div className="flex flex-wrap gap-2">
                {palettePresets.map((preset) => (
                  <button className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 hover:border-[var(--esse-mulberry)] hover:bg-[var(--esse-petal)]" key={preset.label} onClick={() => setPreferences({ ...preferences, accentColor: preset.accentColor, primaryColor: preset.primaryColor })} type="button">
                    <span className="flex -space-x-1"><i className="size-4 rounded-full border border-white" style={{ background: preset.primaryColor }} /><i className="size-4 rounded-full border border-white" style={{ background: preset.accentColor }} /></span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-stone-200 pt-4">
            <SaveActionButton busy={saving} idleLabel="Salva personalizzazione" onClick={() => void save()} saved={saved} />
          </div>
        </SectionCard>

        <SectionCard icon={UserCircle2} title="Avatar clienti" subtitle="Scegli se generare avatar DiceBear o mostrare iniziali coerenti con la palette.">
          <div className="space-y-4">
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-sm font-bold">
              Usa avatar DiceBear
              <Switch aria-label="Usa avatar DiceBear" checked={preferences.diceBearEnabled} onCheckedChange={(diceBearEnabled) => setPreferences({ ...preferences, diceBearEnabled })} />
            </label>
            <FormField label="Pacchetto DiceBear">
              <Select className="w-full" disabled={!preferences.diceBearEnabled} onChange={(event) => setPreferences({ ...preferences, diceBearStyle: event.target.value as DiceBearStyleKey })} value={preferences.diceBearStyle}>
                {diceBearStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
              </Select>
            </FormField>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-stone-500"><Sparkles className="size-4" />Anteprima</p>
              <div className="flex items-center gap-3">
                <CustomerAvatar className="size-14" id="preview" name="Giulia Bianchi" preference={preferences} size={56} />
                <div><p className="font-black text-stone-950">Giulia Bianchi</p><p className="text-sm text-stone-500">{preferences.diceBearEnabled ? diceBearStyles.find((item) => item.value === preferences.diceBearStyle)?.label : "Iniziali"}</p></div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
