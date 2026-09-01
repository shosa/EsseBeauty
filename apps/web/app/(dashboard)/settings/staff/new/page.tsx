"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AppPage, Breadcrumbs, Button, FormField, InlineError, PageHeader, SaveActionButton, SectionCard } from "@esse-beauty/ui";
import type { WorkingHours } from "@esse-beauty/shared";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const emptyHours: WorkingHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

export default function NewStaffPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [salonHours, setSalonHours] = useState<WorkingHours>(emptyHours);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/staff-default-hours`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((settings: { opening_hours?: WorkingHours } | null) => {
        if (settings?.opening_hours) setSalonHours(settings.opening_hours);
      });
  }, [salon]);

  async function create(data: FormData) {
    if (!salon) return;
    setCreating(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: data.get("display_name"),
        bio: data.get("bio") || undefined,
        working_hours: salonHours,
        color: "#be6b7b",
      }),
    });
    if (!response.ok) {
      setError("Collaboratore non creato.");
      setCreating(false);
      return;
    }
    const member = await response.json() as { id: string };
    router.push(`/staff/${member.id}`);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Breadcrumbs items={[{ href: "/staff/manage", label: "Collaboratori" }, { label: "Nuovo collaboratore" }]} />
      <PageHeader eyebrow="Staff" title="Nuovo collaboratore" subtitle="Inserisci nome e una nota interna: orari, accesso e servizi si configurano subito dopo dal profilo." />
      <SectionCard className="max-w-2xl">
        <form action={create} className="grid gap-4">
          {error && <InlineError>{error}</InlineError>}
          <FormField label="Nome visibile" required><input required name="display_name" className="w-full" /></FormField>
          <FormField label="Bio o note interne"><textarea name="bio" className="w-full" /></FormField>
          <div className="flex justify-end gap-3">
            <Button aria-label="Annulla creazione collaboratore" className="size-11 p-0" disabled={creating} type="button" title="Annulla" variant="ghost" onClick={() => router.push("/staff/manage")}><X className="size-5" /></Button>
            <SaveActionButton busy={creating} idleLabel="Crea" saved={false} type="submit" />
          </div>
        </form>
      </SectionCard>
    </AppPage>
  );
}
