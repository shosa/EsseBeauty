"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage, Button, InlineError, PageHeader } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../_components/EnterpriseCard";
import { SupplierFormDialog } from "../_components/SupplierFormDialog";
import { WarehouseSuppliers } from "../_components/WarehouseSuppliers";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseSupplier } from "../warehouse-types";

type SupplierFilter = "all" | "active" | "archived";

export function SupplierWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [items, setItems] = useState<WarehouseSupplier[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SupplierFilter>("active");
  const [editing, setEditing] = useState<WarehouseSupplier>();
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!salonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const suppliers = await warehouseApi.getSuppliers(salonId, { active: undefined });
      setItems(suppliers);
    } catch {
      setError("Fornitori non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it-IT");
    return items.filter((supplier) => {
      const matchesQuery = !normalizedQuery
        || [
          supplier.name,
          supplier.contactName,
          supplier.email,
          supplier.phone,
          supplier.vatNumber,
          supplier.taxCode,
          supplier.city,
        ].filter(Boolean).join(" ").toLocaleLowerCase("it-IT").includes(normalizedQuery);
      const matchesActive = activeFilter === "all"
        || (activeFilter === "active" ? supplier.active : !supplier.active);
      return matchesQuery && matchesActive;
    });
  }, [activeFilter, items, query]);

  const openCreate = () => {
    setEditing(undefined);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (supplier: WarehouseSupplier) => {
    setEditing(supplier);
    setFormError("");
    setFormOpen(true);
  };

  const saveSupplier = async (input: Partial<WarehouseSupplier> & { name: string }) => {
    if (!salonId) return;
    setSaving(true);
    setFormError("");
    try {
      if (editing) await warehouseApi.updateSupplier(salonId, editing.id, input);
      else await warehouseApi.createSupplier(salonId, input);
      setFormOpen(false);
      setEditing(undefined);
      await load();
    } catch {
      setFormError("Fornitore non salvato.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = items.filter((item) => item.active).length;
  const archivedCount = items.length - activeCount;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        actionsAlign="right"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button aria-label="Aggiorna fornitori" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
            <Button onClick={openCreate} variant="primary"><Plus className="size-4" />Nuovo fornitore</Button>
          </div>
        }
        eyebrow="Magazzino"
        subtitle="Anagrafica, contatti e condizioni commerciali dei fornitori collegati a documenti e riordini."
        title="Fornitori"
      />

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3">
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Fornitori attivi</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{activeCount}</strong><span className="text-[11px] font-medium text-stone-400">{archivedCount} archiviati</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Totale anagrafiche</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{items.length}</strong><span className="text-[11px] font-medium text-stone-400">registrate</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Risultati filtro</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{visibleItems.length}</strong><span className="text-[11px] font-medium text-stone-400">in elenco</span></div>
      </div>

      <Card bodyClassName="p-0" className="mt-4" subtitle="Cerca per nome, referente, contatto o dati fiscali." title="Registro fornitori">
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="relative min-w-[220px] flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input aria-label="Cerca fornitori" className="w-full pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca fornitore" value={query} />
          </label>
          <div className="inline-flex gap-0.5 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-1">
            {([["active", "Attivi"], ["archived", "Archiviati"], ["all", "Tutti"]] as const).map(([value, label]) => (
              <button className={`h-8 rounded-lg px-3.5 text-[12px] font-bold transition ${activeFilter === value ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-[#792f59]"}`} key={value} onClick={() => setActiveFilter(value)} type="button">{label}</button>
            ))}
          </div>
        </div>
        {error ? (
          <div className="p-4"><InlineError>{error}</InlineError></div>
        ) : loading ? (
          <div className="p-8 text-center text-sm font-semibold text-stone-500">Caricamento fornitori…</div>
        ) : (
          <WarehouseSuppliers suppliers={visibleItems} onEdit={openEdit} />
        )}
      </Card>
      <SupplierFormDialog
        error={formError}
        loading={saving}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSave={saveSupplier}
        open={formOpen}
        supplier={editing}
      />
    </AppPage>
  );
}
