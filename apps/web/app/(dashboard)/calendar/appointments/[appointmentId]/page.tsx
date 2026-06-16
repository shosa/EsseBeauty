"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment {
  customer_name: string;
  ends_at: string;
  id: string;
  notes?: string | null;
  service_name: string;
  staff_name: string;
  starts_at: string;
  status: string;
}

export default function AppointmentDetailPage() {
  const params = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { salon } = useAuth();
  const [item, setItem] = useState<Appointment>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${params.appointmentId}`, { credentials: "include" });
    if (!response.ok) {
      setItem(undefined);
      setError(response.status === 404 ? "" : "Impossibile caricare l'appuntamento.");
      setLoading(false);
      return;
    }
    setItem(await response.json() as Appointment);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, params.appointmentId]);

  async function updateStatus(status: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${params.appointmentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError("Stato non aggiornato.");
      return;
    }
    await load();
  }

  async function remove() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${params.appointmentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Appuntamento non eliminato.");
      setConfirmDelete(false);
      return;
    }
    router.push("/calendar");
  }

  if (loading) return <PageSkeleton />;

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <div className="mx-auto max-w-4xl">
        <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Appuntamento" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!item ? (
          <EmptyState title="Appuntamento non trovato" description="Potrebbe essere stato eliminato o non essere accessibile." />
        ) : (
          <article className="mt-5 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Appuntamento</p>
                <h1 className="mt-2 text-3xl font-bold">{item.customer_name}</h1>
                <p className="mt-2 text-stone-600">{item.service_name} con {item.staff_name}</p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-bold">{item.status}</span>
            </div>
            <dl className="mt-6 grid gap-4 rounded-2xl bg-stone-50 p-4 text-sm md:grid-cols-2">
              <div><dt className="font-bold">Inizio</dt><dd>{new Date(item.starts_at).toLocaleString("it-IT")}</dd></div>
              <div><dt className="font-bold">Fine</dt><dd>{new Date(item.ends_at).toLocaleString("it-IT")}</dd></div>
              <div className="md:col-span-2"><dt className="font-bold">Note</dt><dd>{item.notes || "Nessuna nota interna."}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {([
                ["confirmed", "Conferma"],
                ["completed", "Completa"],
                ["no_show", "No-show"],
                ["cancelled", "Annulla"],
              ] as const).map(([status, label]) => (
                <Button key={status} type="button" variant="outline" onClick={() => void updateStatus(status)}>{label}</Button>
              ))}
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Elimina</Button>
            </div>
          </article>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        open={confirmDelete}
        title="Eliminare appuntamento?"
        description="L'appuntamento verrà rimosso dal calendario."
      />
    </main>
  );
}
