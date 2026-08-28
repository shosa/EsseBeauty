"use client";

import { CalendarDays, FileText, PackageCheck, Pencil, ReceiptText, Truck } from "lucide-react";
import { Button, Drawer } from "@esse-beauty/ui";

import type { WarehouseDocumentDetails, WarehouseDocumentKind, WarehouseSupplier } from "../warehouse-types";
import { warehouseDocumentLabel } from "../document-label";

const kinds: Record<WarehouseDocumentKind, string> = {
  adjustment: "Rettifica inventariale",
  count: "Inventario fisico",
  credit_note: "Nota di credito",
  equipment_purchase: "Acquisto attrezzatura",
  expense: "Spesa operativa",
  internal_use: "Consumo interno",
  opening: "Giacenza iniziale",
  purchase: "Carico merce",
  supplier_invoice: "Fattura fornitore",
  supplier_return: "Reso a fornitore",
  waste: "Scarto",
};

const statuses = {
  cancelled: "Annullato",
  draft: "Bozza",
  posted: "Registrato",
  reversed: "Stornato",
} as const;

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export function WarehouseDocumentViewer({ document, onClose, onEdit, suppliers }: {
  document?: WarehouseDocumentDetails;
  onClose(): void;
  onEdit(document: WarehouseDocumentDetails): void;
  suppliers: WarehouseSupplier[];
}) {
  if (!document) return null;
  const supplier = suppliers.find((item) => item.id === document.supplierId);
  return (
    <Drawer
      footer={document.status === "draft" ? <Button onClick={() => onEdit(document)} variant="primary"><Pencil className="size-4" />Modifica bozza</Button> : undefined}
      onClose={onClose}
      open
      size="xl"
      title="Scheda documento"
    >
      <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <header className="relative overflow-hidden bg-[#2d1d27] px-6 py-7 text-white">
          <div className="absolute -right-10 -top-16 size-48 rounded-full border-[32px] border-white/5" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><ReceiptText className="size-6" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#f2a7cc]">{kinds[document.kind]}</p>
                <h2 className="mt-1 truncate text-2xl font-black tracking-tight">{warehouseDocumentLabel(document)}</h2>
                {document.externalReference && <p className="mt-1 text-xs text-white/60">Rif. interno {warehouseDocumentLabel({ ...document, externalReference: null })}</p>}
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider">{statuses[document.status]}</span>
          </div>
        </header>

        <div className="grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
          <Meta icon={CalendarDays} label="Data documento" value={date(document.documentDate)} />
          <Meta icon={CalendarDays} label="Competenza" value={date(document.competenceDate)} />
          <Meta icon={Truck} label="Fornitore" value={supplier?.name || "Nessun fornitore"} />
          <Meta icon={PackageCheck} label="Righe" value={`${document.lines.length} ${document.lines.length === 1 ? "voce" : "voci"}`} />
        </div>

        <div className="p-5 sm:p-6">
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.12em] text-[#792f59]">
                <tr><th className="px-4 py-3">Descrizione</th><th className="px-4 py-3 text-right">Quantità</th><th className="px-4 py-3 text-right">Costo unit.</th><th className="px-4 py-3 text-right">IVA</th><th className="px-4 py-3 text-right">Totale</th></tr>
              </thead>
              <tbody>{document.lines.map((line, index) => {
                const net = line.netCents ?? Math.max(0, line.quantity * line.unitCostCents - line.discountCents);
                const total = line.totalCents ?? net + Math.round(net * line.taxRateBasisPoints / 10_000);
                return <tr className="border-t border-stone-100" key={line.id ?? `${line.description}-${index}`}>
                  <td className="px-4 py-3"><strong className="block text-stone-950">{line.description}</strong><span className="text-xs text-stone-500">{line.destination || "Nessuna destinazione"}{line.stockDelta ? ` · Movimento ${line.stockDelta > 0 ? "+" : ""}${line.stockDelta}` : ""}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{line.quantity} {line.unit || "pz"}</td>
                  <td className="px-4 py-3 text-right">{euro(line.unitCostCents)}</td>
                  <td className="px-4 py-3 text-right">{(line.taxRateBasisPoints / 100).toLocaleString("it-IT")}%</td>
                  <td className="px-4 py-3 text-right font-black">{euro(total)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_280px]">
            <div>{document.notes && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-500"><FileText className="size-4" />Note</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{document.notes}</p></div>}</div>
            <dl className="rounded-xl bg-[#faf3f7] p-4 text-sm">
              <Total label="Imponibile" value={document.netTotalCents} />
              <Total label="IVA" value={document.taxTotalCents} />
              <div className="mt-3 flex items-end justify-between border-t border-[#dfbfd0] pt-3"><dt className="font-black">Totale documento</dt><dd className="text-xl font-black text-[#792f59]">{euro(document.totalCents)}</dd></div>
            </dl>
          </div>
        </div>
      </article>
    </Drawer>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-3 bg-white px-4 py-4"><Icon className="mt-0.5 size-4 shrink-0 text-[#8f3a68]" /><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-1 truncate text-sm font-bold text-stone-800">{value}</p></div></div>;
}

function Total({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between gap-4 py-1.5"><dt className="text-stone-500">{label}</dt><dd className="font-bold">{euro(value)}</dd></div>;
}
