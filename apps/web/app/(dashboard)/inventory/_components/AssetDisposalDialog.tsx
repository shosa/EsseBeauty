"use client";

import { useState } from "react";
import { Button, Dialog, FormField } from "@esse-beauty/ui";
import type { WarehouseAsset } from "../warehouse-types";

export function AssetDisposalDialog({ asset, onClose, onSave }: { asset?: WarehouseAsset; onClose(): void; onSave(input: { disposed_at: string; reason: string }): Promise<void> | void }) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Dialog footer={<><Button onClick={onClose} variant="outline">Annulla</Button><Button disabled={!reason.trim()} form="asset-disposal-form" type="submit" variant="destructive">Dismetti</Button></>} onClose={onClose} open={Boolean(asset)} title={asset ? `Dismetti ${asset.description}` : "Dismetti attrezzatura"}>
      <form className="grid gap-4" id="asset-disposal-form" onSubmit={(event) => { event.preventDefault(); void onSave({ disposed_at: date, reason }); }}>
        <FormField label="Data" required><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></FormField>
        <FormField label="Motivo" required><textarea className="min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2" onChange={(event) => setReason(event.target.value)} value={reason} /></FormField>
      </form>
    </Dialog>
  );
}
