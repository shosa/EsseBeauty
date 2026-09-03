"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, Send, Trash2, UserRound } from "lucide-react";
import { appointmentStatusLabel } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../../lib/api";
import { DateTimeField } from "../../_components/DateTimeField";
import { CustomerAuthOverlay } from "../_components/CustomerAuthOverlay";
import { useCustomerAuth } from "../_components/CustomerAuthProvider";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile { branding?: Branding | null; pwa?: { allowCancellation?: boolean; allowReschedule?: boolean; requireEmail?: boolean }; salon: { name: string }; }
interface Item { id: string; starts_at: string; service_name: string; staff_name: string; status: string; }

export default function AppointmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus } = useCustomerAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [profile, setProfile] = useState<Profile>();
  const [requestedStartsAt, setRequestedStartsAt] = useState<Record<string, string>>({});
  const [loadedItems, setLoadedItems] = useState(false);
  const [toast, setToast] = useState("");
  const primary = profile?.branding?.primaryColor || "#402334";
  const accent = profile?.branding?.accentColor || "#f4d8a8";

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setProfile(await response.json());
    });
  }, [slug]);

  async function search() {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments`, { credentials: "include" });
    setItems(response.ok ? await response.json() : []);
    setLoadedItems(true);
  }

  useEffect(() => {
    if (authStatus === "authenticated") void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, slug]);

  async function cancel(appointmentId: string) {
    if (!window.confirm("Vuoi annullare questo appuntamento?")) return;
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/cancel`, {
      credentials: "include",
      method: "POST",
    });
    setToast(response.ok ? "Appuntamento annullato." : "Impossibile annullare l'appuntamento.");
    if (response.ok) await search();
  }

  async function requestReschedule(appointmentId: string) {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/reschedule-requests`, {
      body: JSON.stringify({ requested_starts_at: requestedStartsAt[appointmentId] }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setToast(response.ok ? "Richiesta inviata al salone." : "Impossibile inviare la richiesta.");
    if (response.ok) setRequestedStartsAt((current) => ({ ...current, [appointmentId]: "" }));
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top left, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <section className="mx-auto max-w-md">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile?.salon.name ?? "Area cliente"}</p>
          <h1 className="mt-3 text-4xl font-bold">I miei appuntamenti</h1>
          <p className="mt-2 text-sm text-white/75">Consulta le prossime prenotazioni del tuo account.</p>
        </header>
        {toast && <p className="animate-reveal mt-4 rounded-2xl bg-white/90 p-4 text-sm font-black text-stone-700 shadow-sm">{toast}</p>}
        {authStatus === "authenticated" && (
          <div className="mt-5 space-y-3">
            {items.map((item, index) => (
              <article className="animate-reveal rounded-[1.7rem] border border-white/80 bg-white/86 p-5 shadow-sm" key={item.id} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
                <p className="flex items-center gap-2 text-sm font-black" style={{ color: primary }}><CalendarClock className="size-4" />{new Date(item.starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
                <h2 className="mt-2 text-xl font-black text-stone-950">{item.service_name}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><UserRound className="size-4" />con {item.staff_name} · {appointmentStatusLabel(item.status)}</p>
                {(profile?.pwa?.allowReschedule !== false || profile?.pwa?.allowCancellation !== false) && <div className="mt-4 rounded-2xl bg-stone-50 p-3">
                  {profile?.pwa?.allowReschedule !== false && <>
                  <p className="text-xs font-black uppercase tracking-[.12em] text-stone-500">Richiedi nuovo orario</p>
                  <DateTimeField min={new Date().toISOString().slice(0, 16)} onChange={(nextValue) => setRequestedStartsAt((current) => ({ ...current, [item.id]: nextValue }))} primary={primary} value={requestedStartsAt[item.id] ?? ""} />
                  </>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {profile?.pwa?.allowReschedule !== false && <button disabled={!requestedStartsAt[item.id]} onClick={() => void requestReschedule(item.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-stone-700 transition-colors disabled:opacity-40"><Send className="size-4" />Invia richiesta</button>}
                    {profile?.pwa?.allowCancellation !== false && <button onClick={() => void cancel(item.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-xs font-black text-red-700 transition-colors hover:bg-red-100"><Trash2 className="size-4" />Annulla</button>}
                  </div>
                </div>}
              </article>
            ))}
            {loadedItems && items.length === 0 && <p className="animate-reveal rounded-[1.7rem] bg-white/86 p-5 text-sm font-semibold text-stone-600 shadow-sm">Nessun appuntamento futuro trovato per il tuo account.</p>}
          </div>
        )}
      </section>
      {authStatus === "anonymous" && (
        <CustomerAuthOverlay accent={accent} primary={primary} requireEmail={profile?.pwa?.requireEmail !== false} salonName={profile?.salon.name} subtitle="Accedi per consultare i tuoi appuntamenti, oppure registrati se non hai ancora un account." />
      )}
    </main>
  );
}
