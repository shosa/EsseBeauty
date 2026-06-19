"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatPrice } from "@esse-beauty/shared";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Branding {
  accentColor?: string;
  heroTitle?: string;
  primaryColor?: string;
}
interface Service {
  category?: string;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}
interface Member {
  displayName: string;
  id: string;
}
interface Slot {
  available: boolean;
  starts_at: string;
}
interface Profile {
  branding?: Branding | null;
  salon: { name: string };
  services: Service[];
  staff: Member[];
}
interface Booking {
  endsAt: string;
  id: string;
  salon_name: string;
  service_name: string;
  staff_name: string;
  startsAt: string;
}

function ics(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", "");
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function saveCalendar(item: Booking) {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Esse Beauty//IT",
    "BEGIN:VEVENT",
    `UID:${item.id}@essebeauty`,
    `DTSTAMP:${ics(new Date().toISOString())}`,
    `DTSTART:${ics(item.startsAt)}`,
    `DTEND:${ics(item.endsAt)}`,
    `SUMMARY:${item.service_name} - ${item.salon_name}`,
    `DESCRIPTION:Con ${firstName(item.staff_name)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "appuntamento.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile>();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [booking, setBooking] = useState<Booking>();
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    void fetch(`${api}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!response.ok) {
        setError("Salone non trovato.");
        return;
      }
      setProfile(await response.json());
    });
  }, [slug]);

  const selectedService = profile?.services.find((service) => service.id === serviceId);
  const categories = useMemo(
    () => profile ? [...new Set(profile.services.map((service) => service.category).filter((value): value is string => Boolean(value)))] : [],
    [profile],
  );
  const filteredServices = useMemo(
    () => profile?.services.filter((service) => service.category === category) ?? [],
    [category, profile],
  );
  const brand = profile?.branding;
  const primary = brand?.primaryColor || "#402334";
  const accent = brand?.accentColor || "#f4d8a8";

  async function next() {
    setLoadingSlots(true);
    setError("");
    const query = new URLSearchParams({ date, serviceId });
    if (staffId) query.set("staffId", staffId);
    const response = await fetch(`${api}/api/public/${slug}/slots?${query}`);
    setLoadingSlots(false);
    if (response.status === 503) {
      setUnavailable(true);
      return;
    }
    if (!response.ok) {
      setError("Impossibile caricare gli orari disponibili.");
      return;
    }
    const result = await response.json() as { slots?: Slot[] };
    setSlots(result.slots ?? []);
    setStartsAt("");
    setStep(2);
  }

  async function submit(data: FormData) {
    setError("");
    const response = await fetch(`${api}/api/public/${slug}/book`, {
      body: JSON.stringify({
        customer: {
          email: data.get("email"),
          full_name: data.get("name"),
          phone: data.get("phone"),
        },
        service_id: serviceId,
        staff_id: staffId || undefined,
        starts_at: startsAt,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (response.ok) {
      setBooking(await response.json());
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 503) setUnavailable(true);
    else if (response.status === 403 && result.error === "CUSTOMER_BLOCKED") setError("Non è possibile prenotare online con questi dati. Contatta il salone.");
    else setError("Prenotazione non riuscita. Verifica i dati e riprova.");
  }

  if (unavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
        <section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-bold">Prenotazioni non disponibili</h1>
          <p className="mt-3 text-stone-600">Il salone ha sospeso temporaneamente le prenotazioni online.</p>
        </section>
      </main>
    );
  }

  if (booking) {
    return (
      <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top, ${accent}55, transparent 20rem), #f6f2f4` }}>
        <section className="mx-auto max-w-md rounded-[2.2rem] bg-white p-7 text-center shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl text-2xl font-black text-white" style={{ background: primary }}>✓</span>
          <h1 className="mt-5 text-3xl font-bold">Prenotazione inviata</h1>
          <p className="mt-3 text-stone-600">{booking.service_name} con {firstName(booking.staff_name)}</p>
          <p className="mt-1 text-sm font-bold text-[#792f59]">{new Date(booking.startsAt).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
          <button onClick={() => saveCalendar(booking)} className="mt-7 min-h-12 w-full rounded-2xl font-black text-white shadow-lg" style={{ background: primary }}>Aggiungi al calendario</button>
          <Link className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-stone-100 font-black text-stone-700" href={`/${slug}`}>Torna alla home</Link>
        </section>
      </main>
    );
  }

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] text-sm font-black text-[#792f59]">Preparazione agenda...</main>;

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-6" style={{ background: `radial-gradient(circle at 10% 0%, ${accent}60, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <div className="mx-auto max-w-md">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.18)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile.salon.name}</p>
          <h1 className="mt-3 text-4xl font-bold">Prenota</h1>
          <p className="mt-2 text-sm text-white/75">{selectedService ? selectedService.name : "Parti dalla categoria, scegli il trattamento e trova il tuo orario."}</p>
        </header>

        {error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

        <div className="my-5 grid grid-cols-3 gap-2">
          {["Trattamento", "Orario", "Dati"].map((label, index) => (
            <span key={label} className={`rounded-2xl py-3 text-center text-xs font-black ${step >= index + 1 ? "text-white" : "bg-white text-stone-400"}`} style={step >= index + 1 ? { background: primary } : undefined}>
              {label}
            </span>
          ))}
        </div>

        {step === 1 && (
          <section className="space-y-4 rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
            <div>
              <p className="text-sm font-black text-stone-800">Categoria</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {categories.map((item) => (
                  <button
                    className={`min-h-14 rounded-2xl border px-3 text-sm font-black transition ${category === item ? "text-white shadow-md" : "border-stone-100 bg-white text-stone-700 hover:border-[#d99aba]"}`}
                    key={item}
                    onClick={() => {
                      setCategory(item);
                      setServiceId("");
                      setStartsAt("");
                    }}
                    style={category === item ? { background: primary, borderColor: primary } : undefined}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {category && (
              <div>
                <p className="text-sm font-black text-stone-800">Trattamento</p>
                <div className="mt-2 space-y-2">
                  {filteredServices.map((service) => (
                    <button key={service.id} onClick={() => setServiceId(service.id)} type="button" className={`flex min-h-16 w-full items-center justify-between rounded-2xl border p-3 text-left transition ${serviceId === service.id ? "border-[#792f59] bg-[#faf3f7] shadow-sm" : "border-stone-100 bg-white hover:border-[#d99aba]"}`}>
                      <span><b className="block">{service.name}</b><small className="text-stone-500">{service.durationMinutes} min</small></span>
                      <b style={{ color: primary }}>{formatPrice(service.priceCents, "it-IT")}</b>
                    </button>
                  ))}
                  {filteredServices.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Nessun trattamento disponibile in questa categoria.</p>}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-black text-stone-800">Preferenza staff</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={`min-h-11 rounded-full border px-4 text-sm font-bold ${staffId === "" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => setStaffId("")} style={staffId === "" ? { background: primary, borderColor: primary } : undefined} type="button">Nessuna preferenza</button>
                {profile.staff.map((member) => (
                  <button
                    className={`min-h-11 rounded-full border px-4 text-sm font-bold ${staffId === member.id ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                    key={member.id}
                    onClick={() => setStaffId(member.id)}
                    style={staffId === member.id ? { background: primary, borderColor: primary } : undefined}
                    type="button"
                  >
                    {firstName(member.displayName)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-black text-stone-800" htmlFor="booking-date">Data</label>
            <input id="booking-date" min={new Date().toISOString().slice(0, 10)} type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full" />
            <button disabled={!serviceId || loadingSlots} onClick={() => void next()} className="min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-40" style={{ background: primary }}>{loadingSlots ? "Cerco orari..." : "Mostra orari"}</button>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
            <button className="mb-4 text-sm font-black text-[#792f59]" onClick={() => setStep(1)}>← Cambia servizio</button>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button key={slot.starts_at} disabled={!slot.available} onClick={() => setStartsAt(slot.starts_at)} className={`min-h-12 rounded-2xl border text-sm font-black ${startsAt === slot.starts_at ? "text-white" : slot.available ? "border-stone-100 bg-white text-stone-800" : "border-stone-100 bg-stone-100 text-stone-300 line-through"}`} style={startsAt === slot.starts_at ? { background: primary } : undefined}>
                  {new Date(slot.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
            {slots.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Nessun orario disponibile per questa data.</p>}
            <button disabled={!startsAt} onClick={() => setStep(3)} className="mt-5 min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-40" style={{ background: primary }}>Continua</button>
          </section>
        )}

        {step === 3 && (
          <form action={submit} className="space-y-4 rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
            <button type="button" className="text-sm font-black text-[#792f59]" onClick={() => setStep(2)}>← Cambia orario</button>
            {[
              ["name", "Nome e cognome", "text"],
              ["email", "Email", "email"],
              ["phone", "Telefono", "tel"],
            ].map(([name, label, type]) => (
              <label key={name} className="block text-sm font-black text-stone-800">
                {label}
                <input name={name} type={type} required={name === "name"} className="mt-2 w-full" />
              </label>
            ))}
            <button className="min-h-12 w-full rounded-2xl font-black text-white" style={{ background: primary }}>Conferma prenotazione</button>
          </form>
        )}
      </div>
    </main>
  );
}
