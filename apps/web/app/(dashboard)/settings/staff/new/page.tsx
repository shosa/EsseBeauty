"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";
import type { WorkingHours } from "@esse-beauty/shared";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const emptyHours: WorkingHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

export default function NewStaffPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
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
      return;
    }
    const member = await response.json() as { id: string };
    router.push(`/settings/staff/${member.id}`);
  }

  return (
    <main className="p-5 md:p-8">
      <form action={create} className="mx-auto grid max-w-[1000px] gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/settings/staff", label: "Staff & disponibilità" }, { label: "Nuovo collaboratore" }]} />
        <h1 className="text-3xl font-bold">Nuovo collaboratore</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome visibile" required><input required name="display_name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Bio o note interne"><textarea name="bio" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/settings/staff")}>Annulla</Button>
          <Button type="submit">Crea</Button>
        </div>
      </form>
    </main>
  );
}
