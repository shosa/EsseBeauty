"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PERMISSION_KEYS, type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, InlineError, PageHeader, PageTransition, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

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

export default function StaffPage() {
  const [staff, setStaff] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Member>();
  const { hasPermission, salon } = useAuth();
  const canEdit = hasPermission(PERMISSION_KEYS.SETTINGS_STAFF);

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare lo staff.");
      return;
    }
    const data: unknown = await response.json();
    setStaff(Array.isArray(data) ? data as Member[] : []);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function toggle(member: Member) {
    if (!salon || !canEdit) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${member.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
    if (!response.ok) setError("Lo stato del collaboratore non e stato aggiornato.");
    await load();
  }

  async function remove() {
    if (!salon || !confirmDelete) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${confirmDelete.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) setError("Il collaboratore non e stato eliminato.");
    setConfirmDelete(undefined);
    await load();
  }

  return (
    <AppPage>
      <PageTransition>
        <PageHeader
          eyebrow="Team"
          title="Staff"
          subtitle={`${staff.length} collaboratori configurati`}
          actions={canEdit ? <Link href="/staff/new" className="rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5">Nuovo collaboratore</Link> : <Button disabled>Nuovo collaboratore</Button>}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        <div className="grid gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <article key={member.id} className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="mt-1 h-12 w-2 rounded-full" style={{ background: member.color }} />
                  <div>
                    <Link href={`/staff/${member.id}`} className="text-lg font-bold hover:text-[#792f59]">{member.displayName}</Link>
                    <p className="text-sm text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</p>
                  </div>
                </div>
                <Switch checked={member.active} disabled={!canEdit} onCheckedChange={() => void toggle(member)} />
              </div>
              <p className="mt-5 text-sm text-stone-600">{member.bio || "Profilo operativo pronto per orari e blocchi di disponibilita."}</p>
              <div className="mt-5 grid grid-cols-7 gap-1">
                {Object.entries(member.workingHours).map(([day, hours]) => (
                  <div key={day} className="text-center">
                    <span className="text-[10px] font-bold uppercase text-stone-400">{day}</span>
                    <div className={`mt-1 h-8 rounded-md ${hours.length ? "bg-rose-100" : "bg-stone-100"}`} />
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/staff/${member.id}`} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 hover:border-[#792f59] hover:text-[#792f59]">Apri scheda</Link>
                  <Button onClick={() => setConfirmDelete(member)} variant="destructive">Elimina</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </PageTransition>
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il collaboratore verra rimosso dalle configurazioni attive."
        onCancel={() => setConfirmDelete(undefined)}
        onConfirm={() => void remove()}
        open={Boolean(confirmDelete)}
        title={`Eliminare ${confirmDelete?.displayName ?? "collaboratore"}?`}
      />
    </AppPage>
  );
}
