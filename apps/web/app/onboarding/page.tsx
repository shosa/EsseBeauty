"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { WorkingHours } from "@esse-beauty/shared";
import { Button, FormField, ScheduleEditor } from "@esse-beauty/ui";

import { AuthProvider, useAuth } from "../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const defaultHours: WorkingHours = {
  mon: [{ from: "09:00", to: "18:00" }],
  tue: [{ from: "09:00", to: "18:00" }],
  wed: [{ from: "09:00", to: "18:00" }],
  thu: [{ from: "09:00", to: "18:00" }],
  fri: [{ from: "09:00", to: "18:00" }],
  sat: [],
  sun: [],
};
const colors = ["#792f59", "#b85888", "#5f7661", "#8b6f47", "#536b89", "#9b5c45"];
const labels = ["Salone", "Orari", "Servizi", "Staff", "Riepilogo"];

interface ServiceDraft {
  category: string;
  duration_minutes: number;
  name: string;
  price: string;
}

interface ServiceForm {
  category: string;
  duration_minutes: string;
  name: string;
  price: string;
}

interface StaffDraft {
  color: string;
  display_name: string;
}

function OnboardingWizard() {
  const router = useRouter();
  const { loading, salon, user } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState({ address: "", email: "", name: "", phone: "" });
  const [hours, setHours] = useState<WorkingHours>(defaultHours);
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    category: "",
    duration_minutes: "",
    name: "",
    price: "",
  });
  const [team, setTeam] = useState<StaffDraft[]>([]);
  const [linkOwner, setLinkOwner] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !salon) {
      router.replace("/login");
      return;
    }
    if (user.role !== "owner" || salon.onboarding_completed) {
      router.replace("/");
      return;
    }
    void fetch(`${api}/api/onboarding`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Configurazione non disponibile.");
        return response.json();
      })
      .then((data) => {
        setStep(Math.max(1, Math.min(5, data.step ?? 1)));
        setIdentity({
          address: data.salon.address,
          email: data.salon.email,
          name: data.salon.name,
          phone: data.salon.phone,
        });
        setHours(data.salon.opening_hours ?? defaultHours);
        if (data.services.length) {
          setServices(data.services.map((item: { category: string; duration_minutes: number; name: string; price_cents: number }) => ({
            category: item.category,
            duration_minutes: item.duration_minutes,
            name: item.name,
            price: (item.price_cents / 100).toFixed(2),
          })));
        }
        if (data.staff.length) {
          setTeam(data.staff.map((item: StaffDraft) => ({ color: item.color, display_name: item.display_name })));
          setLinkOwner(Boolean(data.staff[0]?.linked_to_owner));
        } else {
          setTeam([{ color: colors[0] || "#792f59", display_name: user.full_name }]);
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Configurazione non disponibile."))
      .finally(() => setBusy(false));
  }, [loading, router, salon, user]);

  const openDays = useMemo(() => Object.values(hours).filter((slots) => slots.length > 0).length, [hours]);

  function addService() {
    const duration = Number(serviceForm.duration_minutes);
    const price = Number(serviceForm.price.replace(",", "."));
    if (
      !serviceForm.name.trim() ||
      !serviceForm.category.trim() ||
      !Number.isFinite(duration) ||
      duration < 5 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError("Compila correttamente tutti i campi del servizio.");
      return;
    }
    setServices((current) => [
      ...current,
      {
        category: serviceForm.category.trim(),
        duration_minutes: duration,
        name: serviceForm.name.trim(),
        price: price.toFixed(2),
      },
    ]);
    setServiceForm({
      category: "",
      duration_minutes: "",
      name: "",
      price: "",
    });
    setError("");
  }

  async function request(path: string, body?: unknown, method = "PATCH") {
    setBusy(true);
    setError("");
    const response = await fetch(`${api}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      method,
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({}));
      setError(payload?.error === "INVALID_SERVICES"
        ? "Controlla nome, categoria, durata e prezzo dei servizi."
        : payload?.error === "INVALID_STAFF"
          ? "Inserisci almeno un componente dello staff."
          : "Salvataggio non riuscito.");
      return false;
    }
    return true;
  }

  async function next() {
    if (step === 1) {
      if (!identity.name.trim()) return setError("Inserisci il nome del salone.");
      if (await request("/api/onboarding/salon", identity)) setStep(2);
    } else if (step === 2) {
      if (openDays === 0) return setError("Imposta almeno un giorno di apertura.");
      if (await request("/api/onboarding/hours", { opening_hours: hours })) setStep(3);
    } else if (step === 3) {
      if (services.length === 0) return setError("Aggiungi almeno un servizio.");
      const payload = services.map((item) => ({
        category: item.category,
        duration_minutes: Number(item.duration_minutes),
        name: item.name,
        price_cents: Math.round(Number(item.price.replace(",", ".")) * 100),
      }));
      if (await request("/api/onboarding/services", { services: payload })) setStep(4);
    } else if (step === 4) {
      if (await request("/api/onboarding/staff", { link_owner: linkOwner, staff: team, working_hours: hours })) setStep(5);
    } else if (await request("/api/onboarding/complete", undefined, "POST")) {
      router.replace("/");
      router.refresh();
    }
  }

  if (loading || busy && !identity.name) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f2f4]"><div className="size-12 animate-pulse rounded-2xl bg-[#792f59]" /></main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff_0,#faf3f7_36%,#f1e8ed_100%)] p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[2rem] bg-[#35212e] p-6 text-white shadow-2xl lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <div className="grid size-12 place-items-center rounded-2xl bg-white text-xl font-black text-[#792f59]">E</div>
          <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#d9a5c2]">Primo accesso</p>
          <h1 className="mt-2 text-3xl font-bold">Prepariamo il salone.</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">Pochi dati essenziali, poi il gestionale è pronto per lavorare.</p>
          <ol className="mt-8 grid grid-cols-5 gap-2 lg:grid-cols-1">
            {labels.map((label, index) => {
              const number = index + 1;
              return <li className={`flex items-center gap-3 rounded-xl p-2 text-sm font-bold ${step === number ? "bg-white text-[#402334]" : number < step ? "text-white" : "text-white/40"}`} key={label}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${number < step ? "bg-[#b85888]" : "bg-white/10"}`}>{number < step ? "✓" : number}</span>
                <span className="hidden lg:inline">{label}</span>
              </li>;
            })}
          </ol>
        </aside>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-xl backdrop-blur md:p-9">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Passaggio {step} di 5</p>
          {step === 1 && <>
            <h2 className="mt-2 text-3xl font-bold text-[#2d1d27]">Partiamo dal salone</h2>
            <p className="mt-2 text-stone-500">Questi dati compariranno nel gestionale e nelle comunicazioni.</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <FormField className="md:col-span-2" label="Nome salone" required><input value={identity.name} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} /></FormField>
              <FormField label="Telefono"><input value={identity.phone} onChange={(event) => setIdentity({ ...identity, phone: event.target.value })} /></FormField>
              <FormField label="Email salone"><input type="email" value={identity.email} onChange={(event) => setIdentity({ ...identity, email: event.target.value })} /></FormField>
              <FormField className="md:col-span-2" label="Indirizzo"><input value={identity.address} onChange={(event) => setIdentity({ ...identity, address: event.target.value })} /></FormField>
            </div>
          </>}

          {step === 2 && <>
            <h2 className="mt-2 text-3xl font-bold text-[#2d1d27]">Quando siete aperti?</h2>
            <p className="mt-2 text-stone-500">Gli orari saranno usati dall’agenda e dalla prenotazione online.</p>
            <div className="mt-8"><ScheduleEditor onChange={setHours} value={hours} /></div>
          </>}

          {step === 3 && <>
            <h2 className="mt-2 text-3xl font-bold text-[#2d1d27]">I servizi principali</h2>
            <p className="mt-2 text-stone-500">Inserisci almeno un servizio. Il catalogo completo potrà essere rifinito dopo.</p>
            <div className="mt-7 rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 md:p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_.65fr_.65fr]">
                <FormField label="Nome servizio" required>
                  <input className="w-full" value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} />
                </FormField>
                <FormField label="Categoria" required>
                  <input className="w-full" value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} />
                </FormField>
                <FormField label="Durata (min)" required>
                  <input className="w-full" min={5} step={5} type="number" value={serviceForm.duration_minutes} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: event.target.value })} />
                </FormField>
                <FormField label="Prezzo (€)" required>
                  <input className="w-full" min={0} step="0.50" type="number" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} />
                </FormField>
              </div>
              <Button className="mt-5" onClick={addService} variant="primary">Aggiungi servizio</Button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="border-b border-stone-100 bg-stone-50 px-4 py-3">
                <h3 className="font-bold text-stone-900">Servizi inseriti</h3>
              </div>
              {services.length === 0 ? (
                <p className="p-5 text-sm text-stone-500">Nessun servizio inserito.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-stone-400">
                      <tr>
                        <th className="px-4 py-3">Servizio</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3">Durata</th>
                        <th className="px-4 py-3">Prezzo</th>
                        <th className="px-4 py-3 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service, index) => (
                        <tr className="border-t border-stone-100" key={`${service.name}-${index}`}>
                          <td className="px-4 py-3 font-bold text-stone-900">{service.name}</td>
                          <td className="px-4 py-3 text-stone-600">{service.category}</td>
                          <td className="px-4 py-3 text-stone-600">{service.duration_minutes} min</td>
                          <td className="px-4 py-3 text-stone-600">€ {Number(service.price).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="sm" variant="ghost">Rimuovi</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>}

          {step === 4 && <>
            <h2 className="mt-2 text-3xl font-bold text-[#2d1d27]">Chi lavora in salone?</h2>
            <p className="mt-2 text-stone-500">Creiamo i profili operativi. Le credenziali della PWA staff si potranno attivare in seguito.</p>
            <label className="mt-7 flex items-center gap-3 rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 font-bold">
              <input checked={linkOwner} onChange={(event) => setLinkOwner(event.target.checked)} type="checkbox" />
              Il primo profilo corrisponde al titolare
            </label>
            <div className="mt-4 space-y-3">
              {team.map((member, index) => <article className="flex gap-3 rounded-2xl border border-stone-100 p-4" key={index}>
                <input aria-label="Colore staff" className="w-16 p-1" type="color" value={member.color} onChange={(event) => setTeam((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item))} />
                <input aria-label="Nome collaboratore" className="flex-1" placeholder="Nome e cognome" value={member.display_name} onChange={(event) => setTeam((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, display_name: event.target.value } : item))} />
                <Button disabled={team.length === 1} onClick={() => setTeam((current) => current.filter((_, itemIndex) => itemIndex !== index))} variant="ghost">Rimuovi</Button>
              </article>)}
            </div>
            <Button className="mt-4" onClick={() => setTeam((current) => [...current, { color: colors[current.length % colors.length] || "#792f59", display_name: "" }])} variant="outline">Aggiungi collaboratore</Button>
          </>}

          {step === 5 && <>
            <h2 className="mt-2 text-3xl font-bold text-[#2d1d27]">Tutto pronto.</h2>
            <p className="mt-2 text-stone-500">Un ultimo controllo, poi entriamo nel gestionale.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl bg-[#faf3f7] p-5"><p className="text-xs font-black uppercase tracking-wider text-[#792f59]">Salone</p><h3 className="mt-2 text-xl font-bold">{identity.name}</h3><p className="mt-1 text-sm text-stone-500">{identity.address || "Indirizzo non inserito"}</p></article>
              <article className="rounded-2xl bg-[#faf3f7] p-5"><p className="text-xs font-black uppercase tracking-wider text-[#792f59]">Apertura</p><h3 className="mt-2 text-xl font-bold">{openDays} giorni a settimana</h3><p className="mt-1 text-sm text-stone-500">Orari modificabili dalle impostazioni</p></article>
              <article className="rounded-2xl bg-[#faf3f7] p-5"><p className="text-xs font-black uppercase tracking-wider text-[#792f59]">Servizi</p><h3 className="mt-2 text-xl font-bold">{services.length} configurati</h3><p className="mt-1 text-sm text-stone-500">{services.slice(0, 3).map((item) => item.name).join(", ")}</p></article>
              <article className="rounded-2xl bg-[#faf3f7] p-5"><p className="text-xs font-black uppercase tracking-wider text-[#792f59]">Staff</p><h3 className="mt-2 text-xl font-bold">{team.length} profili</h3><p className="mt-1 text-sm text-stone-500">{team.slice(0, 3).map((item) => item.display_name).join(", ")}</p></article>
            </div>
          </>}

          {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-6">
            <Button disabled={busy || step === 1} onClick={() => { setError(""); setStep((current) => Math.max(1, current - 1)); }} variant="ghost">Indietro</Button>
            <Button disabled={busy} onClick={() => void next()} variant="primary">{busy ? "Salvataggio..." : step === 5 ? "Entra nel gestionale" : "Continua"}</Button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthProvider><OnboardingWizard /></AuthProvider>;
}
