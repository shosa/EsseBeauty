"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { appointmentStatusLabel } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../../lib/api";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile { branding?: Branding | null; pwa?: { allowCancellation?: boolean; allowReschedule?: boolean }; salon: { name: string }; }
interface Item { id: string; starts_at: string; service_name: string; staff_name: string; status: string; }

export default function AppointmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [profile, setProfile] = useState<Profile>();
  const [requestedStartsAt, setRequestedStartsAt] = useState("");
  const [searched, setSearched] = useState(false);
  const [toast, setToast] = useState("");
  const primary = profile?.branding?.primaryColor || "#402334";
  const accent = profile?.branding?.accentColor || "#f4d8a8";

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setProfile(await response.json());
    });
  }, [slug]);

  async function search() {
    setSearched(true);
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments?email=${encodeURIComponent(email)}`);
    setItems(response.ok ? await response.json() : []);
  }

  async function cancel(appointmentId: string) {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/cancel`, {
      body: JSON.stringify({ email }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setToast(response.ok ? "Appuntamento annullato." : "Impossibile annullare l'appuntamento.");
    if (response.ok) await search();
  }

  async function requestReschedule(appointmentId: string) {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/reschedule-requests`, {
      body: JSON.stringify({ email, requested_starts_at: requestedStartsAt }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setToast(response.ok ? "Richiesta inviata al salone." : "Impossibile inviare la richiesta.");
    if (response.ok) setRequestedStartsAt("");
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top left, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <section className="mx-auto max-w-md">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile?.salon.name ?? "Area cliente"}</p>
          <h1 className="mt-3 text-4xl font-bold">I miei appuntamenti</h1>
          <p className="mt-2 text-sm text-white/75">Consulta le prossime prenotazioni usando la tua email.</p>
        </header>
        <div className="mt-6 rounded-[2rem] border border-white/80 bg-white/86 p-3 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
          <div className="flex gap-2">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="La tua email" className="min-w-0 flex-1" />
            <button disabled={!email.trim()} onClick={() => void search()} className="rounded-2xl px-5 font-black text-white disabled:opacity-40" style={{ background: primary }}>Cerca</button>
          </div>
        </div>
        {toast && <p className="mt-4 rounded-2xl bg-white/90 p-4 text-sm font-black text-stone-700 shadow-sm">{toast}</p>}
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[1.7rem] border border-white/80 bg-white/86 p-5 shadow-sm">
              <p className="text-sm font-black" style={{ color: primary }}>{new Date(item.starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
              <h2 className="mt-2 text-xl font-black text-stone-950">{item.service_name}</h2>
              <p className="mt-1 text-sm text-stone-500">con {item.staff_name} · {appointmentStatusLabel(item.status)}</p>
              {(profile?.pwa?.allowReschedule !== false || profile?.pwa?.allowCancellation !== false) && <div className="mt-4 rounded-2xl bg-stone-50 p-3">
                {profile?.pwa?.allowReschedule !== false && <>
                <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">
                  Richiedi nuovo orario
                  <input className="mt-2 w-full" type="datetime-local" value={requestedStartsAt} onChange={(event) => setRequestedStartsAt(event.target.value)} />
                </label>
                </>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {profile?.pwa?.allowReschedule !== false && <button disabled={!requestedStartsAt} onClick={() => void requestReschedule(item.id)} className="min-h-11 rounded-2xl bg-white px-3 text-xs font-black text-stone-700 disabled:opacity-40">Invia richiesta</button>}
                  {profile?.pwa?.allowCancellation !== false && <button onClick={() => void cancel(item.id)} className="min-h-11 rounded-2xl bg-red-50 px-3 text-xs font-black text-red-700">Annulla</button>}
                </div>
              </div>}
            </article>
          ))}
          {searched && items.length === 0 && <p className="rounded-[1.7rem] bg-white/86 p-5 text-sm font-semibold text-stone-600 shadow-sm">Nessun appuntamento futuro trovato per questa email.</p>}
        </div>
      </section>
    </main>
  );
}
