"use client";

import { useState } from "react";

export function StockMovementModal({ name, onClose, onConfirm }: { name: string; onClose(): void; onConfirm(delta: number, reason: string): Promise<void> }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("restock");
  return <div className="fixed inset-0 grid place-items-center bg-black/35 p-4"><form onSubmit={(event) => { event.preventDefault(); void onConfirm(delta, reason); }} className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">Movimento · {name}</h2><label className="mt-5 block text-sm font-semibold">Quantità (+ carico, − scarico)<input value={delta} onChange={(event) => setDelta(Number(event.target.value))} type="number" className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label><label className="mt-4 block text-sm font-semibold">Motivo<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3"><option value="restock">Rifornimento</option><option value="usage">Utilizzo</option><option value="loss">Perdita</option><option value="other">Altro</option></select></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose}>Annulla</button><button disabled={delta === 0} className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white disabled:opacity-40">Registra</button></div></form></div>;
}
