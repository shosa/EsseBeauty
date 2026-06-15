"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PERMISSION_KEYS, type WorkingHours } from "@esse-beauty/shared";
import { Button, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Member { id: string; displayName: string; bio?: string; specializations: string[]; color: string; active: boolean; workingHours: WorkingHours; }

export default function StaffPage() {
  const [staff, setStaff] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { hasPermission, salon } = useAuth();
  const canEdit = hasPermission(PERMISSION_KEYS.SETTINGS_STAFF);
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then(async (response) => {
    if (!response.ok) throw new Error("Impossibile caricare lo staff.");
    const data: unknown = await response.json();
    setStaff(Array.isArray(data) ? data as Member[] : []);
  }).catch((reason: Error) => setError(reason.message)) : Promise.resolve();
  useEffect(() => { void load(); }, [salon?.id]);
  async function add() {
    const empty = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const response = await fetch(`${api}/api/salons/${salon?.id}/staff`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: name, working_hours: empty, color: "#be6b7b" }) });
    if (!response.ok) { setError("Il collaboratore non è stato creato."); return; }
    setName(""); await load();
  }
  async function toggle(member: Member) {
    await fetch(`${api}/api/salons/${salon?.id}/staff/${member.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !member.active }) }); await load();
  }
  return <main className="min-h-screen bg-[#f7f5f2] p-5 md:p-10"><div className="mx-auto max-w-5xl">
    <header className="mb-8"><p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-700">Team</p><h1 className="text-3xl font-bold">Staff</h1></header>
    {error && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!canEdit && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Il tuo account può consultare lo staff, ma non modificarlo.</p>}
    {canEdit && <section className="mb-6 flex gap-3 rounded-2xl border border-stone-200 bg-white p-4"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome collaboratore" className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4" /><Button disabled={name.trim().length < 2} onClick={add}>Aggiungi</Button></section>}
    {staff.length === 0 ? <section className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">Nessun collaboratore</h2><p className="mt-2 text-sm text-stone-500">Aggiungi almeno una persona per assegnare appuntamenti e disponibilità.</p></section> : <div className="grid gap-4 md:grid-cols-2">{staff.map((member) => <article key={member.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><div className="flex gap-3"><span className="mt-1 h-10 w-2 rounded-full" style={{ background: member.color }} /><div><h2 className="text-lg font-bold">{member.displayName}</h2><p className="text-sm text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</p></div></div>
        {canEdit && <Switch checked={member.active} onCheckedChange={() => void toggle(member)} />}</div>
      <p className="mt-5 text-sm text-stone-600">{member.bio || "Profilo operativo pronto per orari e blocchi di disponibilità."}</p>
      <div className="mt-5 grid grid-cols-7 gap-1">{Object.entries(member.workingHours).map(([day, hours]) => <div key={day} className="text-center"><span className="text-[10px] font-bold uppercase text-stone-400">{day}</span><div className={`mt-1 h-8 rounded-md ${hours.length ? "bg-rose-100" : "bg-stone-100"}`} /></div>)}</div>
      {canEdit && <Link href={`/staff/${member.id}`} className="mt-4 inline-block text-sm font-bold text-rose-700">Modifica profilo →</Link>}
    </article>)}</div>}
  </div></main>;
}
