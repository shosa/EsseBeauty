import { Check, DoorOpen, MapPin, Plus, Power, Settings2, UsersRound } from "lucide-react";
import React from "react";

export interface CabinWorkspaceItem {
  active: boolean;
  capacity: number;
  id: string;
  locationId?: string | null;
  name: string;
  type: string;
}

export type CabinStatusFilter = "active" | "all" | "inactive";

export function filterCabins<T extends CabinWorkspaceItem>(
  cabins: T[],
  filters: { locationId: string; query: string; status: CabinStatusFilter },
) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("it-IT");
  return cabins
    .filter((item) => item.locationId === filters.locationId)
    .filter((item) => filters.status === "all" || item.active === (filters.status === "active"))
    .filter((item) => item.name.toLocaleLowerCase("it-IT").includes(normalizedQuery));
}

export function toggleServiceAssignment(current: string[], serviceId: string) {
  return current.includes(serviceId)
    ? current.filter((id) => id !== serviceId)
    : [...current, serviceId];
}

export function CabinSummary({ cabin, locationName, serviceCount }: { cabin: CabinWorkspaceItem; locationName: string; serviceCount: number }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${cabin.active ? "bg-[#e7f6ef] text-[#167451]" : "bg-stone-100 text-stone-400"}`}><DoorOpen className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm font-bold text-stone-900"><MapPin className="size-3.5 text-[#a85b83]" />{locationName}</p><span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold ${cabin.active ? "text-emerald-700" : "text-stone-500"}`}><span className={`size-1.5 rounded-full ${cabin.active ? "bg-emerald-500" : "bg-stone-400"}`} />{cabin.active ? "Operativa" : "Non attiva"}</span></div>
      <div className="flex divide-x divide-stone-200 rounded-xl bg-stone-50 px-2 py-2"><div className="px-3 text-center"><strong className="block text-base text-stone-950">{cabin.capacity}</strong><span className="text-[10px] font-bold text-stone-400">Capienza</span></div><div aria-label={`${serviceCount} ${serviceCount === 1 ? "servizio" : "servizi"}`} className="px-3 text-center"><strong className="block text-base text-stone-950">{serviceCount}</strong><span className="text-[10px] font-bold text-stone-400">{serviceCount === 1 ? "servizio" : "servizi"}</span></div></div>
    </section>
  );
}

export function CabinToolbarActions({ count, onCreate }: { count: number; onCreate(): void }) {
  return (
    <div className="flex items-center gap-2 border-t border-stone-100 pt-2 lg:border-l lg:border-t-0 lg:pl-2 lg:pt-0">
      <span className="whitespace-nowrap px-2 text-xs font-bold text-stone-500">{count} ambienti</span>
      <button aria-label="Nuova cabina" className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#792f59] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#682647]" onClick={onCreate} type="button"><Plus className="size-4" />Nuova cabina</button>
    </div>
  );
}

export function CabinList({
  assignmentCounts,
  cabins,
  locationName,
  onSelect,
  onToggleActive,
  selectedCabinId,
}: {
  assignmentCounts: Record<string, number>;
  cabins: CabinWorkspaceItem[];
  locationName: string;
  onSelect(cabinId: string): void;
  onToggleActive(cabin: CabinWorkspaceItem): void;
  selectedCabinId: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cabins.map((cabin) => {
          const serviceCount = assignmentCounts[cabin.id] ?? 0;
          const selected = selectedCabinId === cabin.id;
          return (
            <article
              className={`group relative flex min-h-[230px] flex-col overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgb(45_29_39_/_0.10)] ${selected ? "border-[#792f59] bg-[#fbf3f7] ring-2 ring-[#792f59]/10" : "border-stone-200 bg-white hover:border-[#d7b1c5]"}`}
              key={cabin.id}
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${cabin.active ? "bg-[#e7f6ef] text-[#167451]" : "bg-stone-100 text-stone-400"}`}><DoorOpen className="size-5" /></span>
                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold ${cabin.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}><span className={`mr-1.5 size-1.5 rounded-full ${cabin.active ? "bg-emerald-500" : "bg-stone-400"}`} />{cabin.active ? "Operativa" : "Non attiva"}</span>
              </div>
              <button aria-label={`Modifica ${cabin.name}`} className="mt-5 block w-full text-left" onClick={() => onSelect(cabin.id)} type="button">
                <strong className="block truncate text-lg text-stone-950">{cabin.name}</strong>
                <span className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-semibold text-stone-500"><MapPin className="size-3.5 text-[#a85b83]" />{locationName}</span>
              </button>
              <div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs font-bold text-stone-700"><UsersRound className="size-3.5 text-stone-400" />{cabin.capacity}</span><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${serviceCount > 0 ? "bg-cyan-50 text-cyan-800" : "bg-amber-50 text-amber-800"}`}>{serviceCount > 0 && <Check className="size-3" />}{serviceCount > 0 ? `${serviceCount} servizi` : "Da configurare"}</span></div>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-stone-100 pt-4">
                <button aria-label={`${cabin.active ? "Disattiva" : "Attiva"} ${cabin.name}`} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${cabin.active ? "border-stone-200 bg-white text-stone-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`} onClick={() => onToggleActive(cabin)} type="button"><Power className="size-4" />{cabin.active ? "Disattiva" : "Attiva"}</button>
                <button aria-label={`Configura ${cabin.name}`} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#792f59] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#682647]" onClick={() => onSelect(cabin.id)} type="button"><Settings2 className="size-4" />Configura</button>
              </div>
            </article>
          );
        })}
    </div>
  );
}
