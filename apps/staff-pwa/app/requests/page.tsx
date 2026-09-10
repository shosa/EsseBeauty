"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { EmptyState, InlineError, SaveToast, StatusBadge } from "@esse-beauty/ui";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { staffRequest } from "../../lib/staff-auth";
import { dateTime } from "../../lib/format";
import type { AvailabilityRequest } from "../../lib/types";
import { RequestModal } from "../_components/RequestModal";
import { Surface } from "../_components/Surface";
import { useStaffAuth } from "../_components/StaffAuthProvider";

export default function StaffRequestsPage() {
  const { session } = useStaffAuth();
  const [availability, setAvailability] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestStartsAt, setRequestStartsAt] = useState("");
  const [requestEndsAt, setRequestEndsAt] = useState("");

  const permissionSet = new Set(session?.permissions ?? []);
  const canManageAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);

  async function load() {
    setLoading(true);
    try {
      setAvailability(await staffRequest<AvailabilityRequest[]>("/api/staff-app/availability-requests"));
    } catch {
      setError("Richieste non disponibili.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function withdrawAvailabilityRequest(requestId: string) {
    try {
      await staffRequest(`/api/staff-app/availability-requests/${requestId}`, { method: "DELETE" });
      setAvailability((current) => current.filter((item) => item.id !== requestId));
      setMessage("Richiesta ritirata.");
    } catch {
      setError("Puoi ritirare solo richieste ancora in attesa.");
    }
  }

  async function requestAvailability(formData: FormData) {
    if (!requestStartsAt || !requestEndsAt) {
      setError("Indica le date della richiesta.");
      return;
    }
    try {
      await staffRequest("/api/staff-app/availability-requests", {
        body: JSON.stringify({ ends_at: formData.get("ends_at"), reason: formData.get("reason"), starts_at: formData.get("starts_at") }),
        method: "POST",
      });
      setMessage("Richiesta inviata.");
      setRequestStartsAt("");
      setRequestEndsAt("");
      setRequestModalOpen(false);
      await load();
    } catch {
      setError("Richiesta non inviata.");
    }
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 lg:max-w-2xl lg:p-8">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <div className="flex items-center justify-between gap-3">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">Disponibilità</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight tracking-[-.025em] text-stone-950">Richieste</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">Ferie, permessi e indisponibilità</p>
        </header>
        <button aria-label="Nuova richiesta" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#792f59] text-white" onClick={() => setRequestModalOpen(true)} type="button"><Plus className="size-5" /></button>
      </div>
      {error && <InlineError>{error}</InlineError>}
      {loading ? <div className="h-40 animate-pulse rounded-3xl bg-stone-100" /> : availability.length === 0 ? (
        <Surface><EmptyState description="Usa il pulsante in alto per inviarne una." title="Non hai ancora inviato richieste" /></Surface>
      ) : (
        <div className="space-y-2">
          {availability.map((item) => (
            <Surface className="p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3"><div><b className="text-sm">{dateTime(item.starts_at)}</b><p className="mt-1 text-xs text-stone-500">fino a {dateTime(item.ends_at)}</p></div><StatusBadge status={item.status}>{item.status}</StatusBadge></div>
              {item.reason && <p className="mt-3 text-sm text-stone-600">{item.reason}</p>}
              {item.review_note && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-xs text-stone-600"><b>Nota responsabile:</b> {item.review_note}</p>}
              {item.status === "pending" && <button className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-700 disabled:opacity-50" disabled={!canManageAgenda} onClick={() => void withdrawAvailabilityRequest(item.id)} type="button"><Trash2 className="size-4" />Ritira richiesta</button>}
            </Surface>
          ))}
        </div>
      )}
      <RequestModal canManageAgenda={canManageAgenda} endsAt={requestEndsAt} onClose={() => setRequestModalOpen(false)} onEndsAtChange={setRequestEndsAt} onStartsAtChange={setRequestStartsAt} onSubmit={requestAvailability} open={requestModalOpen} startsAt={requestStartsAt} />
    </main>
  );
}
