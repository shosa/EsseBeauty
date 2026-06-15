"use client";

import { useEffect, useState } from "react";

import type { WorkingHours } from "@esse-beauty/shared";
import { Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const days: Array<{ key: keyof WorkingHours; label: string }> = [
  { key: "mon", label: "Lunedì" },
  { key: "tue", label: "Martedì" },
  { key: "wed", label: "Mercoledì" },
  { key: "thu", label: "Giovedì" },
  { key: "fri", label: "Venerdì" },
  { key: "sat", label: "Sabato" },
  { key: "sun", label: "Domenica" },
];

interface Settings {
  name: string;
  timezone: string;
  locale: string;
  openingHours: WorkingHours;
  cancellationPolicyHours: number;
  onlineBookingEnabled: boolean;
}

export default function GeneralSettingsPage() {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<Settings>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/settings`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then(setSettings);
  }, [salon]);

  function updateDay(
    day: keyof WorkingHours,
    field: "from" | "to",
    value: string,
  ) {
    setSettings((current) => current ? {
      ...current,
      openingHours: {
        ...current.openingHours,
        [day]: [{
          from: current.openingHours[day][0]?.from ?? "09:00",
          to: current.openingHours[day][0]?.to ?? "18:00",
          [field]: value,
        }],
      },
    } : current);
  }

  function toggleDay(day: keyof WorkingHours, open: boolean) {
    setSettings((current) => current ? {
      ...current,
      openingHours: {
        ...current.openingHours,
        [day]: open ? [{ from: "09:00", to: "18:00" }] : [],
      },
    } : current);
  }

  async function save() {
    if (!settings || !salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: settings.name,
        timezone: settings.timezone,
        locale: settings.locale,
        opening_hours: settings.openingHours,
        cancellation_policy_hours: settings.cancellationPolicyHours,
        online_booking_enabled: settings.onlineBookingEnabled,
      }),
    });
    setSaved(response.ok);
  }

  if (!settings) {
    return <main className="mx-auto max-w-6xl p-5 md:p-10"><div className="h-96 animate-pulse rounded-[2rem] bg-white" /></main>;
  }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-4xl"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Impostazioni</p><h1 className="mt-2 text-3xl font-bold">Dati del salone</h1></header>
    <section className="mt-7 space-y-6 rounded-[2rem] bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">Nome<input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold">Fuso orario<select value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"><option>Europe/Rome</option><option>Europe/London</option><option>America/New_York</option></select></label><label className="text-sm font-semibold">Lingua<select value={settings.locale} onChange={(event) => setSettings({ ...settings, locale: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"><option value="it-IT">Italiano</option><option value="en-GB">English</option></select></label></div>
      <div><h2 className="font-bold">Orari di apertura</h2><div className="mt-3 space-y-2">{days.map((day) => {
        const interval = settings.openingHours[day.key][0];
        return <div key={day.key} className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-3 rounded-xl bg-stone-50 p-3"><b className="text-sm">{day.label}</b><Switch checked={Boolean(interval)} onCheckedChange={(open) => toggleDay(day.key, open)} /><input disabled={!interval} type="time" value={interval?.from ?? "09:00"} onChange={(event) => updateDay(day.key, "from", event.target.value)} className="min-h-10 rounded-lg border px-2 disabled:opacity-35" /><input disabled={!interval} type="time" value={interval?.to ?? "18:00"} onChange={(event) => updateDay(day.key, "to", event.target.value)} className="min-h-10 rounded-lg border px-2 disabled:opacity-35" /></div>;
      })}</div></div>
      <div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-semibold">Preavviso cancellazione (ore)<input type="number" min="0" value={settings.cancellationPolicyHours} onChange={(event) => setSettings({ ...settings, cancellationPolicyHours: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border px-3" /></label><label className="flex items-center justify-between rounded-xl border border-stone-200 p-4"><span><b className="block">Prenotazione online</b><small className="text-stone-500">Abilita il portale pubblico</small></span><Switch checked={settings.onlineBookingEnabled} onCheckedChange={(onlineBookingEnabled) => setSettings({ ...settings, onlineBookingEnabled })} /></label></div>
      <button onClick={() => void save()} className="min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white">Salva modifiche</button>{saved && <p className="text-center text-sm text-emerald-700">Impostazioni salvate.</p>}
    </section>
  </div></main>;
}
