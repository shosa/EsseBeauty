"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { WorkingHours } from "@esse-beauty/shared";
import { Button } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const days: Array<keyof WorkingHours> = ["mon","tue","wed","thu","fri","sat","sun"];
interface Member { id: string; displayName: string; bio?: string; color: string; specializations: string[]; workingHours: WorkingHours; }
interface Block { id: string; startsAt: string; endsAt: string; reason?: string; }

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useAuth();
  const [member, setMember] = useState<Member>();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const load = async () => {
    if (!salon) return;
    const [staff, absences] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, { credentials: "include" }).then((r) => r.json()),
    ]);
    setMember(staff.find((item: Member) => item.id === staffId)); setBlocks(absences);
  };
  useEffect(() => { void load(); }, [salon?.id, staffId]);
  async function save() {
    if (!member || !salon) return;
    await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: member.displayName, bio: member.bio, color: member.color, specializations: member.specializations, working_hours: member.workingHours }) });
  }
  async function addBlock(data: FormData) {
    if (!salon) return;
    await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ starts_at: data.get("starts"), ends_at: data.get("ends"), reason: data.get("reason"), recurring: false }) }); await load();
  }
  if (!member) return <main className="p-8">Caricamento…</main>;
  return <main className="min-h-screen bg-[#f7f5f2] p-5 md:p-10"><div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm font-bold uppercase tracking-[.2em] text-rose-700">Profilo staff</p><h1 className="text-3xl font-bold">{member.displayName}</h1></header>
    <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2"><label>Nome<input value={member.displayName} onChange={(e) => setMember({ ...member, displayName: e.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label><label>Colore<input type="color" value={member.color} onChange={(e) => setMember({ ...member, color: e.target.value })} className="mt-1 h-12 w-full rounded-xl border p-1" /></label><label className="md:col-span-2">Bio<textarea value={member.bio ?? ""} onChange={(e) => setMember({ ...member, bio: e.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label></section>
    <section><h2 className="mb-3 text-xl font-bold">Orari settimanali</h2><div className="grid grid-cols-1 gap-2 md:grid-cols-7">{days.map((day) => { const value = member.workingHours[day][0] ?? { from: "", to: "" }; return <article key={day} className="rounded-xl bg-white p-3 shadow-sm"><b className="uppercase">{day}</b><input type="time" value={value.from} onChange={(e) => setMember({ ...member, workingHours: { ...member.workingHours, [day]: e.target.value ? [{ from: e.target.value, to: value.to || "18:00" }] : [] } })} className="mt-2 w-full border p-2" /><input type="time" value={value.to} onChange={(e) => setMember({ ...member, workingHours: { ...member.workingHours, [day]: value.from ? [{ from: value.from, to: e.target.value }] : [] } })} className="mt-2 w-full border p-2" /></article>; })}</div><Button onClick={() => void save()} className="mt-4">Salva profilo e orari</Button></section>
    <section><h2 className="mb-3 text-xl font-bold">Blocchi disponibilità</h2><form action={addBlock} className="grid gap-2 rounded-2xl bg-white p-4 md:grid-cols-4"><input name="starts" type="datetime-local" required className="rounded-xl border p-3" /><input name="ends" type="datetime-local" required className="rounded-xl border p-3" /><input name="reason" placeholder="Motivo" className="rounded-xl border p-3" /><Button type="submit">Aggiungi blocco</Button></form><div className="mt-3 space-y-2">{blocks.map((block) => <article key={block.id} className="rounded-xl bg-white p-4 text-sm">{new Date(block.startsAt).toLocaleString("it-IT")} → {new Date(block.endsAt).toLocaleString("it-IT")} · {block.reason || "Non disponibile"}</article>)}</div></section>
  </div></main>;
}
