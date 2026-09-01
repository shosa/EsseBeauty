"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { AppPage, Button, ConfirmDialog, DateTimeField, EmptyState, FormField, InlineError, PageHeader, SaveActionButton, SaveToast, SectionCard, StatusBadge } from "@esse-beauty/ui";

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

async function responseError(response: Response) {
  return await response.json().catch(() => ({})) as { error?: string };
}

export default function PermissionsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<AvailabilityRequest[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<AvailabilityBlock>();

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
    setReviewingId(requestId);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff-availability-requests/${requestId}`, {
      body: JSON.stringify({ review_note: notes[requestId] || undefined, status }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      const body = await responseError(response);
      setError(body.error === "NO_WORKING_HOURS_IN_RANGE"
        ? "La richiesta non incrocia orari lavorativi configurati."
        : "La richiesta non è stata aggiornata.");
      setReviewingId("");
      return;
    }
    setMessage(status === "approved" ? "Richiesta approvata e blocco inserito in agenda." : "Richiesta rifiutata.");
    await load();
    setReviewingId("");
    window.dispatchEvent(new Event("esse:staff-requests-updated"));
  }

  async function addBlock(data: FormData) {
    if (!salon) return;
    setAddingBlock(true);
    setError("");
    const staffId = String(data.get("staff_id") ?? "");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/availability-blocks`, {
      body: JSON.stringify({ ends_at: data.get("ends"), reason: data.get("reason"), starts_at: data.get("starts") }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const body = await responseError(response);
      setError(body.error === "NO_WORKING_HOURS_IN_RANGE"
        ? "Il permesso non incrocia orari lavorativi configurati."
        : "Permesso non inserito.");
      setAddingBlock(false);
      return;
    }
    setMessage("Permesso inserito in agenda sugli orari lavorativi.");
    setStartsAt("");
    setEndsAt("");
    await load();
    setAddingBlock(false);
  }

  async function removeBlock(item: AvailabilityBlock) {
    if (!salon) return;
    setError("");
    setRemovingId(item.id);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${item.staff_id}/availability-blocks/${item.id}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) {
      setConfirmRemove(undefined);
      setError("Permesso non eliminato.");
      setRemovingId("");
      return;
    }
    setMessage("Permesso eliminato.");
    setConfirmRemove(undefined);
    await load();
    setRemovingId("");
  }

  const pending = items.filter((item) => item.status === "pending");
  const reviewed = items.filter((item) => item.status !== "pending");
  const activeBlocks = blocks.filter((item) => new Date(item.ends_at).getTime() >= Date.now());

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Staff" title="Permessi e assenze" subtitle="Approva o rifiuta le richieste dall'App Staff, inserisci manualmente ferie e permessi e rimuovi i blocchi attivi." />
      {error && <InlineError className="mb-4">{error}</InlineError>}

      <div className="grid gap-5 xl:grid-cols-12">
      <SectionCard className="xl:col-span-7" title={`Da revisionare (${pending.length})`} subtitle="Le richieste inviate dall’App Staff restano qui finché non vengono approvate o rifiutate.">
        {pending.length === 0 ? <EmptyState title="Nessuna richiesta in attesa" description="Le nuove richieste inviate dall’App Staff appariranno qui." /> : (
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
                  <Button disabled={reviewingId === item.id} onClick={() => void review(item.id, "approved")} variant="primary">{reviewingId === item.id ? "Attendere…" : "Approva"}</Button>
                  <Button disabled={reviewingId === item.id} onClick={() => void review(item.id, "rejected")} variant="destructive">Rifiuta</Button>
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
            <FormField label="Inizio" required><DateTimeField aria-label="Inizio permesso" name="starts" onChange={setStartsAt} required value={startsAt} /></FormField>
            <FormField label="Fine" required><DateTimeField aria-label="Fine permesso" min={startsAt || undefined} name="ends" onChange={setEndsAt} required value={endsAt} /></FormField>
          </div>
          <FormField label="Motivo"><input className="w-full" name="reason" /></FormField>
          <div className="flex justify-end"><SaveActionButton busy={addingBlock} disabled={!startsAt || !endsAt || endsAt <= startsAt} idleLabel="Inserisci permesso" saved={false} type="submit" /></div>
        </form>
      </SectionCard>

      <SectionCard className="xl:col-span-7" title={`Permessi attivi (${activeBlocks.length})`} subtitle="Blocchi correnti e futuri già presenti in agenda per tutto il team.">
        {activeBlocks.length === 0 ? <EmptyState title="Nessun permesso attivo" description="Le assenze approvate o inserite manualmente compariranno qui." /> : <div className="grid gap-3 md:grid-cols-2">
          {activeBlocks.map((item) => <article className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4" key={item.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{item.staff_name}</p><strong className="mt-1 block">{item.reason || "Non disponibile"}</strong></div><Button aria-label={`Elimina permesso di ${item.staff_name}`} className="size-10 p-0" disabled={removingId === item.id} onClick={() => setConfirmRemove(item)} size="sm" title="Elimina permesso" variant="destructive"><Trash2 className="size-4" /></Button></div>
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
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il collaboratore tornerà disponibile su questa fascia oraria in agenda."
        onCancel={() => setConfirmRemove(undefined)}
        onConfirm={() => confirmRemove && void removeBlock(confirmRemove)}
        open={Boolean(confirmRemove)}
        title={`Eliminare il permesso di ${confirmRemove?.staff_name ?? "collaboratore"}?`}
      />
    </AppPage>
  );
}
