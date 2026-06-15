"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const options = [48, 24, 2, 1];

export default function ReminderSettingsPage() {
  const { salon } = useAuth();
  const [sms, setSms] = useState(false);
  const [email, setEmail] = useState(true);
  const [hours, setHours] = useState<number[]>([24]);
  const [log, setLog] = useState<Array<{ id: string; customer_name: string; channel: string; sent_at?: string; status: string }>>([]);

  useEffect(() => {
    if (!salon) return;
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/reminders/settings`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/reminders`, { credentials: "include" }).then((response) => response.json()),
    ]).then(([settings, reminders]) => {
      setSms(settings.smsEnabled); setEmail(settings.emailEnabled); setHours(settings.hoursBefore); setLog(reminders);
    });
  }, [salon]);

  async function save() {
    await fetch(`${api}/api/salons/${salon?.id}/reminders/settings`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ sms_enabled: sms, email_enabled: email, hours_before: hours }) });
  }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-5xl"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Notifiche</p><h1 className="mt-2 text-3xl font-bold">Promemoria appuntamenti</h1></header>
    <section className="mt-7 grid gap-5 rounded-[2rem] bg-white p-6 shadow-sm md:grid-cols-2"><div><h2 className="font-bold">Canali attivi</h2>{[["SMS", sms, setSms], ["Email", email, setEmail]].map(([label, value, setter]) => <label key={label as string} className="mt-4 flex items-center justify-between rounded-xl border border-stone-100 p-4"><span>{label as string}</span><input type="checkbox" checked={value as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="size-5 accent-[#792f59]" /></label>)}</div>
      <div><h2 className="font-bold">Quando inviarli</h2><div className="mt-4 grid grid-cols-2 gap-3">{options.map((value) => <label key={value} className="rounded-xl border border-stone-100 p-4"><input type="checkbox" checked={hours.includes(value)} onChange={() => setHours((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} className="mr-2 accent-[#792f59]" />{value} ore prima</label>)}</div></div>
      <button onClick={() => void save()} className="min-h-12 rounded-xl bg-[#402334] px-6 font-bold text-white md:col-span-2">Salva impostazioni</button></section>
    <section className="mt-6 overflow-hidden rounded-[2rem] bg-white shadow-sm"><h2 className="p-6 text-xl font-bold">Invii recenti</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-stone-500"><tr><th className="p-4">Cliente</th><th>Canale</th><th>Invio</th><th>Stato</th></tr></thead><tbody>{log.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-4 font-semibold">{item.customer_name}</td><td>{item.channel}</td><td>{item.sent_at ? new Date(item.sent_at).toLocaleString("it-IT") : "In coda"}</td><td><span className="rounded-full bg-stone-100 px-3 py-1">{item.status}</span></td></tr>)}</tbody></table></div></section>
  </div></main>;
}
