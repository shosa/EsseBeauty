"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, FormField } from "@esse-beauty/ui";
import { buildExpensePayload } from "../expense-form";
import type { WarehousePaymentMethod, WarehouseSupplier } from "../warehouse-types";

export function ExpenseDialog({
  onClose,
  onSave,
  open,
  suppliers,
}: {
  onClose(): void;
  onSave(input: ReturnType<typeof buildExpensePayload>): Promise<void> | void;
  open: boolean;
  suppliers: WarehouseSupplier[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({ amount: "", category: "Varie", date: today, description: "", idempotencyKey: crypto.randomUUID(), notes: "", paymentMethod: "cash" as WarehousePaymentMethod, supplierId: "", vat: "0" });
  const [details, setDetails] = useState(false);
  useEffect(() => {
    if (open) setDraft({ amount: "", category: "Varie", date: today, description: "", idempotencyKey: crypto.randomUUID(), notes: "", paymentMethod: "cash", supplierId: "", vat: "0" });
  }, [open, today]);

  return (
    <Dialog
      footer={<><Button onClick={onClose} variant="outline">Annulla</Button><Button form="expense-dialog-form" type="submit" variant="primary">Registra</Button></>}
      onClose={onClose}
      open={open}
      title="Registra spesa"
    >
      <form className="grid gap-4" id="expense-dialog-form" onSubmit={(event) => { event.preventDefault(); void onSave(buildExpensePayload(draft)); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Importo" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} value={draft.amount} /></FormField>
          <FormField label="Data" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={draft.date} /></FormField>
        </div>
        <FormField label="Motivo" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Categoria"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} value={draft.category} /></FormField>
          <FormField label="Pagamento"><select className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as WarehousePaymentMethod }))} value={draft.paymentMethod}><option value="cash">Contanti</option><option value="card">Carta</option><option value="bank_transfer">Bonifico</option><option value="other">Altro</option></select></FormField>
        </div>
        <FormField label="Note"><textarea className="min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes} /></FormField>
        <details open={details} onToggle={(event) => setDetails(event.currentTarget.open)}>
          <summary className="cursor-pointer text-sm font-bold text-[#792f59]">Aggiungi dettagli documento</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField label="Fornitore"><select className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, supplierId: event.target.value }))} value={draft.supplierId}><option value="">Nessuno</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></FormField>
            <FormField label="IVA"><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDraft((current) => ({ ...current, vat: event.target.value }))} value={draft.vat} /></FormField>
          </div>
        </details>
      </form>
    </Dialog>
  );
}
