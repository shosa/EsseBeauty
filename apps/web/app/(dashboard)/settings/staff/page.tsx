"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SlidersHorizontal, UserRoundPlus } from "lucide-react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, DataTable, InlineError, PageHeader, PageTransition, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { staffStatusAction } from "./staff-status-action";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Member {
  active: boolean;
  bio?: string;
  color: string;
  displayName: string;
  id: string;
  locationName?: string | null;
  serviceCount: number;
  specializations: string[];
  workingHours: WorkingHours;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "—";
}

export default function SettingsStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState<Member>();
  const [pendingId, setPendingId] = useState("");
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    setLoading(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare la configurazione staff.");
      setLoading(false);
      return;
    }
    setStaff(await response.json() as Member[]);
    setLoading(false);
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
      setConfirmDeactivate(undefined);
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
          actions={<Button onClick={() => router.push("/settings/staff/new")} variant="primary"><UserRoundPlus aria-hidden="true" className="size-4" />Nuovo collaboratore</Button>}
          eyebrow="Staff"
          title="Staff"
          subtitle="Crea nuovi collaboratori, apri un profilo per configurarlo e attiva o disattiva il loro accesso operativo."
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}

        <div>
          <DataTable
            columns={[
              {
                header: "Collaboratore",
                key: "name",
                render: (member) => (
                  <Link className="group flex min-w-0 items-center gap-3" href={`/staff/${member.id}`}>
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: member.color }}>
                      {initials(member.displayName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-stone-900 group-hover:text-[#792f59]">{member.displayName}</span>
                      <span className="block truncate text-xs text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</span>
                    </span>
                  </Link>
                ),
              },
              {
                header: "Sede",
                key: "location",
                render: (member) => member.locationName ?? <span className="text-stone-400">Non assegnata</span>,
              },
              {
                header: "Servizi",
                key: "services",
                render: (member) => `${member.serviceCount} ${member.serviceCount === 1 ? "abilitato" : "abilitati"}`,
              },
              {
                header: "Stato",
                key: "status",
                render: (member) => (
                  <StatusBadge status={member.active ? "active" : "inactive"}>{member.active ? "Operativo" : "Disattivato"}</StatusBadge>
                ),
              },
              {
                align: "right",
                header: "Azioni",
                key: "actions",
                render: (member) => (
                  <div className="flex items-center justify-end gap-4">
                    <Button onClick={() => router.push(`/staff/${member.id}`)} size="sm" variant="outline">
                      <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                      Configura
                    </Button>
                    <span className="flex items-center gap-2" title={`${staffStatusAction(member.active).label} ${member.displayName}`}>
                      <Switch
                        aria-label={`${staffStatusAction(member.active).label} ${member.displayName}`}
                        checked={member.active}
                        disabled={pendingId === member.id}
                        onCheckedChange={() => requestStatusChange(member)}
                      />
                    </span>
                  </div>
                ),
              },
            ]}
            empty="Nessun collaboratore configurato"
            getRowId={(member) => member.id}
            items={staff}
            loading={loading}
          />
        </div>
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
