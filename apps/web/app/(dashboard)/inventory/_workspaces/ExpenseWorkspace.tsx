"use client";

import { Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage, Button, ConfirmDialog, EmptyState, InlineError, PageHeader } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../_components/EnterpriseCard";
import { ExpenseDialog } from "../_components/ExpenseDialog";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseExpense, WarehouseSupplier } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });

export function ExpenseWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [items, setItems] = useState<WarehouseExpense[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReverse, setConfirmReverse] = useState<WarehouseExpense>();
  const [reversing, setReversing] = useState(false);

  const load = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError("");
    try {
      const [expenses, supplierRows] = await Promise.all([
        warehouseApi.getExpenses(salonId),
        warehouseApi.getSuppliers(salonId, { active: true }),
      ]);
      setItems(expenses.items);
      setTotal(expenses.total_cents);
      setSuppliers(supplierRows);
    } catch {
      setError("Spese non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (input: unknown) => {
    if (!salonId) return;
    await warehouseApi.registerExpense(salonId, input);
    setOpen(false);
    await load();
  };

  const reverse = async () => {
    if (!salonId || !confirmReverse) return;
    setReversing(true);
    try {
      await warehouseApi.reverseExpense(salonId, confirmReverse.id);
      setConfirmReverse(undefined);
      await load();
    } catch {
      setError("Spesa non stornata.");
    } finally {
      setReversing(false);
    }
  };

  const topCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) totals.set(item.category, (totals.get(item.category) ?? 0) + item.totalCents);
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0];
  }, [items]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        actionsAlign="right"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button aria-label="Aggiorna spese" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
            <Button onClick={() => setOpen(true)} variant="primary"><Plus className="size-4" />Registra spesa</Button>
          </div>
        }
        eyebrow="Magazzino"
        subtitle="Uscite operative non legate all'acquisto di merce rivendibile."
        title="Spese"
      />

      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3">
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Totale spese</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(total)}</strong><span className="text-[11px] font-medium text-stone-400">periodo corrente</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Movimenti</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{items.length}</strong><span className="text-[11px] font-medium text-stone-400">registrati</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Categoria principale</span><strong className="mt-1 block truncate text-xl font-bold text-stone-950">{topCategory?.[0] ?? "—"}</strong><span className="text-[11px] font-medium text-stone-400">{topCategory ? `${euro(topCategory[1])}` : "nessuna spesa"}</span></div>
      </div>

      <Card bodyClassName="p-0" className="mt-4" title="Registro spese" subtitle="Uscite operative collegate a documento e movimento di cassa.">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-stone-500">Caricamento spese…</div>
        ) : items.length === 0 ? (
          <div className="p-4"><EmptyState description="Registra una spesa per vedere qui categoria, pagamento e documento sorgente." title="Nessuna spesa registrata" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                <tr><th className="px-5 py-3">Descrizione</th><th>Categoria</th><th>Fornitore</th><th>Documento</th><th className="text-right">Totale</th><th className="w-12 pr-5" /></tr>
              </thead>
              <tbody>
                {items.map((expense) => (
                  <tr className="border-t border-stone-100 transition hover:bg-[#fffafd]" key={expense.id}>
                    <td className="px-5 py-3.5 font-bold text-stone-900">{expense.description}</td>
                    <td><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{expense.category}</span></td>
                    <td className="text-stone-600">{expense.supplier_name ?? "—"}</td>
                    <td className="text-stone-500">{expense.source_document_number ?? "—"}</td>
                    <td className="text-right font-black tnum text-[#402334]">{euro(expense.totalCents)}</td>
                    <td className="pr-5 text-right">
                      <button aria-label={`Storna ${expense.description}`} className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmReverse(expense)} title="Storna spesa" type="button"><RotateCcw className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {error && <InlineError className="mt-4">{error}</InlineError>}
      <ExpenseDialog onClose={() => setOpen(false)} onSave={save} open={open} suppliers={suppliers} />
      <ConfirmDialog
        confirmLabel={reversing ? "Storno in corso…" : "Storna"}
        destructive
        description="Verrà generato il movimento di cassa compensativo. L'operazione non è reversibile."
        onCancel={() => setConfirmReverse(undefined)}
        onConfirm={() => void reverse()}
        open={Boolean(confirmReverse)}
        title={`Stornare ${confirmReverse?.description ?? "questa spesa"}?`}
      />
    </AppPage>
  );
}
