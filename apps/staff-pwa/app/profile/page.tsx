"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { Button, FormField, SaveToast } from "@esse-beauty/ui";

import { staffRequest } from "../../lib/staff-auth";
import { weekRange } from "../../lib/format";
import type { Report } from "../../lib/types";
import { Metric } from "../_components/Metric";
import { Surface } from "../_components/Surface";
import { useStaffAuth } from "../_components/StaffAuthProvider";

export default function StaffProfilePage() {
  const { logout, session } = useStaffAuth();
  const [report, setReport] = useState<Report>();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const permissionSet = new Set(session?.permissions ?? []);
  const canViewReports = permissionSet.has(PERMISSION_KEYS.REPORTS_VIEW_OWN) && session?.modules.staff_performance;

  useEffect(() => {
    if (!session || !canViewReports) return;
    void staffRequest<Report>(`/api/staff-app/reports?${weekRange(0).params}`).then(setReport).catch(() => undefined);
  }, [session, canViewReports]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => { setMessage(""); setError(""); }, 2800);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  async function changePassword(formData: FormData) {
    try {
      await staffRequest("/api/auth/change-password", {
        body: JSON.stringify({ current_password: formData.get("current_password"), new_password: formData.get("new_password") }),
        method: "POST",
      });
      setMessage("Password aggiornata.");
    } catch {
      setError("Cambio password non riuscito.");
    }
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 lg:max-w-2xl lg:p-8">
      <SaveToast visible={Boolean(message)} variant="success">{message}</SaveToast>
      <SaveToast visible={Boolean(error)} variant="error">{error}</SaveToast>
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">Account</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-[-.025em] text-stone-950">Profilo</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">{session.staff.display_name}</p>
      </header>
      {canViewReports && (
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Appuntamenti" value={report?.appointment_count ?? 0} />
          <Metric label="Completati" value={report?.completed_count ?? 0} />
          <Metric label="No-show" value={report?.no_show_count ?? 0} />
          <Metric label="Clienti" value={report?.unique_customers ?? 0} />
        </div>
      )}
      <Surface>
        <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setSecurityOpen((value) => !value)} type="button">
          <span><span className="block text-xl font-bold tracking-[-.015em] text-stone-950">Sicurezza</span><span className="mt-1 block text-sm text-stone-500">Aggiorna la password del tuo account.</span></span>
          <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${securityOpen ? "rotate-180" : ""}`} />
        </button>
        {securityOpen && (
          <form action={changePassword} className="mt-5 space-y-4">
            <FormField label="Password attuale" required><input name="current_password" required type="password" /></FormField>
            <FormField label="Nuova password" required description="Minimo 10 caratteri."><input minLength={10} name="new_password" required type="password" /></FormField>
            <Button className="w-full" type="submit" variant="outline">Cambia password</Button>
          </form>
        )}
      </Surface>
      <Button className="w-full" onClick={() => void logout()} variant="destructive">Esci dall’app</Button>
    </main>
  );
}
