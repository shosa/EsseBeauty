"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, FormField } from "@esse-beauty/ui";
import { buildAssetPayload } from "../expense-form";
import type { WarehousePaymentMethod, WarehouseSupplier } from "../warehouse-types";

export function AssetPurchaseDialog({
  onClose,
  onSave,
  open,
  suppliers,
}: {
  onClose(): void;
  onSave(input: ReturnType<typeof buildAssetPayload>): Promise<void> | void;
  open: boolean;
  suppliers: WarehouseSupplier[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({ cost: "", date: today, description: "", externalReference: "", idempotencyKey: crypto.randomUUID(), location: "", notes: "", paymentMethod: "cash" as WarehousePaymentMethod, serialNumber: "", supplierId: "", warrantyExpiresAt: "" });
  useEffect(() => {
    if (open) setDraft({ cost: "", date: today, description: "", externalReference: "", idempotencyKey: crypto.randomUUID(), location: "", notes: "", paymentMethod: "cash", serialNumber: "", supplierId: "", warrantyExpiresAt: "" });
  }, [open, today]);

  return (
    <Dialog footer={<><Button onClick={onClose} variant="outline">Annulla</Button><Button form="asset-purchase-form" type="submit" variant="primary">Inserisci</Button></>} onClose={onClose} open={open} title="Inserisci attrezzatura">
      <form className="grid gap-4" id="asset-purchase-form" onSubmit={(event) => { event.preventDefault(); void onSave(buildAssetPayload(draft)); }}>
        <FormField label="Attrezzatura" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Costo" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, cost: event.target.value }))} value={draft.cost} /></FormField>
          <FormField label="Data acquisto" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={draft.date} /></FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pagamento"><select className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as WarehousePaymentMethod }))} value={draft.paymentMethod}><option value="cash">Contanti</option><option value="card">Carta</option><option value="bank_transfer">Bonifico</option><option value="other">Altro</option></select></FormField>
          <FormField label="Fornitore"><select className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, supplierId: event.target.value }))} value={draft.supplierId}><option value="">Nessuno</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Matricola"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, serialNumber: event.target.value }))} value={draft.serialNumber} /></FormField>
          <FormField label="Garanzia"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, warrantyExpiresAt: event.target.value }))} type="date" value={draft.warrantyExpiresAt} /></FormField>
          <FormField label="Posizione"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} value={draft.location} /></FormField>
        </div>
        <FormField label="Riferimento documento"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, externalReference: event.target.value }))} value={draft.externalReference} /></FormField>
      </form>
    </Dialog>
  );
}
