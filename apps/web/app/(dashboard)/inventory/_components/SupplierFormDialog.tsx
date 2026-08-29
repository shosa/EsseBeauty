"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, FormField, InlineError, Switch } from "@esse-beauty/ui";
import type { WarehouseSupplier } from "../warehouse-types";

type SupplierDraft = Partial<WarehouseSupplier> & { name: string };

const emptyDraft: SupplierDraft = {
  active: true,
  address: "",
  city: "",
  contactName: "",
  country: "Italia",
  email: "",
  name: "",
  notes: "",
  paymentTerms: "",
  phone: "",
  postalCode: "",
  taxCode: "",
  vatNumber: "",
};

function supplierDraft(supplier?: WarehouseSupplier): SupplierDraft {
  return supplier
    ? {
        ...emptyDraft,
        ...supplier,
        active: supplier.active,
        address: supplier.address ?? "",
        city: supplier.city ?? "",
        contactName: supplier.contactName ?? "",
        country: supplier.country ?? "Italia",
        email: supplier.email ?? "",
        notes: supplier.notes ?? "",
        paymentTerms: supplier.paymentTerms ?? "",
        phone: supplier.phone ?? "",
        postalCode: supplier.postalCode ?? "",
        taxCode: supplier.taxCode ?? "",
        vatNumber: supplier.vatNumber ?? "",
      }
    : emptyDraft;
}

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function toPayload(draft: SupplierDraft): SupplierDraft {
  return {
    active: draft.active ?? true,
    address: clean(draft.address),
    city: clean(draft.city),
    contactName: clean(draft.contactName),
    country: clean(draft.country),
    email: clean(draft.email),
    name: draft.name.trim(),
    notes: clean(draft.notes),
    paymentTerms: clean(draft.paymentTerms),
    phone: clean(draft.phone),
    postalCode: clean(draft.postalCode),
    taxCode: clean(draft.taxCode),
    vatNumber: clean(draft.vatNumber),
  };
}

export function SupplierFormDialog({
  error,
  loading = false,
  onClose,
  onSave,
  open,
  supplier,
}: {
  error?: string;
  loading?: boolean;
  onClose(): void;
  onSave(input: SupplierDraft): Promise<void> | void;
  open: boolean;
  supplier?: WarehouseSupplier;
}) {
  const [draft, setDraft] = useState<SupplierDraft>(() => supplierDraft(supplier));

  useEffect(() => {
    if (open) setDraft(supplierDraft(supplier));
  }, [open, supplier]);

  const title = supplier ? "Modifica fornitore" : "Nuovo fornitore";
  const canSave = draft.name.trim().length > 0 && !loading;

  return (
    <Dialog
      footer={
        <>
          <Button disabled={loading} onClick={onClose} variant="outline">
            Annulla
          </Button>
          <Button disabled={!canSave} form="supplier-form" type="submit" variant="primary">
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <form
        className="grid gap-4"
        id="supplier-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          void onSave(toPayload(draft));
        }}
      >
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome fornitore" required>
          <input
            className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            value={draft.name}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Referente">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))} value={draft.contactName ?? ""} />
          </FormField>
          <FormField label="Pagamento">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} value={draft.paymentTerms ?? ""} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} type="email" value={draft.email ?? ""} />
          </FormField>
          <FormField label="Telefono">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} value={draft.phone ?? ""} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Partita IVA">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, vatNumber: event.target.value }))} value={draft.vatNumber ?? ""} />
          </FormField>
          <FormField label="Codice fiscale">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, taxCode: event.target.value }))} value={draft.taxCode ?? ""} />
          </FormField>
        </div>
        <FormField label="Indirizzo">
          <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} value={draft.address ?? ""} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px_160px]">
          <FormField label="Città">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} value={draft.city ?? ""} />
          </FormField>
          <FormField label="CAP">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, postalCode: event.target.value }))} value={draft.postalCode ?? ""} />
          </FormField>
          <FormField label="Paese">
            <input className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} value={draft.country ?? ""} />
          </FormField>
        </div>
        <FormField label="Note">
          <textarea className="min-h-24 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes ?? ""} />
        </FormField>
        {supplier && (
          <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-stone-900">Fornitore attivo</p>
              <p className="text-xs text-stone-500">Disattiva per archiviarlo senza perdere lo storico.</p>
            </div>
            <Switch checked={draft.active ?? true} onCheckedChange={(active) => setDraft((current) => ({ ...current, active }))} />
          </div>
        )}
      </form>
    </Dialog>
  );
}
