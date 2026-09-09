"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";

import { AppPage, Button, FormField, InlineError, PageHeader, PageTransition, SaveToast, SectionCard, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type EarningAction = "appointment_completed" | "service_purchased" | "product_purchased" | "euro_spent" | "birthday" | "review_submitted";
interface EarningRule { action: EarningAction; active: boolean; points: number; }
interface LoyaltySettings { allowNegativeBalance: boolean; earningRules?: EarningRule[]; pointsExpireAfterDays: number | null; pointsPerAppointment: number; }

const defaultRules: EarningRule[] = [
  { action: "appointment_completed", active: true, points: 10 },
  { action: "service_purchased", active: false, points: 5 },
  { action: "product_purchased", active: false, points: 1 },
  { action: "euro_spent", active: false, points: 1 },
  { action: "birthday", active: false, points: 20 },
  { action: "review_submitted", active: false, points: 5 },
];
const ruleMeta: Record<EarningAction, { label: string; unit: string }> = {
  appointment_completed: { label: "Appuntamento completato", unit: "per appuntamento" },
  service_purchased: { label: "Servizio acquistato", unit: "per servizio" },
  product_purchased: { label: "Prodotto acquistato", unit: "per prodotto" },
  euro_spent: { label: "Euro speso", unit: "per euro intero" },
  birthday: { label: "Compleanno del cliente", unit: "una volta l'anno, se in anagrafica" },
  review_submitted: { label: "Recensione lasciata", unit: "per recensione" },
};

export default function LoyaltySettingsPage() {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<LoyaltySettings>();
  const [rules, setRules] = useState(defaultRules);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, { credentials: "include" });
    if (!response.ok) {
      setError("Non riesco a caricare le impostazioni del programma fedeltà.");
      setLoading(false);
      return;
    }
    const data = await response.json() as LoyaltySettings;
    setSettings(data);
    setRules(defaultRules.map((fallback) => data.earningRules?.find((rule) => rule.action === fallback.action) ?? fallback));
    setLoading(false);
  }

  useEffect(() => { void loadSettings(); }, [salon?.id]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveRules() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        allow_negative_balance: settings?.allowNegativeBalance ?? false,
        earning_rules: rules,
        points_expire_after_days: settings?.pointsExpireAfterDays ?? null,
        points_per_appointment: rules.find((rule) => rule.action === "appointment_completed")?.points ?? 0,
      }),
    });
    if (!response.ok) return setError("Salvataggio delle regole non riuscito.");
    setError("");
    setMessage("Regole di accumulo aggiornate.");
    await loadSettings();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast visible={Boolean(message)}>{message}</SaveToast>
        <PageHeader eyebrow="Fedeltà" title="Impostazioni" subtitle="Punti assegnati automaticamente da appuntamenti e vendite reali." />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : (
          <SectionCard icon={ListChecks} title="Regole di accumulo" subtitle="Punti assegnati automaticamente da appuntamenti e vendite reali.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {rules.map((rule) => <article className={`rounded-xl border p-4 ${rule.active ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200 bg-stone-50"}`} key={rule.action}><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-black">{ruleMeta[rule.action].label}</h3><p className="text-xs text-stone-500">{ruleMeta[rule.action].unit}</p></div><button aria-label={`${rule.active ? "Disattiva" : "Attiva"} ${ruleMeta[rule.action].label}`} className={`relative h-6 w-10 rounded-full ${rule.active ? "bg-emerald-600" : "bg-stone-300"}`} onClick={() => setRules((current) => current.map((item) => item.action === rule.action ? { ...item, active: !item.active } : item))} type="button"><span className={`absolute top-1 size-4 rounded-full bg-white transition ${rule.active ? "left-5" : "left-1"}`} /></button></div><input className="mt-3 w-full" disabled={!rule.active} min={0} onChange={(event) => setRules((current) => current.map((item) => item.action === rule.action ? { ...item, points: Math.max(0, Number(event.target.value)) } : item))} type="number" value={rule.points} /></article>)}
            </div>
            <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 md:grid-cols-2">
              <FormField label="Scadenza punti"><div className="flex items-center gap-2"><input className="w-32" min={1} onChange={(event) => setSettings((current) => current ? { ...current, pointsExpireAfterDays: event.target.value ? Number(event.target.value) : null } : current)} placeholder="Mai" type="number" value={settings?.pointsExpireAfterDays ?? ""} /><span className="text-sm text-stone-500">giorni; vuoto = nessuna scadenza</span></div></FormField>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm"><Switch checked={settings?.allowNegativeBalance ?? false} onCheckedChange={(allowNegativeBalance) => setSettings((current) => current ? { ...current, allowNegativeBalance } : current)} /><span><b className="block">Correzioni sotto zero</b><span className="text-xs text-stone-500">Consenti solo se la tua procedura lo richiede.</span></span></label>
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => void saveRules()}>Salva regole</Button></div>
          </SectionCard>
        )}
      </PageTransition>
    </AppPage>
  );
}
