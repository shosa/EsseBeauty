"use client";

import { useEffect, useState } from "react";

import { AppPage, Button, EmptyState, FormField, InlineError, PageHeader, SaveToast, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

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

function dateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export default function StaffRequestsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<AvailabilityRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff-availability-requests`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare le richieste staff.");
      return;
    }
    setItems(await response.json() as AvailabilityRequest[]);
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

  const pending = items.filter((item) => item.status === "pending");
  const reviewed = items.filter((item) => item.status !== "pending");

  return (
    <AppPage maxWidth="max-w-5xl">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Staff" title="Richieste disponibilità" subtitle="Approva ferie, permessi e indisponibilità. Le richieste approvate diventano blocchi visibili in agenda." />
      {error && <InlineError className="mb-4">{error}</InlineError>}

      <SectionCard title={`Da revisionare (${pending.length})`} subtitle="Le richieste più urgenti restano qui finché non vengono approvate o rifiutate.">
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

      <SectionCard className="mt-5" title="Storico revisioni">
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
    </AppPage>
  );
}
