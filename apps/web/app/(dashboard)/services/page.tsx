"use client";

import { useEffect, useMemo, useState } from "react";

import { formatPrice } from "@esse-beauty/shared";
import { AppPage, EmptyState, FormField, InlineError, PageHeader, PageTransition, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { ServiceCategoryIcon } from "./ServiceCategoryIcon";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Category {
  activeServiceCount: number;
  icon: string;
  id: string;
  name: string;
}

interface Service {
  categoryId?: string | null;
  description?: string;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Service[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const [categoryResponse, serviceResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-categories?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/services`, { credentials: "include" }),
    ]);
    if (!categoryResponse.ok || !serviceResponse.ok) {
      setError("Catalogo operativo non disponibile.");
      setLoading(false);
      return;
    }
    const nextCategories = await categoryResponse.json() as Category[];
    setCategories(nextCategories.filter((category) => category.activeServiceCount > 0));
    setItems(await serviceResponse.json() as Service[]);
    setSelectedCategoryId((current) =>
      nextCategories.some((category) => category.id === current)
        ? current
        : nextCategories.find((category) => category.activeServiceCount > 0)?.id ?? "",
    );
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const visibleServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) =>
      item.categoryId === selectedCategoryId
      && (!normalizedQuery || `${item.name} ${item.description ?? ""}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [items, query, selectedCategoryId]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Catalogo operativo"
          title="Servizi"
          subtitle="Scegli una categoria e consulta rapidamente trattamenti, durata e prezzo."
          status={<StatusBadge status="active">{items.length} servizi attivi</StatusBadge>}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-32 animate-pulse rounded-xl bg-white" key={item} />)}</div>
        ) : categories.length === 0 ? (
          <EmptyState description="Configura categorie e servizi nelle Impostazioni." title="Nessun servizio operativo" />
        ) : (
          <>
            <section className="mb-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-stone-500">Categorie</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories.map((category) => (
                  <button
                    className={`flex min-h-24 items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedCategoryId === category.id ? "border-[#9d4f78] bg-[#faf3f7]" : "border-stone-200 bg-white"}`}
                    key={category.id}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setQuery("");
                    }}
                    type="button"
                  >
                    <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${selectedCategoryId === category.id ? "bg-[#792f59] text-white" : "bg-stone-100 text-[#792f59]"}`}>
                      <ServiceCategoryIcon className="size-6" name={category.icon} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-base text-stone-950">{category.name}</strong>
                      <small className="text-stone-500">{category.activeServiceCount} servizi</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {selectedCategory && (
              <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-[#faf3f7] text-[#792f59]">
                      <ServiceCategoryIcon className="size-5" name={selectedCategory.icon} />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9d4f78]">Servizi</p>
                      <h2 className="text-xl font-bold">{selectedCategory.name}</h2>
                    </div>
                  </div>
                  <FormField label="Cerca nella categoria">
                    <input className="w-full min-w-64" onChange={(event) => setQuery(event.target.value)} value={query} />
                  </FormField>
                </header>

                {visibleServices.length === 0 ? (
                  <div className="p-5"><EmptyState description="Nessun servizio corrisponde alla ricerca." title="Nessun risultato" /></div>
                ) : (
                  <div className="grid gap-px bg-stone-100 md:grid-cols-2">
                    {visibleServices.map((item) => (
                      <article className="flex min-h-28 items-start justify-between gap-4 bg-white p-5" key={item.id}>
                        <div>
                          <h3 className="font-bold text-stone-950">{item.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-stone-500">{item.durationMinutes} min</p>
                          {item.description && <p className="mt-2 line-clamp-2 text-sm text-stone-600">{item.description}</p>}
                        </div>
                        <strong className="shrink-0 text-[#642744]">{formatPrice(item.priceCents, "it-IT")}</strong>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </PageTransition>
    </AppPage>
  );
}
