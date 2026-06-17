"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Member {
  active: boolean;
  bio?: string;
  color: string;
  displayName: string;
  id: string;
  specializations: string[];
  workingHours: WorkingHours;
}

export default function SettingsStaffPage() {
  const [staff, setStaff] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Member>();
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare la configurazione staff.");
      return;
    }
    setStaff(await response.json() as Member[]);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function toggle(member: Member) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${member.id}`, {
      body: JSON.stringify({ active: !member.active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) setError("Lo stato del collaboratore non è stato aggiornato.");
    await load();
  }

  async function remove() {
    if (!salon || !confirmDelete) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${confirmDelete.id}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) setError("Il collaboratore non è stato disattivato.");
    setConfirmDelete(undefined);
    await load();
  }

  return (
    <AppPage>
      <PageTransition>
        <PageHeader
          actions={<Link href="/settings/staff/new" className="rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5">Nuovo collaboratore</Link>}
          eyebrow="Core"
          title="Staff & Disponibilità"
          subtitle="Configurazione collaboratori, orari contrattuali ricorrenti, ruoli operativi e blocchi disponibilità."
          status={<StatusBadge status="active">{staff.length} profili</StatusBadge>}
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        <section className="grid gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <SectionCard key={member.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="mt-1 h-12 w-2 rounded-full" style={{ background: member.color }} />
                  <div>
                    <Link href={`/settings/staff/${member.id}`} className="text-lg font-bold hover:text-[#792f59]">{member.displayName}</Link>
                    <p className="text-sm text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</p>
                  </div>
                </div>
                <Switch checked={member.active} onCheckedChange={() => void toggle(member)} />
              </div>
              <p className="mt-5 text-sm text-stone-600">{member.bio || "Profilo operativo pronto per orari e blocchi di disponibilità."}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/settings/staff/${member.id}`} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 hover:border-[#792f59] hover:text-[#792f59]">Configura</Link>
                <Button onClick={() => setConfirmDelete(member)} variant="destructive">Disattiva</Button>
              </div>
            </SectionCard>
          ))}
        </section>
      </PageTransition>
      <ConfirmDialog
        confirmLabel="Disattiva"
        destructive
        description="Il collaboratore verrà escluso dalle configurazioni attive senza eliminare lo storico."
        onCancel={() => setConfirmDelete(undefined)}
        onConfirm={() => void remove()}
        open={Boolean(confirmDelete)}
        title={`Disattivare ${confirmDelete?.displayName ?? "collaboratore"}?`}
      />
    </AppPage>
  );
}
