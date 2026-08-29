"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage, Button, EmptyState, ExpandableAction, InlineError, PageHeader, SectionCard } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
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
      const active = activeFilter === "all" ? undefined : activeFilter === "active";
      const suppliers = await warehouseApi.getSuppliers(salonId, { active, q: query.trim() || undefined });
      setItems(suppliers);
    } catch {
      setError("Fornitori non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, query, salonId]);

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

  return (
    <AppPage maxWidth="max-w-[1400px]">
      <PageHeader
        actions={<ExpandableAction icon={Plus} label="Nuovo fornitore" onClick={openCreate} tone="emerald" />}
        eyebrow="Magazzino"
        subtitle="Anagrafica, contatti e condizioni dei fornitori collegati a documenti e riordini."
        title="Fornitori"
      />
      <SectionCard
        actions={<Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button>}
        subtitle="Cerca per nome, referente, contatto o dati fiscali."
        title="Registro fornitori"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              aria-label="Cerca fornitori"
              className="min-h-11 w-full rounded-xl border border-stone-200 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca fornitore"
              value={query}
            />
          </label>
          <div className="inline-flex min-h-11 rounded-xl border border-stone-200 bg-stone-50 p-1">
            {[
              ["active", "Attivi"],
              ["archived", "Archiviati"],
              ["all", "Tutti"],
            ].map(([value, label]) => (
              <button
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${activeFilter === value ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
                key={value}
                onClick={() => setActiveFilter(value as SupplierFilter)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <InlineError>{error}</InlineError>
        ) : loading ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">Caricamento fornitori...</div>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            description="Crea il primo fornitore o modifica i filtri per consultare quelli archiviati."
            title="Nessun fornitore trovato"
          />
        ) : (
          <WarehouseSuppliers suppliers={visibleItems} onCreate={openCreate} onEdit={openEdit} />
        )}
      </SectionCard>
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
