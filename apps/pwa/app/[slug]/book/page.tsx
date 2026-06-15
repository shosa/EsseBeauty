"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatPrice } from "@esse-beauty/shared";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Service { id: string; name: string; durationMinutes: number; priceCents: number; }
interface Member { id: string; displayName: string; }
interface Slot { starts_at: string; available: boolean; }
interface Profile { salon: { name: string }; services: Service[]; staff: Member[]; }
interface Booking { id: string; startsAt: string; endsAt: string; service_name: string; staff_name: string; salon_name: string; }

function ics(value: string) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", ""); }
function saveCalendar(item: Booking) {
  const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Esse Beauty//IT","BEGIN:VEVENT",`UID:${item.id}@essebeauty`,
    `DTSTAMP:${ics(new Date().toISOString())}`,`DTSTART:${ics(item.startsAt)}`,`DTEND:${ics(item.endsAt)}`,
    `SUMMARY:${item.service_name} - ${item.salon_name}`,`DESCRIPTION:Con ${item.staff_name}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "appuntamento.ics"; link.click(); URL.revokeObjectURL(url);
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile>();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [booking, setBooking] = useState<Booking>();
  useEffect(() => { void fetch(`${api}/api/public/${slug}`).then((r) => r.json()).then(setProfile); }, [slug]);
  async function next() {
    const query = new URLSearchParams({ serviceId, date }); if (staffId) query.set("staffId", staffId);
    const result = await fetch(`${api}/api/public/${slug}/slots?${query}`).then((r) => r.json());
    setSlots(result.slots ?? []); setStep(2);
  }
  async function submit(data: FormData) {
    const response = await fetch(`${api}/api/public/${slug}/book`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service_id: serviceId, staff_id: staffId || undefined, starts_at: startsAt,
        customer: { full_name: data.get("name"), email: data.get("email"), phone: data.get("phone") } }) });
    if (response.ok) setBooking(await response.json());
  }
  if (booking) return <main className="min-h-screen bg-[#f8f2ef] p-4"><section className="mx-auto mt-14 max-w-md rounded-[2rem] bg-white p-7 text-center shadow-xl"><p className="text-5xl text-emerald-600">✓</p><h1 className="mt-4 text-3xl font-bold">Prenotazione inviata</h1><p className="mt-3 text-stone-600">{booking.service_name} con {booking.staff_name}</p><button onClick={() => saveCalendar(booking)} className="mt-7 min-h-12 w-full rounded-xl bg-stone-950 font-bold text-white">Aggiungi al calendario</button></section></main>;
  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f8f2ef]">Caricamento…</main>;
  return <main className="min-h-screen overflow-x-hidden bg-[#f8f2ef] px-4 py-6"><div className="mx-auto max-w-md"><p className="text-center text-xs font-bold uppercase tracking-[.2em] text-rose-700">{profile.salon.name}</p><h1 className="mt-2 text-center text-3xl font-bold">Prenota</h1>
    <div className="my-6 grid grid-cols-3 gap-2">{["Servizio","Orario","Dati"].map((label, index) => <span key={label} className={`rounded-full py-2 text-center text-xs font-bold ${step >= index + 1 ? "bg-stone-950 text-white" : "bg-white text-stone-400"}`}>{index + 1}/3</span>)}</div>
    {step === 1 && <section className="space-y-4 rounded-[2rem] bg-white p-5">{profile.services.map((service) => <button key={service.id} onClick={() => setServiceId(service.id)} className={`flex min-h-16 w-full items-center justify-between rounded-xl border p-3 text-left ${serviceId === service.id ? "border-rose-700 bg-rose-50" : "border-stone-200"}`}><span><b className="block">{service.name}</b><small>{service.durationMinutes} min</small></span><b>{formatPrice(service.priceCents, "it-IT")}</b></button>)}
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3"><option value="">Nessuna preferenza</option>{profile.staff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select>
      <input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} className="min-h-12 w-full rounded-xl border border-stone-300 px-3" /><button disabled={!serviceId} onClick={() => void next()} className="min-h-12 w-full rounded-xl bg-stone-950 font-bold text-white disabled:opacity-40">Continua</button></section>}
    {step === 2 && <section className="rounded-[2rem] bg-white p-5"><button onClick={() => setStep(1)}>← Indietro</button><div className="mt-4 grid grid-cols-3 gap-2">{slots.map((slot) => <button key={slot.starts_at} disabled={!slot.available} onClick={() => setStartsAt(slot.starts_at)} className={`min-h-12 rounded-xl border text-sm font-bold ${startsAt === slot.starts_at ? "bg-stone-950 text-white" : slot.available ? "" : "bg-stone-100 text-stone-300 line-through"}`}>{new Date(slot.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</button>)}</div><button disabled={!startsAt} onClick={() => setStep(3)} className="mt-5 min-h-12 w-full rounded-xl bg-stone-950 font-bold text-white disabled:opacity-40">Continua</button></section>}
    {step === 3 && <form action={submit} className="space-y-4 rounded-[2rem] bg-white p-5"><button type="button" onClick={() => setStep(2)}>← Indietro</button>{[["name","Nome e cognome","text"],["email","Email","email"],["phone","Telefono","tel"]].map(([name,label,type]) => <label key={name} className="block font-semibold">{label}<input name={name} type={type} required={name === "name"} className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 px-3" /></label>)}<button className="min-h-12 w-full rounded-xl bg-stone-950 font-bold text-white">Conferma prenotazione</button></form>}
  </div></main>;
}
