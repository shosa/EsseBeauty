"use client";

import { MODULE_KEYS, type ModuleKey, useModules } from "@esse-beauty/feature-flags";
import { AppPage, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { ModuleIcon } from "../../_components/Icons";

const modules: Array<{ key: ModuleKey; name: string; description: string; destination: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Invia email o SMS automatici prima degli appuntamenti.", destination: "Impostazioni promemoria" },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccoglie feedback, pubblica recensioni e consente le risposte.", destination: "Area recensioni" },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Registra richieste quando un orario non è disponibile.", destination: "Gestione lista d'attesa" },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Assegna punti per appuntamento e configura premi.", destination: "Programma fedeltà" },
  { key: MODULE_KEYS.MARKETING, name: "Marketing", description: "Crea campagne email e SMS per segmenti di clienti.", destination: "Campagne" },
  { key: MODULE_KEYS.INVENTORY, name: "Inventario", description: "Monitora prodotti, movimenti e soglie di riordino.", destination: "Magazzino" },
  { key: MODULE_KEYS.STAFF_PERF, name: "Performance staff", description: "Mostra report su appuntamenti, servizi e risultati del team.", destination: "Report" },
];

export default function ModulesPage() {
  const { modules: state } = useModules();
  const activeCount = Object.values(state).filter(Boolean).length;

  return (
    <AppPage maxWidth="max-w-5xl">
      <PageHeader
        eyebrow="Licenza"
        title="Moduli concessi"
        subtitle="I moduli sono gestiti dalla piattaforma centrale. Qui il salone vede cosa è incluso nella licenza attiva, senza poter modificare la propria abilitazione."
        status={<StatusBadge status={activeCount > 0 ? "active" : "inactive"}>{activeCount} moduli attivi</StatusBadge>}
      />
      <StatGrid className="mb-6 md:grid-cols-3">
        <StatCard label="Moduli attivi" value={activeCount} detail="Concessi dalla piattaforma" />
        <StatCard label="Moduli disponibili" value={modules.length} detail="Catalogo EsseBeauty" />
        <StatCard label="Gestione" value="Platform" detail="Attivazioni centralizzate" />
      </StatGrid>
      <p className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
        I moduli sono gestiti dalla piattaforma quando viene venduta o aggiornata una licenza. Se un modulo non compare nella navigazione, non fa parte della licenza attuale.
      </p>
      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((item) => {
          const enabled = state[item.key] ?? false;
          return (
            <SectionCard key={item.key} className={`min-h-56 transition ${enabled ? "border-[#d7a6c1]" : "opacity-90"}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <span className={`grid size-11 place-items-center rounded-xl ${enabled ? "bg-[#f3e2eb] text-[#792f59]" : "bg-stone-100 text-stone-400"}`}><ModuleIcon /></span>
                  <StatusBadge status={enabled ? "active" : "inactive"}>{enabled ? "Attivo" : "Disattivato"}</StatusBadge>
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
