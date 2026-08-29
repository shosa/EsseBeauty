"use client";

import { ReceiptText, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, Button, EmptyState, ExpandableAction, InlineError, PageHeader, SectionCard, StatCard, StatGrid } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
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

  const reverse = async (expense: WarehouseExpense) => {
    if (!salonId || !window.confirm(`Stornare ${expense.description}?`)) return;
    await warehouseApi.reverseExpense(salonId, expense.id);
    await load();
  };

  return (
    <AppPage maxWidth="max-w-[1400px]">
      <PageHeader
        actions={<><ExpandableAction icon={ReceiptText} label="Registra spesa" onClick={() => setOpen(true)} tone="orange" /><Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button></>}
        eyebrow="Magazzino"
        subtitle="Spese operative, uscite di cassa e riferimenti documentali collegati."
        title="Spese"
      />
      {error && <InlineError className="mb-4">{error}</InlineError>}
      <StatGrid className="mb-4"><StatCard detail="Periodo corrente" label="Totale spese" value={euro(total)} /></StatGrid>
      <SectionCard title="Registro spese" subtitle="Uscite operative collegate a documento e movimento di cassa.">
        {loading ? <div className="px-4 py-8 text-center text-sm text-stone-500">Caricamento spese...</div> : items.length === 0 ? <EmptyState description="Registra una spesa per vedere qui categoria, pagamento e documento sorgente." title="Nessuna spesa registrata" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.11em] text-[#792f59]"><tr><th className="px-3 py-2">Descrizione</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Fornitore</th><th className="px-3 py-2">Documento</th><th className="px-3 py-2 text-right">Totale</th><th className="px-3 py-2" /></tr></thead><tbody>{items.map((expense) => <tr className="border-t border-stone-100" key={expense.id}><td className="px-3 py-2 font-bold">{expense.description}</td><td className="px-3 py-2">{expense.category}</td><td className="px-3 py-2 text-stone-600">{expense.supplier_name ?? "-"}</td><td className="px-3 py-2 text-stone-600">{expense.source_document_number ?? "-"}</td><td className="px-3 py-2 text-right font-bold">{euro(expense.totalCents)}</td><td className="px-3 py-2 text-right"><Button aria-label={`Storna ${expense.description}`} onClick={() => void reverse(expense)} size="sm" variant="icon"><RotateCcw className="size-4" /></Button></td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
      <ExpenseDialog onClose={() => setOpen(false)} onSave={save} open={open} suppliers={suppliers} />
    </AppPage>
  );
}
