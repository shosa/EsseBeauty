"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";

import type { WorkingHours } from "@esse-beauty/shared";
import { Button, FormField, ScheduleEditor } from "@esse-beauty/ui";

import { BrandLogo } from "../_components/BrandLogo";
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
const labels = ["Salone", "Orari", "Categorie e servizi", "Staff", "Riepilogo"];

const inputClass =
  "min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-base text-stone-950 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9),0_1px_2px_rgb(28_25_23_/_0.04)] outline-none transition placeholder:text-stone-400 focus:border-[#792f59] focus:ring-4 focus:ring-[#792f59]/15";

interface CategoryDraft {
  icon: string;
  id: string;
  name: string;
}

interface ServiceDraft {
  category: string;
  category_id: string;
  duration_minutes: number;
  name: string;
  price: string;
}

interface ServiceForm {
  duration_minutes: string;
  name: string;
  price: string;
}

interface StaffDraft {
  color: string;
  display_name: string;
}

function localCategoryId() {
  return `local-${crypto.randomUUID()}`;
}

function normalizePrice(value: string) {
  return Number(value.replace(",", "."));
}

function OnboardingWizard() {
  const router = useRouter();
  const { loading, salon, user } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState({ address: "", email: "", name: "", phone: "" });
  const [hours, setHours] = useState<WorkingHours>(defaultHours);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
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

        const apiCategories = (data.service_categories ?? []).map((item: { icon?: string; id: string; name: string }) => ({
          icon: item.icon ?? "sparkles",
          id: item.id,
          name: item.name,
        }));
        const nextServices = (data.services ?? []).map((item: { category: string; category_id?: string | null; duration_minutes: number; name: string; price_cents: number }) => ({
          category: item.category,
          category_id: item.category_id ?? "",
          duration_minutes: item.duration_minutes,
          name: item.name,
          price: (item.price_cents / 100).toFixed(2),
        }));
        const derivedCategories = apiCategories.length
          ? apiCategories
          : Array.from(new Set<string>(nextServices.map((item: ServiceDraft) => item.category).filter(Boolean))).map((name) => ({
              icon: "sparkles",
              id: localCategoryId(),
              name,
            }));
        const normalizedServices = nextServices.map((item: ServiceDraft) => ({
          ...item,
          category_id: item.category_id || derivedCategories.find((category: CategoryDraft) => category.name === item.category)?.id || "",
        }));
        setCategories(derivedCategories);
        setActiveCategoryId(derivedCategories[0]?.id ?? "");
        setServices(normalizedServices);

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
  const activeCategory = categories.find((category) => category.id === activeCategoryId);
  const activeServices = services.filter((service) => service.category_id === activeCategoryId);
  const serviceCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach((service) => counts.set(service.category_id, (counts.get(service.category_id) ?? 0) + 1));
    return counts;
  }, [services]);

  function addCategory() {
    const name = categoryName.trim();
    if (!name) {
      setError("Inserisci il nome della categoria.");
      return;
    }
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      setError("Questa categoria esiste già.");
      return;
    }
    const category = { icon: "sparkles", id: localCategoryId(), name };
    setCategories((current) => [...current, category]);
    setActiveCategoryId(category.id);
    setCategoryName("");
    setError("");
  }

  function removeCategory(categoryId: string) {
    const remaining = categories.filter((category) => category.id !== categoryId);
    setCategories(remaining);
    setServices((current) => current.filter((service) => service.category_id !== categoryId));
    if (activeCategoryId === categoryId) setActiveCategoryId(remaining[0]?.id ?? "");
  }

  function addService() {
    const duration = Number(serviceForm.duration_minutes);
    const price = normalizePrice(serviceForm.price);
    if (!activeCategory) {
      setError("Crea prima una categoria.");
      return;
    }
    if (!serviceForm.name.trim() || !Number.isFinite(duration) || duration < 5 || !Number.isFinite(price) || price < 0) {
      setError("Compila correttamente nome, durata e prezzo del servizio.");
      return;
    }
    setServices((current) => [
      ...current,
      {
        category: activeCategory.name,
        category_id: activeCategory.id,
        duration_minutes: duration,
        name: serviceForm.name.trim(),
        price: price.toFixed(2),
      },
    ]);
    setServiceForm({ duration_minutes: "", name: "", price: "" });
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
        ? "Controlla categorie, nome, durata e prezzo dei servizi."
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
      if (categories.length === 0) return setError("Crea almeno una categoria.");
      if (services.length === 0) return setError("Aggiungi almeno un servizio.");
      const payload = services.map((item) => ({
        category: categories.find((category) => category.id === item.category_id)?.name ?? item.category,
        category_id: item.category_id,
        duration_minutes: Number(item.duration_minutes),
        name: item.name,
        price_cents: Math.round(normalizePrice(item.price) * 100),
      }));
      if (await request("/api/onboarding/services", { categories, services: payload })) setStep(4);
    } else if (step === 4) {
      if (await request("/api/onboarding/staff", { link_owner: linkOwner, staff: team, working_hours: hours })) setStep(5);
    } else if (await request("/api/onboarding/complete", undefined, "POST")) {
      router.replace("/");
      router.refresh();
    }
  }

  if (loading || busy && !identity.name) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f5f7]"><div className="size-10 animate-pulse rounded-full bg-stone-300" /></main>;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-5 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_26px_80px_rgb(28_25_23_/_0.12)] backdrop-blur-xl lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-stone-200/70 bg-white/65 p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[14px] bg-stone-950">
              <BrandLogo className="size-8" tone="white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-stone-500">Primo accesso</p>
              <h1 className="text-xl font-semibold tracking-[-.02em] text-stone-950">Esse Beauty</h1>
            </div>
          </div>
          <p className="mt-7 max-w-[24rem] text-sm leading-6 text-stone-500">Configura le basi operative del salone. Ogni passaggio salva dati che potrai rifinire dopo.</p>
          <ol className="mt-7 grid grid-cols-5 gap-2 lg:grid-cols-1">
            {labels.map((label, index) => {
              const number = index + 1;
              const active = step === number;
              const done = number < step;
              return (
                <li className={`flex min-w-0 items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-semibold transition ${active ? "bg-stone-950 text-white shadow-sm" : done ? "bg-white text-stone-900 ring-1 ring-stone-200" : "text-stone-400"}`} key={label}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${active ? "bg-white text-stone-950" : done ? "bg-[#792f59] text-white" : "bg-stone-200 text-stone-500"}`}>{done ? <Check className="size-4" /> : number}</span>
                  <span className="hidden truncate lg:inline">{label}</span>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="flex min-h-0 flex-col p-5 sm:p-8 lg:p-10">
          <div className="min-h-0 flex-1">
            <p className="text-[13px] font-semibold text-[#792f59]">Passaggio {step} di 5</p>
            {step === 1 && <>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em] text-stone-950">Partiamo dal salone</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">Questi dati compariranno nel gestionale e nelle comunicazioni.</p>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <FormField className="md:col-span-2" label="Nome salone" required><input className={inputClass} value={identity.name} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} /></FormField>
                <FormField label="Telefono"><input className={inputClass} value={identity.phone} onChange={(event) => setIdentity({ ...identity, phone: event.target.value })} /></FormField>
                <FormField label="Email salone"><input className={inputClass} type="email" value={identity.email} onChange={(event) => setIdentity({ ...identity, email: event.target.value })} /></FormField>
                <FormField className="md:col-span-2" label="Indirizzo"><input className={inputClass} value={identity.address} onChange={(event) => setIdentity({ ...identity, address: event.target.value })} /></FormField>
              </div>
            </>}

            {step === 2 && <>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em] text-stone-950">Quando siete aperti?</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">Gli orari saranno usati dall'agenda e dalla prenotazione online.</p>
              <div className="mt-8 rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm"><ScheduleEditor onChange={setHours} value={hours} /></div>
            </>}

            {step === 3 && <>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em] text-stone-950">Categorie e servizi</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">Prima definisci le categorie del catalogo, poi inserisci i servizi dentro la categoria selezionata.</p>

              <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-end gap-2">
                    <FormField className="min-w-0 flex-1" label="Nuova categoria">
                      <input className={inputClass} placeholder="Es. Estetica viso" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
                    </FormField>
                    <Button aria-label="Aggiungi categoria" className="mb-0.5 size-12 rounded-2xl p-0" onClick={addCategory} variant="primary"><Plus className="size-5" /></Button>
                  </div>

                  <div className="mt-5 space-y-2">
                    {categories.length === 0 ? (
                      <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">Nessuna categoria creata.</p>
                    ) : categories.map((category) => {
                      const active = category.id === activeCategoryId;
                      return (
                        <div className={`flex items-center gap-2 rounded-2xl border p-2 transition ${active ? "border-[#792f59] bg-[#f2f8ff]" : "border-stone-200 bg-white"}`} key={category.id}>
                          <button className="min-w-0 flex-1 px-2 py-2 text-left" onClick={() => setActiveCategoryId(category.id)} type="button">
                            <span className="block truncate text-sm font-semibold text-stone-950">{category.name}</span>
                            <span className="mt-0.5 block text-xs text-stone-500">{serviceCountByCategory.get(category.id) ?? 0} servizi</span>
                          </button>
                          <button aria-label={`Rimuovi categoria ${category.name}`} className="grid size-9 shrink-0 place-items-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-700" onClick={() => removeCategory(category.id)} type="button">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-400">Categoria attiva</p>
                      <h3 className="mt-1 text-xl font-semibold text-stone-950">{activeCategory?.name ?? "Da creare"}</h3>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-600">{activeServices.length} servizi</span>
                  </div>

                  <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
                    <FormField label="Nome servizio" required>
                      <input className={inputClass} disabled={!activeCategory} placeholder="Es. Pulizia viso" value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} />
                    </FormField>
                    <FormField label="Durata" required>
                      <input className={inputClass} disabled={!activeCategory} min={5} step={5} type="number" value={serviceForm.duration_minutes} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: event.target.value })} />
                    </FormField>
                    <FormField label="Prezzo" required>
                      <input className={inputClass} disabled={!activeCategory} min={0} step="0.50" type="number" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} />
                    </FormField>
                    <div className="flex items-end">
                      <Button className="min-h-12 w-full rounded-2xl lg:w-auto" disabled={!activeCategory} onClick={addService} variant="primary"><Plus className="size-4" />Aggiungi</Button>
                    </div>
                  </div>

                  <div className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-[20px] border border-stone-200">
                    {activeServices.length === 0 ? (
                      <p className="p-5 text-sm text-stone-500">Nessun servizio in questa categoria.</p>
                    ) : activeServices.map((service, index) => {
                      const serviceIndex = services.indexOf(service);
                      return (
                        <article className="grid gap-2 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto] sm:items-center" key={`${service.name}-${index}`}>
                          <div className="min-w-0">
                            <h4 className="truncate font-semibold text-stone-950">{service.name}</h4>
                            <p className="text-sm text-stone-500">{service.category}</p>
                          </div>
                          <p className="text-sm font-medium text-stone-600">{service.duration_minutes} min</p>
                          <p className="text-sm font-medium text-stone-600">€ {Number(service.price).toFixed(2)}</p>
                          <Button aria-label={`Rimuovi ${service.name}`} className="justify-self-start sm:justify-self-end" onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== serviceIndex))} size="sm" variant="ghost"><Trash2 className="size-4" />Rimuovi</Button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>}

            {step === 4 && <>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em] text-stone-950">Chi lavora in salone?</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">Creiamo i profili operativi. Le credenziali dell'App Staff si potranno attivare in seguito.</p>
              <label className="mt-7 flex items-center justify-between gap-3 rounded-[20px] border border-stone-200 bg-white p-4 text-sm font-semibold shadow-sm">
                <span>Il primo profilo corrisponde al titolare</span>
                <input checked={linkOwner} className="size-5 accent-[#792f59]" onChange={(event) => setLinkOwner(event.target.checked)} type="checkbox" />
              </label>
              <div className="mt-4 space-y-3">
                {team.map((member, index) => <article className="grid gap-3 rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-[72px_minmax(0,1fr)_auto]" key={index}>
                  <input aria-label="Colore staff" className="h-12 w-full rounded-2xl border border-stone-200 bg-white p-1" type="color" value={member.color} onChange={(event) => setTeam((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item))} />
                  <input aria-label="Nome collaboratore" className={inputClass} placeholder="Nome e cognome" value={member.display_name} onChange={(event) => setTeam((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, display_name: event.target.value } : item))} />
                  <Button disabled={team.length === 1} onClick={() => setTeam((current) => current.filter((_, itemIndex) => itemIndex !== index))} variant="ghost"><Trash2 className="size-4" />Rimuovi</Button>
                </article>)}
              </div>
              <Button className="mt-4 rounded-2xl" onClick={() => setTeam((current) => [...current, { color: colors[current.length % colors.length] || "#792f59", display_name: "" }])} variant="outline"><Plus className="size-4" />Aggiungi collaboratore</Button>
            </>}

            {step === 5 && <>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em] text-stone-950">Tutto pronto.</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">Un ultimo controllo, poi entriamo nel gestionale.</p>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <article className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-400">Salone</p><h3 className="mt-2 text-xl font-semibold">{identity.name}</h3><p className="mt-1 text-sm text-stone-500">{identity.address || "Indirizzo non inserito"}</p></article>
                <article className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-400">Apertura</p><h3 className="mt-2 text-xl font-semibold">{openDays} giorni a settimana</h3><p className="mt-1 text-sm text-stone-500">Orari modificabili dalle impostazioni</p></article>
                <article className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-400">Catalogo</p><h3 className="mt-2 text-xl font-semibold">{categories.length} categorie, {services.length} servizi</h3><p className="mt-1 text-sm text-stone-500">{categories.slice(0, 3).map((item) => item.name).join(", ")}</p></article>
                <article className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.1em] text-stone-400">Staff</p><h3 className="mt-2 text-xl font-semibold">{team.length} profili</h3><p className="mt-1 text-sm text-stone-500">{team.slice(0, 3).map((item) => item.display_name).join(", ")}</p></article>
              </div>
            </>}

            {error && <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-5">
            <Button disabled={busy || step === 1} onClick={() => { setError(""); setStep((current) => Math.max(1, current - 1)); }} variant="ghost">Indietro</Button>
            <Button className="rounded-2xl" disabled={busy} onClick={() => void next()} variant="primary">{busy ? "Salvataggio..." : step === 5 ? "Entra nel gestionale" : "Continua"}</Button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthProvider><OnboardingWizard /></AuthProvider>;
}
