"use client";

import { useEffect, useState } from "react";
import { AppPage, Button, PageHeader, SectionCard, StatusBadge } from "@esse-beauty/ui";
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

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Notifiche" title="Promemoria appuntamenti" subtitle="Canali, tempi di invio e storico dei promemoria recenti." />
      <SectionCard title="Regole promemoria">
        <div className="grid gap-5 md:grid-cols-2">
          <div><h2 className="font-bold">Canali attivi</h2>{[["SMS", sms, setSms], ["Email", email, setEmail]].map(([label, value, setter]) => <label key={label as string} className="mt-4 flex items-center justify-between rounded-xl border border-stone-100 p-4"><span>{label as string}</span><input type="checkbox" checked={value as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="size-5 accent-[#792f59]" /></label>)}</div>
          <div><h2 className="font-bold">Quando inviarli</h2><div className="mt-4 grid grid-cols-2 gap-3">{options.map((value) => <label key={value} className="rounded-xl border border-stone-100 p-4"><input type="checkbox" checked={hours.includes(value)} onChange={() => setHours((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} className="mr-2 accent-[#792f59]" />{value} ore prima</label>)}</div></div>
          <Button onClick={() => void save()} className="md:col-span-2" variant="primary">Salva impostazioni</Button>
        </div>
      </SectionCard>
      <SectionCard className="mt-6" title="Invii recenti">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500"><tr><th className="p-4">Cliente</th><th>Canale</th><th>Invio</th><th>Stato</th></tr></thead>
            <tbody>{log.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-4 font-semibold">{item.customer_name}</td><td>{item.channel}</td><td>{item.sent_at ? new Date(item.sent_at).toLocaleString("it-IT") : "In coda"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody>
          </table>
        </div>
      </SectionCard>
    </AppPage>
  );
}
