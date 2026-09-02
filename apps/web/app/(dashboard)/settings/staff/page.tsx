"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, Dialog, EmptyState, FormField, InlineError, PageHeader, PageTransition, SaveActionButton, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { staffStatusAction } from "./staff-status-action";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type StaffStatus = "all" | "active" | "inactive";

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
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

export default function SettingsStaffPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { salon } = useAuth();
  const [staff, setStaff] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState<Member>();
  const [pendingId, setPendingId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StaffStatus>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [salonHours, setSalonHours] = useState<WorkingHours>();

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

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/staff-default-hours`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((settings: { opening_hours?: WorkingHours } | null) => {
        if (settings?.opening_hours) setSalonHours(settings.opening_hours);
      });
  }, [salon?.id]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setNewOpen(true);
      router.replace("/staff/manage");
    }
  }, [router, searchParams]);

  function closeNewStaff() {
    setNewOpen(false);
    setCreateError("");
  }

  async function createStaff(data: FormData) {
    if (!salon) return;
    setCreating(true);
    setCreateError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: data.get("display_name"),
        bio: data.get("bio") || undefined,
        working_hours: salonHours ?? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        color: "#be6b7b",
      }),
    });
    if (!response.ok) {
      setCreateError("Collaboratore non creato.");
      setCreating(false);
      return;
    }
    const member = await response.json() as { id: string };
    router.push(`/staff/${member.id}`);
  }

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

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    return staff.filter((member) => {
      if (status === "active" && !member.active) return false;
      if (status === "inactive" && member.active) return false;
      if (!query) return true;
      return member.displayName.toLocaleLowerCase("it-IT").includes(query)
        || member.specializations.some((item) => item.toLocaleLowerCase("it-IT").includes(query));
    });
  }, [search, staff, status]);

  const filtersActive = Boolean(search || status !== "all");

  function resetFilters() {
    setSearch("");
    setStatus("all");
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          actions={<Button onClick={() => setNewOpen(true)} variant="primary"><Plus aria-hidden="true" className="size-4" />Nuovo collaboratore</Button>}
          eyebrow="Staff"
          subtitle="Cerca, apri un profilo per configurarlo e attiva o disattiva l'accesso operativo di ogni collaboratore."
          title="Collaboratori"
        />

        {error && <InlineError className="mb-4">{error}</InlineError>}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Cerca collaboratore</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nome o specializzazione…" value={search} />
          </label>
          <label className="w-[180px]">
            <span className="sr-only">Stato collaboratore</span>
            <select className="w-full" onChange={(event) => setStatus(event.target.value as StaffStatus)} value={status}>
              <option value="all">Tutti i collaboratori</option>
              <option value="active">Solo attivi</option>
              <option value="inactive">Solo disattivati</option>
            </select>
          </label>
          <Button disabled={!filtersActive} onClick={resetFilters} variant="outline">Azzera filtri</Button>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-stone-950">Team</h2>
              <p className="mt-1 text-xs text-stone-500">{filtered.length} di {staff.length} collaboratori</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse rounded-xl bg-stone-100" key={index} />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6"><EmptyState action={filtersActive ? <Button onClick={resetFilters} variant="outline">Rimuovi filtri</Button> : <Button onClick={() => setNewOpen(true)} variant="outline">Nuovo collaboratore</Button>} description="Modifica la ricerca oppure crea un nuovo collaboratore." title="Nessun collaboratore trovato" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.14em] text-stone-500">
                  <tr><th className="px-5 py-3">Collaboratore</th><th>Sede</th><th>Servizi</th><th>Stato</th><th className="w-12 pr-5" /></tr>
                </thead>
                <tbody>
                  {filtered.map((member) => (
                    <tr
                      className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888]"
                      key={member.id}
                      onClick={() => router.push(`/staff/${member.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/staff/${member.id}`);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: member.color }}>{initials(member.displayName)}</span>
                          <span className="min-w-0"><strong className="block truncate text-stone-950 group-hover:text-[#792f59]">{member.displayName}</strong><span className="mt-0.5 block truncate text-xs text-stone-500">{member.specializations.join(", ") || "Specializzazioni da definire"}</span></span>
                        </div>
                      </td>
                      <td className="text-stone-600">{member.locationName ?? <span className="text-stone-400">Non assegnata</span>}</td>
                      <td className="text-stone-600">{member.serviceCount} {member.serviceCount === 1 ? "abilitato" : "abilitati"}</td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <span className="flex items-center gap-2" title={`${staffStatusAction(member.active).label} ${member.displayName}`}>
                          <Switch
                            aria-label={`${staffStatusAction(member.active).label} ${member.displayName}`}
                            checked={member.active}
                            disabled={pendingId === member.id}
                            onCheckedChange={() => requestStatusChange(member)}
                          />
                          <span className="text-xs font-semibold text-stone-500">{member.active ? "Operativo" : "Disattivato"}</span>
                        </span>
                      </td>
                      <td className="pr-5 text-right"><ChevronRight aria-hidden="true" className="inline-block size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#792f59]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageTransition>

      <Dialog onClose={closeNewStaff} open={newOpen} title="Nuovo collaboratore">
        <form action={createStaff} className="grid gap-4">
          {createError && <InlineError>{createError}</InlineError>}
          <FormField label="Nome visibile" required><input autoFocus className="w-full" name="display_name" required /></FormField>
          <FormField description="Orari, accesso e servizi si configurano subito dopo dal profilo." label="Bio o note interne"><textarea className="w-full" name="bio" rows={3} /></FormField>
          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button disabled={creating} onClick={closeNewStaff} type="button" variant="ghost">Annulla</Button>
            <SaveActionButton busy={creating} idleLabel="Crea collaboratore" saved={false} type="submit" />
          </div>
        </form>
      </Dialog>

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
