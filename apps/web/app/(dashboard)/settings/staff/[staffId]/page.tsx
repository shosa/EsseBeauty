"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, FormField, InlineError, PageHeader, SaveToast, ScheduleEditor, SectionCard } from "@esse-beauty/ui";
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

interface Block {
  id: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}

interface StaffAccess {
  active: boolean;
  email: string;
  user_id?: string | null;
}

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useAuth();
  const [member, setMember] = useState<Member>();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [access, setAccess] = useState<StaffAccess>({ active: true, email: "", user_id: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!salon) return;
    const [staffRows, absences, accessResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, { credentials: "include" }),
    ]);
    setMember(staffRows.find((item: Member) => item.id === staffId));
    setBlocks(absences);
    if (accessResponse.ok) setAccess(await accessResponse.json() as StaffAccess);
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

  async function addBlock(data: FormData) {
    if (!salon) return;
    await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        starts_at: data.get("starts"),
        ends_at: data.get("ends"),
        reason: data.get("reason"),
        recurring: false,
      }),
    });
    await load();
  }

  async function removeBlock(blockId: string) {
    if (!salon) return;
    await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks/${blockId}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  if (!member) return <AppPage><SectionCard><div className="h-96 animate-pulse rounded-[2rem] bg-stone-100" /></SectionCard></AppPage>;

  return (
    <AppPage maxWidth="max-w-5xl">
      <SaveToast visible={Boolean(message || error)} variant={error ? "error" : "success"}>{error || message}</SaveToast>
      <PageHeader eyebrow="Profilo staff" title={member.displayName} subtitle="Anagrafica, accesso PWA dipendente, orari e blocchi disponibilita." />

      <div className="grid gap-5">
        <SectionCard title="Profilo">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nome">
              <input value={member.displayName} onChange={(event) => setMember({ ...member, displayName: event.target.value })} />
            </FormField>
            <FormField label="Colore">
              <input type="color" value={member.color} onChange={(event) => setMember({ ...member, color: event.target.value })} />
            </FormField>
            <FormField label="Bio" className="md:col-span-2">
              <textarea value={member.bio ?? ""} onChange={(event) => setMember({ ...member, bio: event.target.value })} />
            </FormField>
          </div>
          <Button onClick={() => void save()} className="mt-4" variant="primary">Salva profilo e orari</Button>
        </SectionCard>

        <SectionCard title="Accesso PWA dipendente" subtitle="Credenziali usate dal collaboratore per accedere alla PWA staff separata.">
          <form action={saveAccess} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <FormField label="Email dipendente" required>
              <input name="email" type="email" required value={access.email} onChange={(event) => setAccess({ ...access, email: event.target.value })} />
            </FormField>
            <FormField label={access.user_id ? "Nuova password" : "Password iniziale"} description="Minimo 10 caratteri. Lascia vuoto per non cambiarla se l'accesso esiste.">
              <input name="password" type="password" minLength={10} />
            </FormField>
            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#ead1df] bg-[#fffafd] px-4 text-sm font-bold">
              <input name="active" type="checkbox" checked={access.active} onChange={(event) => setAccess({ ...access, active: event.target.checked })} />
              Attivo
            </label>
            <div className="md:col-span-3">
              <Button type="submit" variant="primary">Salva accesso PWA</Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Orari settimanali" subtitle="Puoi aggiungere più fasce nello stesso giorno, ad esempio 09:00–13:00 e 15:00–19:00.">
          <ScheduleEditor
            onChange={(workingHours) => setMember({ ...member, workingHours })}
            value={member.workingHours}
          />
        </SectionCard>

        <SectionCard title="Blocchi disponibilita" subtitle="I blocchi compaiono anche sull'agenda come promemoria operativo.">
          {error && <InlineError className="mb-3">{error}</InlineError>}
          <form action={addBlock} className="grid gap-2 rounded-2xl bg-white p-4 md:grid-cols-4">
            <FormField label="Inizio"><input name="starts" type="datetime-local" required /></FormField>
            <FormField label="Fine"><input name="ends" type="datetime-local" required /></FormField>
            <FormField label="Motivo"><input name="reason" /></FormField>
            <div className="flex items-end"><Button type="submit" variant="primary">Aggiungi blocco</Button></div>
          </form>
          <div className="mt-3 space-y-2">
            {blocks.map((block) => (
              <article key={block.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-stone-100">
                <span>{new Date(block.startsAt).toLocaleString("it-IT")} - {new Date(block.endsAt).toLocaleString("it-IT")} - {block.reason || "Non disponibile"}</span>
                <Button size="sm" variant="destructive" onClick={() => void removeBlock(block.id)}>Elimina</Button>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
