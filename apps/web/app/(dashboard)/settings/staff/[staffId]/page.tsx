"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, FormField, PageHeader, SaveToast, ScheduleEditor, SectionCard } from "@esse-beauty/ui";
import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Member {
  id: string;
  displayName: string;
  bio?: string;
  color: string;
  specializations: string[];
  workingHours: WorkingHours;
}

interface StaffAccess {
  active: boolean;
  email: string;
  role?: "owner" | "manager" | "receptionist" | "employee" | null;
  user_id?: string | null;
}

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useAuth();
  const [member, setMember] = useState<Member>();
  const [salonHours, setSalonHours] = useState<WorkingHours>();
  const [access, setAccess] = useState<StaffAccess>({ active: true, email: "", role: null, user_id: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!salon) return;
    const [staffRows, accessResponse, settingsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff-default-hours`, { credentials: "include" }),
    ]);
    setMember(staffRows.find((item: Member) => item.id === staffId));
    if (accessResponse.ok) setAccess(await accessResponse.json() as StaffAccess);
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json() as { opening_hours?: WorkingHours };
      setSalonHours(settings.opening_hours);
    }
  };

  useEffect(() => {
    void load();
  }, [salon?.id, staffId]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

  async function save() {
    if (!member || !salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: member.displayName,
        bio: member.bio,
        color: member.color,
        specializations: member.specializations,
        working_hours: member.workingHours,
      }),
    });
    setMessage(response.ok ? "Profilo staff salvato." : "");
    setError(response.ok ? "" : "Profilo non salvato.");
  }

  async function saveAccess(data: FormData) {
    if (!salon) return;
    const password = String(data.get("password") ?? "");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        active: data.get("active") === "on",
        email: data.get("email"),
        ...(password ? { password } : {}),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "ACCESS_NOT_SAVED" }));
      setError(payload.error === "PASSWORD_REQUIRED" ? "Inserisci una password per creare il primo accesso." : "Accesso PWA non salvato.");
      return;
    }
    setAccess(await response.json() as StaffAccess);
    setMessage("Accesso PWA dipendente salvato.");
  }

  if (!member) return <AppPage><SectionCard><div className="h-96 animate-pulse rounded-[2rem] bg-stone-100" /></SectionCard></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <SaveToast visible={Boolean(message || error)} variant={error ? "error" : "success"}>{error || message}</SaveToast>
      <PageHeader eyebrow="Profilo staff" title={member.displayName} subtitle="Anagrafica, accesso PWA dipendente e orari ricorrenti." />

      <div className="grid gap-5 xl:grid-cols-12">
        <SectionCard className="xl:col-span-5" title="Profilo" subtitle="Dati visibili nel gestionale e nelle aree collegate al collaboratore.">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_170px]">
            <FormField label="Nome collaboratore" required>
              <input className="w-full" value={member.displayName} onChange={(event) => setMember({ ...member, displayName: event.target.value })} />
            </FormField>
            <FormField label="Colore">
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-[#fffafd] px-3">
                <label className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(214_211_209)]" style={{ backgroundColor: member.color }}>
                  <span className="sr-only">Scegli colore collaboratore</span>
                  <input aria-label="Colore collaboratore" className="absolute inset-0 size-full cursor-pointer opacity-0" type="color" value={member.color} onChange={(event) => setMember({ ...member, color: event.target.value })} />
                </label>
                <span className="text-sm font-bold uppercase text-stone-500">{member.color}</span>
              </div>
            </FormField>
            <FormField label="Biografia" description="Nota interna o breve presentazione del collaboratore." className="sm:col-span-2">
              <textarea className="min-h-28 w-full resize-y" value={member.bio ?? ""} onChange={(event) => setMember({ ...member, bio: event.target.value })} />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
            <Button onClick={() => void save()} variant="primary">Salva profilo</Button>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-7" title="Accesso PWA dipendente" subtitle="Credenziali usate dal collaboratore per accedere alla PWA staff separata.">
          <form action={saveAccess}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Email dipendente" required>
                <input className="w-full" name="email" type="email" required value={access.email} onChange={(event) => setAccess({ ...access, email: event.target.value })} />
              </FormField>
              <FormField label={access.user_id ? "Reimposta password" : "Password iniziale"} description={access.user_id ? "Lascia vuoto per mantenere la password attuale. Minimo 10 caratteri." : "Minimo 10 caratteri."}>
                <input className="w-full" name="password" type="password" minLength={10} />
              </FormField>
              <div className="md:col-span-2">
                <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-[#fbfaf8] px-4">
                  <span>
                    <strong className="block text-sm text-stone-900">Accesso PWA attivo</strong>
                    <span className="mt-1 block text-xs text-stone-500">Consente al collaboratore di accedere alla propria agenda.</span>
                  </span>
                  <input disabled={access.role === "owner"} name="active" type="checkbox" checked={access.active} onChange={(event) => setAccess({ ...access, active: event.target.checked })} />
                </label>
              </div>
            </div>
            {access.role === "owner" && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Questo profilo è collegato al titolare. L’accesso PWA usa lo stesso account senza modificarne ruolo o stato.
              </p>
            )}
            <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
              <Button type="submit" variant="primary">Salva accesso PWA</Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard className="xl:col-span-12" title="Orari settimanali" subtitle="Puoi aggiungere più fasce nello stesso giorno, ad esempio 09:00–13:00 e 15:00–19:00.">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4">
            <div>
              <strong className="block text-sm text-stone-900">Orario base del salone</strong>
              <span className="mt-1 block text-xs text-stone-500">Sostituisce le fasce sottostanti con gli orari di apertura attuali.</span>
            </div>
            <Button disabled={!salonHours} onClick={() => salonHours && setMember({ ...member, workingHours: structuredClone(salonHours) })} size="sm" variant="outline">Carica orari salone</Button>
          </div>
          <ScheduleEditor
            onChange={(workingHours) => setMember({ ...member, workingHours })}
            value={member.workingHours}
          />
          <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
            <Button onClick={() => void save()} variant="primary">Salva orari</Button>
          </div>
        </SectionCard>

      </div>
    </AppPage>
  );
}
