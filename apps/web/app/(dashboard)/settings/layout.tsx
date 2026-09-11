"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect } from "react";
import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarOff,
  DoorOpen,
  FileSignature,
  History,
  Mail,
  MapPinned,
  MapPin,
  MessageCircle,
  Palette,
  SlidersHorizontal,
  Smartphone,
  Users,
} from "lucide-react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

type SettingsLink = {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

const baseGroups: Array<{ icon: ComponentType<{ className?: string }>; label: string; links: SettingsLink[] }> = [
  {
    icon: Building2,
    label: "Salone",
    links: [
      { description: "Identita, lingua, fuso e orari ordinari.", href: "/settings/salon", icon: Building2, label: "Dati salone" },
      { description: "Indirizzo e coordinate usate dall'App Clienti.", href: "/settings/address", icon: MapPin, label: "Indirizzo" },
      { description: "Sedi operative, cabine e risorse collegate.", href: "/settings/locations", icon: MapPinned, label: "Sedi" },
      { description: "Inviti, ruoli e stato account.", href: "/settings/users", icon: Users, label: "Utenti" },
    ],
  },
  {
    icon: CalendarClock,
    label: "Agenda",
    links: [
      { description: "Slot, buffer, overbooking e viste.", href: "/settings/agenda", icon: CalendarClock, label: "Regole agenda" },
      { description: "Festivita, ferie e blocchi prenotazione.", href: "/settings/closures", icon: CalendarOff, label: "Chiusure" },
      { description: "Giornate eccezionali fuori dagli orari standard.", href: "/settings/special-openings", icon: DoorOpen, label: "Aperture speciali" },
    ],
  },
  {
    icon: Palette,
    label: "Esperienza cliente",
    links: [
      { description: "Prenotazioni online e autonomia cliente.", href: "/settings/pwa", icon: Smartphone, label: "App Clienti" },
      { description: "Palette gestionale e avatar DiceBear.", href: "/settings/personalization", icon: Palette, label: "Personalizzazione" },
      { description: "Mittente, risposta e footer email.", href: "/settings/email", icon: Mail, label: "Email" },
      { description: "Provider WhatsApp Business Cloud API.", href: "/settings/communications", icon: MessageCircle, label: "WhatsApp" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reminders = useModuleEnabled(MODULE_KEYS.REMINDERS);
  const documents = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const audit = useModuleEnabled(MODULE_KEYS.AUDIT_COMPLIANCE);
  const legacyDestination = pathname.startsWith("/settings/services")
    ? pathname === "/settings/services" ? "/services/manage" : pathname.replace("/settings/services", "/services")
    : pathname.startsWith("/settings/staff")
      ? pathname === "/settings/staff" ? "/staff/manage" : pathname.replace("/settings/staff", "/staff")
      : pathname.startsWith("/settings/packages")
        ? pathname.replace("/settings/packages", "/packages")
        : pathname.startsWith("/settings/loyalty")
          ? pathname.replace("/settings/loyalty", "/loyalty")
          : pathname.startsWith("/settings/permissions")
            ? pathname.replace("/settings/permissions", "/staff/permissions")
            : undefined;

  useEffect(() => {
    if (legacyDestination) router.replace(legacyDestination);
  }, [legacyDestination, router]);

  if (legacyDestination) return null;

  const systemLinks: SettingsLink[] = [
    ...(reminders ? [{ description: "Regole e storico promemoria automatici.", href: "/settings/reminders", icon: BellRing, label: "Promemoria" }] : []),
    ...(documents ? [{ description: "Template, firme e archivio consensi.", href: "/settings/documents", icon: FileSignature, label: "Documenti" }] : []),
    ...(audit ? [{ description: "Registro attivita e controlli avanzati.", href: "/settings/audit", icon: History, label: "Attivita" }] : []),
  ];
  const groups = systemLinks.length ? [...baseGroups, { icon: SlidersHorizontal, label: "Sistema", links: systemLinks }] : baseGroups;

  return (
    <div className="settings-shell w-full lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="border-b border-stone-200 bg-[#f7f4f5] px-4 py-3 lg:hidden">
        <p className="mb-2 text-xs font-semibold text-stone-500">Impostazioni salone</p>
        <nav aria-label="Navigazione impostazioni" className="no-scrollbar -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {groups.flatMap((group) => group.links).map((item) => {
            const active = isActive(pathname, item.href) || (pathname === "/settings" && item.href === "/settings/salon");
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--esse-berry,#b85888)]/20 ${active ? "bg-[var(--esse-petal,#f2e1eb)] font-semibold text-[var(--esse-mulberry,#543147)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--esse-mulberry)_12%,transparent)]" : "text-stone-600 hover:bg-black/[.035] hover:text-stone-900"}`}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="sticky top-[var(--app-topbar-height)] hidden h-[calc(100dvh-var(--app-topbar-height))] overflow-y-auto border-r border-stone-200 bg-[#f5f1f3] px-3 py-4 lg:block">
        <div className="border-b border-stone-200 px-2 pb-4 pt-1">
          <h2 className="text-base font-semibold text-[var(--esse-ink,#25161f)]">Impostazioni</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">Salone, agenda e sistema</p>
        </div>
        <nav aria-label="Navigazione impostazioni" className="mt-4 space-y-3">
          {groups.map((group) => {
            const open = group.links.some((item) => isActive(pathname, item.href)) || (pathname === "/settings" && group.label === "Salone");
            const GroupIcon = group.icon;
            return (
              <details className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm" key={group.label} open={open}>
                <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--esse-berry,#b85888)]/20 [&::-webkit-details-marker]:hidden ${open ? "bg-[var(--esse-petal,#f2e1eb)] text-[var(--esse-mulberry,#543147)]" : "text-stone-700 hover:bg-stone-50"}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-md border ${open ? "border-[var(--esse-berry,#b85888)] bg-white text-[var(--esse-mulberry,#543147)]" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                    <GroupIcon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-black">{group.label}</span>
                  <span aria-hidden="true" className="text-base transition-transform group-open:rotate-90">›</span>
                </summary>
                <div aria-label="Categorie impostazioni" className="space-y-1 border-t border-stone-100 bg-[#fbfaf9] p-1.5">
                  {group.links.map((item) => {
                    const active = isActive(pathname, item.href) || (pathname === "/settings" && item.href === "/settings/salon");
                    const Icon = item.icon;
                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[58px] items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--esse-berry,#b85888)]/20 ${active ? "bg-[var(--esse-petal,#f2e1eb)] font-semibold text-[var(--esse-mulberry,#543147)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--esse-mulberry)_12%,transparent)]" : "text-stone-600 hover:bg-white/80 hover:text-stone-900"}`}
                        href={item.href}
                        key={item.href}
                      >
                        <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${active ? "text-[var(--esse-mulberry,#543147)]" : "text-stone-400"}`} />
                        <span className="min-w-0">
                          <span className="block truncate">{item.label}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-4 text-stone-500">{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 px-3 py-4 sm:px-4 lg:px-5 [&>.esse-workspace-page]:min-h-0 [&>.esse-workspace-page]:px-0 [&>.esse-workspace-page]:py-0 [&>.esse-workspace-page>div]:max-w-none">
        {children}
      </div>
    </div>
  );
}
