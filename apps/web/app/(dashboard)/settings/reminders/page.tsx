"use client";

import { useEffect, useState } from "react";
import { AppPage, EmptyState, InlineError, PageHeader, SaveToast, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const options = [48, 24, 2, 1];

export default function ReminderSettingsPage() {
  const { salon } = useAuth();
  const [whatsapp, setWhatsapp] = useState(false);
  const [email, setEmail] = useState(true);
  const [hours, setHours] = useState<number[]>([24]);
  const [log, setLog] = useState<Array<{ id: string; customer_name: string; channel: string; sent_at?: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/reminders/settings`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/reminders`, { credentials: "include" }),
    ]).then(async ([settingsResponse, remindersResponse]) => {
      if (!settingsResponse.ok || !remindersResponse.ok) throw new Error("LOAD_FAILED");
      const settings = await settingsResponse.json();
      const reminders = await remindersResponse.json();
      setWhatsapp(settings.whatsappEnabled); setEmail(settings.emailEnabled); setHours(settings.hoursBefore); setLog(reminders);
    }).catch(() => setError("Impossibile caricare le impostazioni dei promemoria."))
      .finally(() => setLoading(false));
  }, [salon]);

  async function save(nextWhatsapp: boolean, nextEmail: boolean, nextHours: number[]) {
    if (!salon || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/reminders/settings`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ whatsapp_enabled: nextWhatsapp, email_enabled: nextEmail, hours_before: nextHours }) });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setSaved(true);
    } catch {
      setError("Salvataggio dei promemoria non riuscito. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Notifiche" title="Promemoria appuntamenti" subtitle="Canali, tempi di invio e storico dei promemoria recenti." />
      <SaveToast visible={saved}>Impostazioni promemoria salvate.</SaveToast>
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {loading ? <div aria-label="Caricamento promemoria" className="h-64 animate-pulse rounded-2xl bg-stone-100" role="status" /> : <>
      <SectionCard title="Regole promemoria">
        <div className="grid gap-5 md:grid-cols-2">
          <fieldset><legend className="font-semibold">Canali attivi</legend>{[["WhatsApp", whatsapp, setWhatsapp], ["Email", email, setEmail]].map(([label, value, setter]) => <label key={label as string} className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-stone-200 p-4"><span>{label as string}</span><Switch aria-label={`Promemoria ${label as string}`} checked={value as boolean} disabled={saving} onCheckedChange={(checked) => { (setter as (value: boolean) => void)(checked); void save(label === "WhatsApp" ? checked : whatsapp, label === "Email" ? checked : email, hours); }} /></label>)}</fieldset>
          <fieldset><legend className="font-semibold">Quando inviarli</legend><div className="mt-4 grid grid-cols-2 gap-3">{options.map((value) => <label key={value} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border p-4 ${hours.includes(value) ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200"}`}><span>{value} ore prima</span><Switch checked={hours.includes(value)} disabled={saving} onCheckedChange={() => { const nextHours = hours.includes(value) ? hours.filter((item) => item !== value) : [...hours, value]; setHours(nextHours); void save(whatsapp, email, nextHours); }} /></label>)}</div></fieldset>
          <p aria-live="polite" className="text-right text-xs font-medium text-stone-500 md:col-span-2">{saving ? "Salvataggio automatico…" : saved ? "Modifiche salvate" : "Le modifiche vengono salvate all’azione."}</p>
        </div>
      </SectionCard>
      <SectionCard className="mt-6" title="Invii recenti">
        {log.length === 0 ? <EmptyState description="Gli invii completati o in coda compariranno qui." title="Nessun promemoria recente" /> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500"><tr><th className="p-4">Cliente</th><th>Canale</th><th>Invio</th><th>Stato</th></tr></thead>
            <tbody>{log.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-4 font-semibold">{item.customer_name}</td><td>{item.channel}</td><td>{item.sent_at ? new Date(item.sent_at).toLocaleString("it-IT") : "In coda"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody>
          </table>
        </div>}
      </SectionCard>
      </>}
    </AppPage>
  );
}
