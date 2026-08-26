"use client";

import { ClipboardList, Plus, Save, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, SectionCard } from "@esse-beauty/ui";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseCount, WarehouseCountLine, WarehouseProduct } from "../warehouse-types";

export function parseWarehousePaste(text: string) {
  return text.split(/\r?\n/).flatMap((raw) => {
    const [reference = "", quantity = "", note = ""] = raw.split("\t").map((value) => value.trim());
    if (!reference && !quantity && !note) return [];
    const countedQuantity = Number(quantity);
    return [{ barcode: /^\d+$/.test(reference) ? reference : "", counted_quantity: Number.isInteger(countedQuantity) && countedQuantity >= 0 ? countedQuantity : null, note, sku: /^\d+$/.test(reference) ? "" : reference }];
  });
}

function statusLabel(status: WarehouseCount["status"]) { return status === "posted" ? "Registrato" : status === "counting" ? "In corso" : status; }

export function WarehouseCounts({ counts, onRefresh, products, salonId }: { counts: WarehouseCount[]; onRefresh(): Promise<void>; products: WarehouseProduct[]; salonId?: string }) {
  const [active, setActive] = useState<WarehouseCount>();
  const [lines, setLines] = useState<WarehouseCountLine[]>([]);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const open = async (count: WarehouseCount) => {
    if (!salonId) return;
    try { const detail = await warehouseApi.getCount(salonId, count.id); setActive(detail); setLines(detail.lines ?? []); setError(""); setTimeout(() => barcodeRef.current?.focus(), 0); }
    catch { setError("Inventario non disponibile."); }
  };
  useEffect(() => { if (!active && counts[0] && salonId) void open(counts[0]); }, [counts, salonId]);

  const create = async () => {
    if (!salonId) return;
    setSaving(true); try { const count = await warehouseApi.createCount(salonId); await onRefresh(); await open(count); } catch { setError("Impossibile aprire l'inventario."); } finally { setSaving(false); }
  };
  const save = async (post: boolean) => {
    if (!salonId || !active) return;
    setSaving(true); try {
      await warehouseApi.saveCount(salonId, active.id, { lines: lines.map((line) => ({ product_id: line.productId, counted_quantity: line.countedQuantity, note: line.note })) });
      if (post) await warehouseApi.postCount(salonId, active.id);
      await onRefresh();
      await open({ ...active, status: post ? "posted" : active.status });
    } catch { setError(post ? "Inventario non registrato. Controlla le quantità." : "Inventario non salvato."); } finally { setSaving(false); }
  };
  const previewPaste = async () => {
    if (!salonId || !active) return;
    const rows = parseWarehousePaste(paste);
    if (rows.some((row) => row.counted_quantity === null)) { setError("Le quantità incollate devono essere numeri interi non negativi."); return; }
    try {
      const preview = await warehouseApi.previewImport(salonId, { mapping: { barcode: "barcode", quantity: "counted_quantity", sku: "sku" }, rows });
      const updates = new Map(preview.rows.filter((row) => row.product_id).map((row) => [row.product_id!, { countedQuantity: row.quantity, note: rows[Number(row.key.replace("preview-", "")) - 1]?.note ?? null }]));
      setLines((current) => current.map((line) => updates.has(line.productId) ? { ...line, ...updates.get(line.productId)! } : line));
      setError(preview.errors.map((item) => `Riga ${item.line}: ${item.message}`).join(" "));
      setPaste("");
    } catch { setError("Anteprima importazione non disponibile."); }
  };
  const update = (productId: string, changes: Partial<WarehouseCountLine>) => setLines((current) => current.map((line) => line.productId === productId ? { ...line, ...changes } : line));

  return <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]"><SectionCard actions={<Button disabled={saving} onClick={() => void create()} size="sm" variant="primary"><Plus className="size-4" />Nuovo</Button>} title="Inventari" subtitle="Conteggi aperti e registrati."><div className="space-y-2">{counts.map((count) => <button className={`w-full rounded-lg border p-3 text-left text-sm ${active?.id === count.id ? "border-[#8f3a68] bg-[#fff7fb]" : "border-stone-200"}`} key={count.id} onClick={() => void open(count)} type="button"><span className="block font-bold text-[#402334]">{statusLabel(count.status)}</span><span className="text-xs text-stone-500">{new Date(count.openedAt).toLocaleDateString("it-IT")}</span></button>)}{!counts.length && <EmptyState description="Apri un conteggio per congelare le quantità teoriche." title="Nessun inventario" />}</div></SectionCard>
    <SectionCard actions={active && active.status !== "posted" ? <div className="flex gap-2"><Button disabled={saving} onClick={() => void save(false)} size="sm" variant="outline"><Save className="size-4" />Salva</Button><Button disabled={saving} onClick={() => void save(true)} size="sm" variant="primary"><Send className="size-4" />Registra</Button></div> : undefined} title="Conteggio fisico" subtitle="Le quantità teoriche sono congelate all'apertura. Il salvataggio non cambia le scorte.">{active ? <><div className="mb-3 flex flex-wrap gap-2"><input aria-label="Barcode" autoComplete="off" className="min-h-10 rounded-lg border border-stone-200 px-3 text-sm" placeholder="Scansiona barcode" ref={barcodeRef} /><details className="rounded-lg border border-stone-200 px-3 py-2"><summary className="cursor-pointer text-sm font-bold text-[#792f59]">Incolla conteggi</summary><textarea className="mt-2 min-h-20 w-full min-w-[300px] rounded border border-stone-200 p-2 text-xs" onChange={(event) => setPaste(event.target.value)} placeholder="SKU/barcode\tquantità\tnota" value={paste} /><Button className="mt-2" onClick={() => void previewPaste()} size="sm" variant="tableAction">Anteprima sicura</Button></details></div><div className="overflow-x-auto rounded-xl border border-stone-200"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.1em] text-[#792f59]"><tr><th className="px-3 py-2">Articolo</th><th className="px-3 py-2">Quantità teorica</th><th className="px-3 py-2">Quantità contata</th><th className="px-3 py-2">Differenza</th><th className="px-3 py-2">Nota</th><th className="px-3 py-2">Stato</th></tr></thead><tbody>{lines.map((line) => { const product = productsById.get(line.productId); const difference = line.countedQuantity === null ? null : line.countedQuantity - line.theoreticalQuantity; return <tr className="border-t border-stone-100" key={line.id}><td className="px-3 py-2"><strong>{product?.name ?? line.productId}</strong><span className="ml-2 text-xs text-stone-500">{product?.sku}</span></td><td className="px-3 py-2">{line.theoreticalQuantity}</td><td className="px-3 py-2"><input className="w-24 rounded border border-stone-200 px-2 py-1" disabled={active.status === "posted"} min="0" onChange={(event) => update(line.productId, { countedQuantity: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={line.countedQuantity ?? ""} /></td><td className="px-3 py-2 font-bold">{difference ?? "—"}</td><td className="px-3 py-2"><input className="w-full rounded border border-stone-200 px-2 py-1" disabled={active.status === "posted"} onChange={(event) => update(line.productId, { note: event.target.value || null })} value={line.note ?? ""} /></td><td className="px-3 py-2 text-xs">{difference === null ? "Da contare" : difference === 0 ? "Allineato" : "Da rettificare"}</td></tr>; })}</tbody></table></div></> : <EmptyState description="Apri un nuovo inventario per lavorare sulle quantità congelate." title="Seleziona un inventario" />}{error && <p aria-live="polite" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}</SectionCard></div>;
}
