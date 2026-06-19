"use client";

import { useEffect, useState } from "react";

import { AppPage, Button, EmptyState, FormField, InlineError, PageHeader, SaveToast, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface AvailabilityRequest {
  ends_at: string;
  id: string;
  reason?: string | null;
  review_note?: string | null;
  staff_name: string;
  starts_at: string;
  status: string;
}

interface AvailabilityBlock {
  ends_at: string;
  id: string;
  reason?: string | null;
  staff_id: string;
  staff_name: string;
  starts_at: string;
}

interface StaffOption {
  displayName: string;
  id: string;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export default function PermissionsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<AvailabilityRequest[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!salon) return;
    const [requestsResponse, blocksResponse, staffResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff-availability-requests`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff-availability-blocks`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }),
    ]);
    if (!requestsResponse.ok || !blocksResponse.ok || !staffResponse.ok) {
      setError("Impossibile caricare le richieste staff.");
      return;
    }
    setItems(await requestsResponse.json() as AvailabilityRequest[]);
    setBlocks(await blocksResponse.json() as AvailabilityBlock[]);
    setStaff(await staffResponse.json() as StaffOption[]);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function review(requestId: string, status: "approved" | "rejected") {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff-availability-requests/${requestId}`, {
      body: JSON.stringify({ review_note: notes[requestId] || undefined, status }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setError("La richiesta non è stata aggiornata.");
      return;
    }
    setMessage(status === "approved" ? "Richiesta approvata e blocco inserito in agenda." : "Richiesta rifiutata.");
    await load();
    window.dispatchEvent(new Event("esse:staff-requests-updated"));
  }

  async function addBlock(data: FormData) {
    if (!salon) return;
    const staffId = String(data.get("staff_id") ?? "");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, {
      body: JSON.stringify({ ends_at: data.get("ends"), reason: data.get("reason"), starts_at: data.get("starts") }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return setError("Permesso non inserito.");
    setMessage("Permesso inserito in agenda.");
    await load();
  }

  async function removeBlock(item: AvailabilityBlock) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${item.staff_id}/availability-blocks/${item.id}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) return setError("Permesso non eliminato.");
    setMessage("Permesso eliminato.");
    await load();
  }

  const pending = items.filter((item) => item.status === "pending");
  const reviewed = items.filter((item) => item.status !== "pending");
  const activeBlocks = blocks.filter((item) => new Date(item.ends_at).getTime() >= Date.now());

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Organizzazione" title="Permessi e assenze" subtitle="Gestisci richieste, ferie, permessi e indisponibilità di tutto il team in un unico spazio." status={<StatusBadge status="pending">{pending.length} da revisionare</StatusBadge>} />
      {error && <InlineError className="mb-4">{error}</InlineError>}

      <div className="grid gap-5 xl:grid-cols-12">
      <SectionCard className="xl:col-span-7" title={`Da revisionare (${pending.length})`} subtitle="Le richieste inviate dalla PWA restano qui finché non vengono approvate o rifiutate.">
        {pending.length === 0 ? <EmptyState title="Nessuna richiesta in attesa" description="Le nuove richieste inviate dalla PWA staff appariranno qui." /> : (
          <div className="space-y-4">
            {pending.map((item) => (
              <article className="rounded-2xl border border-[#ead1df] bg-[#fffafd] p-5" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.15em] text-[#792f59]">{item.staff_name}</p>
                    <h2 className="mt-1 text-xl font-black">{dateTime(item.starts_at)} - {dateTime(item.ends_at)}</h2>
                    <p className="mt-2 text-sm text-stone-600">{item.reason || "Nessun motivo indicato."}</p>
                  </div>
                  <StatusBadge status="pending">In attesa</StatusBadge>
                </div>
                <FormField className="mt-4" label="Nota per il collaboratore">
                  <textarea onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Opzionale" value={notes[item.id] ?? ""} />
                </FormField>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void review(item.id, "approved")} variant="primary">Approva</Button>
                  <Button onClick={() => void review(item.id, "rejected")} variant="destructive">Rifiuta</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard className="self-start xl:col-span-5" title="Inserimento manuale" subtitle="Registra direttamente ferie, permessi o altre indisponibilità.">
        <form action={addBlock} className="grid gap-4">
          <FormField label="Collaboratore" required><select className="w-full" name="staff_id" required><option value="">Seleziona</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Inizio" required><input className="w-full" name="starts" required type="datetime-local" /></FormField>
            <FormField label="Fine" required><input className="w-full" name="ends" required type="datetime-local" /></FormField>
          </div>
          <FormField label="Motivo"><input className="w-full" name="reason" /></FormField>
          <div className="flex justify-end"><Button type="submit" variant="primary">Inserisci permesso</Button></div>
        </form>
      </SectionCard>

      <SectionCard className="xl:col-span-7" title={`Permessi attivi (${activeBlocks.length})`} subtitle="Blocchi correnti e futuri già presenti in agenda per tutto il team.">
        {activeBlocks.length === 0 ? <EmptyState title="Nessun permesso attivo" description="Le assenze approvate o inserite manualmente compariranno qui." /> : <div className="grid gap-3 md:grid-cols-2">
          {activeBlocks.map((item) => <article className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4" key={item.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{item.staff_name}</p><strong className="mt-1 block">{item.reason || "Non disponibile"}</strong></div><Button onClick={() => void removeBlock(item)} size="sm" variant="destructive">Elimina</Button></div>
            <p className="mt-3 text-sm leading-6 text-stone-500">{dateTime(item.starts_at)}<br />fino a {dateTime(item.ends_at)}</p>
          </article>)}
        </div>}
      </SectionCard>

      <SectionCard className="xl:col-span-5" title="Storico revisioni">
        {reviewed.length === 0 ? <p className="text-sm text-stone-500">Nessuna richiesta revisionata.</p> : (
          <div className="space-y-2">
            {reviewed.map((item) => (
              <article className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-stone-100 bg-white p-4" key={item.id}>
                <div><b>{item.staff_name}</b><p className="text-sm text-stone-500">{dateTime(item.starts_at)} - {dateTime(item.ends_at)}</p>{item.review_note && <p className="mt-1 text-sm">{item.review_note}</p>}</div>
                <StatusBadge status={item.status}>{item.status === "approved" ? "Approvata" : "Rifiutata"}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
      </div>
    </AppPage>
  );
}
