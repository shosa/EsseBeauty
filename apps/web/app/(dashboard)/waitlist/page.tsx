"use client";

import { useEffect, useState } from "react";
import { AppPage, Button, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Entry {
  created_at: string;
  customer_name: string;
  id: string;
  requested_date: string;
  service_name: string;
  staff_name?: string;
  status: string;
}

export default function WaitlistPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/waitlist`, { credentials: "include" }).then((response) => response.json()).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon]);
  async function update(id: string, status: string) { await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); await load(); }
  async function remove(id: string) { await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" }); await load(); }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Disponibilita"
          title="Lista d'attesa"
          subtitle="Richieste da gestire quando non esiste ancora uno slot adatto."
          status={<StatusBadge status="waiting">{items.length} richieste</StatusBadge>}
        />
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-stone-950 text-white">
                <tr>{["Cliente", "Servizio", "Data richiesta", "Staff", "Stato", "Azioni"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="p-4 font-bold">{item.customer_name}</td>
                    <td>{item.service_name}</td>
                    <td>{new Date(item.requested_date).toLocaleDateString("it-IT")}</td>
                    <td>{item.staff_name ?? "Qualsiasi"}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      <div className="flex gap-2">
                        <Button active={item.status === "notified"} disabled={item.status === "notified"} onClick={() => void update(item.id, "notified")} size="sm" variant="tableAction">Notifica</Button>
                        <Button active={item.status === "booked"} disabled={item.status === "booked"} onClick={() => void update(item.id, "booked")} size="sm" variant="tableAction">Prenotato</Button>
                        <Button onClick={() => void remove(item.id)} size="sm" variant="destructive">Elimina</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </PageTransition>
    </AppPage>
  );
}
