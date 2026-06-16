"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ActionBar,
  AppPage,
  Breadcrumbs,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineError,
  PageHeader,
  PageSkeleton,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
} from "@esse-beauty/ui";

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

const statusActions = [
  { label: "Conferma", status: "confirmed", variant: "secondary" },
  { label: "Completa", status: "completed", variant: "primary" },
  { label: "No-show", status: "no_show", variant: "outline" },
  { label: "Annulla", status: "cancelled", variant: "destructive" },
] as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function minutesBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

function relativeTiming(startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now < start) return `Tra ${Math.max(1, Math.round((start - now) / 60000))} min`;
  if (now <= end) return "In corso";
  return `Terminato da ${Math.max(1, Math.round((now - end) / 60000))} min`;
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
    setItem((await response.json()) as Appointment);
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
    <AppPage maxWidth="max-w-5xl">
      <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Appuntamento" }]} />
      {error && <div className="mb-4"><InlineError>{error}</InlineError></div>}
      {!item ? (
        <EmptyState title="Appuntamento non trovato" description="Potrebbe essere stato eliminato o non essere accessibile." />
      ) : (
        <>
          <PageHeader
            eyebrow="Appuntamento"
            title={item.customer_name}
            subtitle={`${item.service_name} con ${item.staff_name}`}
            status={<StatusBadge status={item.status} />}
            actions={
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                Elimina appuntamento
              </Button>
            }
          />

          <StatGrid>
            <StatCard label="Durata" value={`${minutesBetween(item.starts_at, item.ends_at)} min`} detail={relativeTiming(item.starts_at, item.ends_at)} />
            <StatCard label="Inizio" value={formatDateTime(item.starts_at)} />
            <StatCard label="Fine" value={formatDateTime(item.ends_at)} />
            <StatCard label="Collaboratore" value={item.staff_name} />
          </StatGrid>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <SectionCard title="Dettagli operativi" subtitle="Riepilogo rapido per gestire l'appuntamento senza cambiare schermata.">
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <dt className="font-bold text-stone-500">Cliente</dt>
                  <dd className="mt-1 text-lg font-black">{item.customer_name}</dd>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <dt className="font-bold text-stone-500">Servizio</dt>
                  <dd className="mt-1 text-lg font-black">{item.service_name}</dd>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4 md:col-span-2">
                  <dt className="font-bold text-stone-500">Note interne</dt>
                  <dd className="mt-2 leading-6">{item.notes || "Nessuna nota interna."}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Stato appuntamento" subtitle="Lo stato attivo resta evidenziato; le altre azioni sono disponibili come transizioni rapide.">
              <ActionBar className="flex-col items-stretch">
                {statusActions.map(({ status, label, variant }) => (
                  <Button
                    active={item.status === status}
                    disabled={item.status === status}
                    key={status}
                    type="button"
                    variant={item.status === status ? "primary" : variant}
                    onClick={() => void updateStatus(status)}
                  >
                    {label}
                  </Button>
                ))}
              </ActionBar>
            </SectionCard>
          </div>
        </>
      )}
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        open={confirmDelete}
        title="Eliminare appuntamento?"
        description="L'appuntamento verra rimosso dal calendario. Questa operazione non puo essere annullata."
      />
    </AppPage>
  );
}
