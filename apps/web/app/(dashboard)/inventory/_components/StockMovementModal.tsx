"use client";

import { useState } from "react";
import { Button, Dialog } from "@esse-beauty/ui";

export function StockMovementModal({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose(): void;
  onConfirm(delta: number, reason: string): Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("restock");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onConfirm(delta, reason);
    } catch {
      setError("Movimento non registrato. Verifica i dati e riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      footer={
        <>
          <Button onClick={onClose} variant="outline">Annulla</Button>
          <Button disabled={delta === 0 || saving} onClick={() => void submit()} variant="primary">{saving ? "Salvataggio…" : "Registra"}</Button>
        </>
      }
      onClose={onClose}
      open
      title={`Movimento · ${name}`}
    >
      <div className="grid gap-4">
        {error && <p aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <label className="block text-sm font-semibold">
          Quantità (+ carico, − scarico)
          <input value={delta} onChange={(event) => setDelta(Number(event.target.value))} type="number" className="mt-2 min-h-12 w-full rounded-xl border px-3" />
        </label>
        <label className="block text-sm font-semibold">
          Motivo
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3">
            <option value="restock">Rifornimento</option>
            <option value="usage">Utilizzo</option>
            <option value="loss">Perdita</option>
            <option value="other">Altro</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}
