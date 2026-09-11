"use client";

import Link from "next/link";
import { Building2, MapPinned, Palette } from "lucide-react";

import { AppPage, PageHeader, SectionCard } from "@esse-beauty/ui";

const shortcuts = [
  { description: "Identita, lingua, fuso orario e orari ordinari.", href: "/settings/salon", icon: Building2, label: "Dati salone" },
  { description: "Sedi operative, cabine e risorse collegate.", href: "/settings/locations", icon: MapPinned, label: "Sedi" },
  { description: "Palette principale e avatar DiceBear.", href: "/settings/personalization", icon: Palette, label: "Personalizzazione" },
] as const;

export default function SettingsIndexPage() {
  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        eyebrow="Sistema"
        subtitle="Scegli una voce dalla sidebar impostazioni: la navigazione aggiorna solo questo pannello di lavoro."
        title="Impostazioni"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {shortcuts.map((item) => (
          <SectionCard icon={item.icon} key={item.href} title={item.label} subtitle={item.description}>
            <Link className="inline-flex min-h-10 items-center rounded-lg text-sm font-bold text-[var(--esse-mulberry,#543147)] hover:underline" href={item.href}>
              Apri
            </Link>
          </SectionCard>
        ))}
      </div>
    </AppPage>
  );
}
