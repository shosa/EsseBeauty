"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Entry { id: string; customer_name: string; service_name: string; staff_name?: string; requested_date: string; status: string; created_at: string; }

export default function WaitlistPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/waitlist`, { credentials: "include" }).then((response) => response.json()).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon]);
  async function update(id: string, status: string) { await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); await load(); }
  async function remove(id: string) { await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" }); await load(); }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Disponibilità</p><h1 className="mt-2 text-3xl font-bold">Lista d&apos;attesa</h1></header>
    <div className="mt-7 overflow-x-auto rounded-[2rem] bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#402334] text-white"><tr>{["Cliente","Servizio","Data richiesta","Staff","Stato","Azioni"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-stone-100 last:border-0"><td className="p-4 font-bold">{item.customer_name}</td><td>{item.service_name}</td><td>{new Date(item.requested_date).toLocaleDateString("it-IT")}</td><td>{item.staff_name ?? "Qualsiasi"}</td><td><span className="rounded-full bg-stone-100 px-3 py-1">{item.status}</span></td><td><div className="flex gap-2"><button onClick={() => void update(item.id, "notified")} className="text-[#792f59]">Notifica</button><button onClick={() => void update(item.id, "booked")} className="text-emerald-700">Prenotato</button><button onClick={() => void remove(item.id)} className="text-red-700">Elimina</button></div></td></tr>)}</tbody></table></div>
  </div></main>;
}
