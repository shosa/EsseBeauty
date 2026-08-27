"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SlidersHorizontal, UserRoundCheck, UserRoundMinus, UserRoundPlus } from "lucide-react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, InlineError, PageHeader, PageTransition, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { staffStatusAction } from "./staff-status-action";

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
  const [confirmDeactivate, setConfirmDeactivate] = useState<Member>();
  const [pendingId, setPendingId] = useState("");
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

  async function setActive(member: Member, active: boolean) {
    if (!salon) return;
    setError("");
    setPendingId(member.id);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${member.id}`, {
      body: JSON.stringify({ active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setError(`Il collaboratore non è stato ${active ? "riattivato" : "disattivato"}.`);
      setPendingId("");
      return;
    }
    setConfirmDeactivate(undefined);
    await load();
    setPendingId("");
  }

  function requestStatusChange(member: Member) {
    const action = staffStatusAction(member.active);
    if (action.confirmationRequired) {
      setConfirmDeactivate(member);
      return;
    }
    void setActive(member, action.nextActive);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          actions={<Link href="/settings/staff/new" className="inline-flex items-center gap-2.5 rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"><UserRoundPlus className="size-5" strokeWidth={2.25} />Nuovo collaboratore</Link>}
          eyebrow="Core"
          title="Staff"
          subtitle="Profili collaboratori, accessi App Staff e orari ricorrenti. Ferie e assenze si gestiscono dalla pagina Permessi."
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        <section className="grid gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <SectionCard className={member.active ? "" : "bg-stone-50 opacity-70"} key={member.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="mt-1 h-12 w-2 rounded-full" style={{ background: member.color }} />
                  <div>
                    <Link href={`/staff/${member.id}`} className="text-lg font-bold hover:text-[#792f59]">{member.displayName}</Link>
                    <p className="text-sm text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</p>
                    <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold ${member.active ? "text-emerald-700" : "text-stone-500"}`}><span className={`size-1.5 rounded-full ${member.active ? "bg-emerald-500" : "bg-stone-400"}`} />{member.active ? "Operativo" : "Disattivato"}</p>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-sm text-stone-600">{member.bio || "Profilo operativo pronto per accesso e orari."}</p>
              <div className="mt-5 flex justify-end gap-2 border-t border-stone-100 pt-4">
                <Link aria-label={`Configura ${member.displayName}`} href={`/staff/${member.id}`} className="grid size-[52px] place-items-center rounded-2xl border-2 border-[#d7a6c1] bg-white text-[#792f59] shadow-sm transition hover:-translate-y-0.5 hover:border-[#792f59] hover:bg-[#fff8fb] hover:shadow-md" title="Configura"><SlidersHorizontal className="size-6" strokeWidth={2.25} /></Link>
                <Button aria-label={`${staffStatusAction(member.active).label} ${member.displayName}`} className={`size-[52px] rounded-2xl border-2 p-0 ${member.active ? "!border-red-300 !bg-red-50 !text-red-700 hover:!border-red-700 hover:!bg-red-700 hover:!text-white" : "!border-emerald-300 !bg-emerald-50 !text-emerald-800 hover:!border-emerald-700 hover:!bg-emerald-700 hover:!text-white"}`} disabled={pendingId === member.id} onClick={() => requestStatusChange(member)} title={staffStatusAction(member.active).label} variant="outline">{member.active ? <UserRoundMinus className="size-6" strokeWidth={2.25} /> : <UserRoundCheck className="size-6" strokeWidth={2.25} />}</Button>
              </div>
            </SectionCard>
          ))}
        </section>
      </PageTransition>
      <ConfirmDialog
        confirmLabel="Disattiva"
        destructive
        description="Il collaboratore verrà escluso dalle configurazioni attive senza eliminare lo storico."
        onCancel={() => setConfirmDeactivate(undefined)}
        onConfirm={() => confirmDeactivate && void setActive(confirmDeactivate, false)}
        open={Boolean(confirmDeactivate)}
        title={`Disattivare ${confirmDeactivate?.displayName ?? "collaboratore"}?`}
      />
    </AppPage>
  );
}
