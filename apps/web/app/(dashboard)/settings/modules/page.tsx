"use client";

import { MODULE_KEYS, type ModuleKey, useModules } from "@esse-beauty/feature-flags";
import { AppPage, PageHeader, SectionCard, StatusBadge } from "@esse-beauty/ui";

import type { ComponentType, SVGProps } from "react";

import {
  InventoryIcon,
  LoyaltyIcon,
  MarketingIcon,
  ModuleIcon,
  RemindersIcon,
  ReportsIcon,
  ReviewsIcon,
  ServicesIcon,
  WaitlistIcon,
} from "../../_components/Icons";

const features: Array<{ key: ModuleKey; name: string; description: string; destination: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Avvisi automatici prima degli appuntamenti.", destination: "Impostazioni promemoria" },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccolta feedback e risposte ai clienti.", destination: "Area recensioni" },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Richieste quando non ci sono orari disponibili.", destination: "Lista d'attesa" },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Punti e premi per i clienti abituali.", destination: "Programma fedeltà" },
  { key: MODULE_KEYS.MARKETING, name: "Comunicazioni", description: "Messaggi mirati a gruppi di clienti.", destination: "Campagne" },
  { key: MODULE_KEYS.INVENTORY, name: "Magazzino", description: "Prodotti, scorte e movimenti.", destination: "Magazzino" },
  { key: MODULE_KEYS.STAFF_PERF, name: "Risultati team", description: "Andamento del lavoro e dei servizi.", destination: "Report" },
  { key: MODULE_KEYS.DOCUMENTS, name: "Documenti e consensi", description: "Consensi informati e privacy collegati ai clienti.", destination: "Impostazioni documenti" },
  { key: MODULE_KEYS.PACKAGES, name: "Pacchetti servizi", description: "Sedute incluse, utilizzate e residue.", destination: "Pacchetti" },
  { key: MODULE_KEYS.MULTI_LOCATION, name: "Multi-sede", description: "Sedi, stanze, risorse e attrezzature.", destination: "Sedi e risorse" },
  { key: MODULE_KEYS.AUDIT_COMPLIANCE, name: "Registro attività", description: "Mostra chi inserisce, modifica, elimina e vende nel salone.", destination: "Attività" },
];

const moduleIcons: Record<ModuleKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  [MODULE_KEYS.INVENTORY]: InventoryIcon,
  [MODULE_KEYS.LOYALTY]: LoyaltyIcon,
  [MODULE_KEYS.MARKETING]: MarketingIcon,
  [MODULE_KEYS.REMINDERS]: RemindersIcon,
  [MODULE_KEYS.REVIEWS]: ReviewsIcon,
  [MODULE_KEYS.STAFF_PERF]: ReportsIcon,
  [MODULE_KEYS.WAITLIST]: WaitlistIcon,
  [MODULE_KEYS.DOCUMENTS]: ReviewsIcon,
  [MODULE_KEYS.PACKAGES]: ServicesIcon,
  [MODULE_KEYS.MULTI_LOCATION]: ModuleIcon,
  [MODULE_KEYS.AUDIT_COMPLIANCE]: ReportsIcon,
};

export default function ModulesPage() {
  const { modules: state } = useModules();
  const activeCount = Object.values(state).filter(Boolean).length;

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageHeader
        eyebrow="Piano del salone"
        title="Moduli inclusi"
        subtitle="Qui trovi i moduli disponibili per il tuo salone. I moduli non inclusi non compaiono nella navigazione."
        status={<StatusBadge status={activeCount > 0 ? "active" : "inactive"}>{activeCount} attivi</StatusBadge>}
      />
      <p className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
        Se ti serve un modulo non incluso, aggiorna il piano del salone. Non serve configurare altro da questa schermata.
      </p>
      <section className="grid gap-4 md:grid-cols-2">
        {features.map((item) => {
          const enabled = state[item.key] ?? false;
          const Icon = moduleIcons[item.key];
          return (
            <SectionCard key={item.key} className={`min-h-56 transition ${enabled ? "border-[#d7a6c1]" : "opacity-90"}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <span className={`grid size-11 place-items-center rounded-xl ${enabled ? "bg-[#f3e2eb] text-[#792f59]" : "bg-stone-100 text-stone-400"}`}><Icon /></span>
                  <StatusBadge status={enabled ? "active" : "inactive"}>{enabled ? "Inclusa" : "Non inclusa"}</StatusBadge>
                </div>
                <h2 className="mt-4 text-lg font-bold">{item.name}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-stone-500">{item.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{item.destination}</p>
              </div>
            </SectionCard>
          );
        })}
      </section>
    </AppPage>
  );
}
