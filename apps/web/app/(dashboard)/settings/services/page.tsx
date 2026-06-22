"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatPrice } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, EmptyState, FormField, InlineError, PageHeader, PageTransition, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { SERVICE_CATEGORY_ICONS, ServiceCategoryIcon } from "../../services/ServiceCategoryIcon";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Category {
  active: boolean;
  activeServiceCount: number;
  icon: string;
  id: string;
  name: string;
  serviceCount: number;
}

interface Service {
  active: boolean;
  category: string;
  categoryId?: string | null;
  description?: string;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}

interface CategoryDraft {
  icon: string;
  id?: string;
  name: string;
}

export default function SettingsServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Service[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Service>();
  const { salon } = useAuth();

  async function load(preferredCategoryId?: string) {
    if (!salon) return;
    setError("");
    const [categoryResponse, serviceResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-categories`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" }),
    ]);
    if (!categoryResponse.ok || !serviceResponse.ok) {
      setError("Impossibile caricare il catalogo servizi.");
      return;
    }
    const nextCategories = await categoryResponse.json() as Category[];
    setCategories(nextCategories);
    setItems(await serviceResponse.json() as Service[]);
    setSelectedCategoryId((current) => {
      const target = preferredCategoryId || current;
      return nextCategories.some((category) => category.id === target)
        ? target
        : nextCategories[0]?.id ?? "";
    });
  }

  useEffect(() => { void load(); }, [salon?.id]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const visibleServices = useMemo(
    () => items.filter((item) => item.categoryId === selectedCategoryId),
    [items, selectedCategoryId],
  );

  async function saveCategory() {
    if (!salon || !categoryDraft?.name.trim()) return;
    const response = await fetch(
      categoryDraft.id
        ? `${api}/api/salons/${salon.id}/service-categories/${categoryDraft.id}`
        : `${api}/api/salons/${salon.id}/service-categories`,
      {
        body: JSON.stringify({ icon: categoryDraft.icon, name: categoryDraft.name.trim() }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: categoryDraft.id ? "PATCH" : "POST",
      },
    );
    if (!response.ok) {
      setError("Categoria non salvata. Controlla che il nome non sia già utilizzato.");
      return;
    }
    const saved = await response.json() as Category;
    setCategoryDraft(undefined);
    setMessage(categoryDraft.id ? "Categoria aggiornata." : "Categoria creata.");
    await load(saved.id);
  }

  async function toggleCategory(category: Category) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/service-categories/${category.id}`, {
      body: JSON.stringify({ active: !category.active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) setError("Lo stato della categoria non è stato aggiornato.");
    await load(category.id);
  }

  async function toggle(item: Service) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${item.id}`, {
      body: JSON.stringify({ active: !item.active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) setError("Lo stato del servizio non è stato aggiornato.");
    await load(selectedCategoryId);
  }

  async function archive() {
    if (!salon || !confirmDelete) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${confirmDelete.id}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) setError("Servizio non archiviato.");
    setConfirmDelete(undefined);
    await load(selectedCategoryId);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          actions={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCategoryDraft({ icon: "sparkles", name: "" })} variant="secondary">Nuova categoria</Button>
              <Link href={selectedCategoryId ? `/settings/services/new?category=${selectedCategoryId}` : "/settings/services/new"} className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white">Nuovo servizio</Link>
            </div>
          }
          eyebrow="Core"
          title="Catalogo servizi"
          subtitle="Organizza il catalogo per categorie, assegna un’icona e configura i servizi collegati."
          status={<StatusBadge status="active">{categories.length} categorie · {items.length} servizi</StatusBadge>}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        {message && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}

        {categories.length === 0 ? (
          <EmptyState
            action={<Button onClick={() => setCategoryDraft({ icon: "sparkles", name: "" })}>Crea categoria</Button>}
            description="Prima crea una categoria, poi inserisci i servizi che le appartengono."
            title="Il catalogo parte dalle categorie"
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between px-2 pb-3">
                <div>
                  <h2 className="font-bold text-stone-950">Categorie</h2>
                  <p className="text-xs text-stone-500">Seleziona per vedere i servizi.</p>
                </div>
                <button className="grid size-9 place-items-center rounded-lg border border-stone-200 text-xl text-[#792f59]" onClick={() => setCategoryDraft({ icon: "sparkles", name: "" })} title="Nuova categoria" type="button">+</button>
              </div>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${selectedCategoryId === category.id ? "border-[#c987a9] bg-[#faf3f7]" : "border-transparent hover:bg-stone-50"} ${category.active ? "" : "opacity-55"}`}
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    type="button"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#792f59] shadow-sm ring-1 ring-stone-200">
                      <ServiceCategoryIcon className="size-5" name={category.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-stone-950">{category.name}</strong>
                      <small className="text-stone-500">{category.serviceCount} servizi</small>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-w-0">
              {selectedCategory && (
                <>
                  <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="grid size-12 place-items-center rounded-xl bg-[#faf3f7] text-[#792f59]">
                        <ServiceCategoryIcon className="size-6" name={selectedCategory.icon} />
                      </span>
                      <div>
                        <h2 className="text-xl font-bold text-stone-950">{selectedCategory.name}</h2>
                        <p className="text-sm text-stone-500">{selectedCategory.activeServiceCount} attivi su {selectedCategory.serviceCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700" onClick={() => setCategoryDraft({ icon: selectedCategory.icon, id: selectedCategory.id, name: selectedCategory.name })} type="button">Modifica categoria</button>
                      <Switch checked={selectedCategory.active} onCheckedChange={() => void toggleCategory(selectedCategory)} />
                    </div>
                  </header>

                  {visibleServices.length === 0 ? (
                    <EmptyState
                      action={<Link href={`/settings/services/new?category=${selectedCategory.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white">Aggiungi servizio</Link>}
                      description={`Non ci sono ancora servizi nella categoria ${selectedCategory.name}.`}
                      title="Categoria vuota"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                      {visibleServices.map((item) => (
                        <article className={`grid gap-4 border-b border-stone-100 p-4 last:border-0 md:grid-cols-[minmax(0,1fr)_120px_120px_auto] md:items-center ${item.active ? "" : "opacity-55"}`} key={item.id}>
                          <div className="min-w-0">
                            <Link href={`/settings/services/${item.id}`} className="font-bold text-stone-950 hover:text-[#792f59]">{item.name}</Link>
                            {item.description && <p className="mt-1 truncate text-sm text-stone-500">{item.description}</p>}
                          </div>
                          <span className="text-sm font-semibold text-stone-600">{item.durationMinutes} min</span>
                          <strong className="text-sm">{formatPrice(item.priceCents, "it-IT")}</strong>
                          <div className="flex items-center justify-end gap-3">
                            <Switch checked={item.active} onCheckedChange={() => void toggle(item)} />
                            <Link href={`/settings/services/${item.id}`} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold">Apri</Link>
                            <button className="text-xs font-bold text-red-700" onClick={() => setConfirmDelete(item)} type="button">Archivia</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </PageTransition>

      {categoryDraft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/35 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9d4f78]">Catalogo</p>
                <h2 className="mt-1 text-2xl font-bold">{categoryDraft.id ? "Modifica categoria" : "Nuova categoria"}</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-full border border-stone-200 text-xl" onClick={() => setCategoryDraft(undefined)} type="button">×</button>
            </div>
            <FormField className="mt-5" label="Nome categoria" required>
              <input autoFocus className="w-full" onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} value={categoryDraft.name} />
            </FormField>
            <FormField className="mt-5" label="Icona">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {SERVICE_CATEGORY_ICONS.map((option) => (
                  <button
                    className={`grid min-h-20 place-items-center rounded-xl border p-2 text-center transition ${categoryDraft.icon === option.key ? "border-[#9d4f78] bg-[#faf3f7] text-[#792f59]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
                    key={option.key}
                    onClick={() => setCategoryDraft({ ...categoryDraft, icon: option.key })}
                    type="button"
                  >
                    <option.icon className="size-5" strokeWidth={1.8} />
                    <span className="mt-1 text-[11px] font-bold leading-tight">{option.label}</span>
                  </button>
                ))}
              </div>
            </FormField>
            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={() => setCategoryDraft(undefined)} variant="ghost">Annulla</Button>
              <Button disabled={!categoryDraft.name.trim()} onClick={() => void saveCategory()} variant="primary">Salva categoria</Button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirmDelete)} destructive title="Archiviare servizio?" description="Il servizio non sarà più disponibile tra quelli attivi." confirmLabel="Archivia" onCancel={() => setConfirmDelete(undefined)} onConfirm={() => void archive()} />
    </AppPage>
  );
}
