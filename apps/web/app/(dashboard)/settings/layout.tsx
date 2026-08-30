"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { BellRing, Building2, CalendarRange, FileSignature, History, MapPinned, MessageCircle, Smartphone, Users } from "lucide-react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

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
          : undefined;

  useEffect(() => {
    if (legacyDestination) router.replace(legacyDestination);
  }, [legacyDestination, router]);
  const groups = [
    {
      label: "Salone",
      links: [
        { href: "/settings", icon: Building2, label: "Salone" },
        { href: "/settings/agenda", icon: CalendarRange, label: "Agenda e chiusure" },
        { href: "/settings/users", icon: Users, label: "Utenti" },
        { href: "/settings/pwa", icon: Smartphone, label: "App Clienti" },
        { href: "/settings/locations", icon: MapPinned, label: "Sedi" },
      ],
    },
    {
      label: "Sistema",
      links: [
        { href: "/settings/communications", icon: MessageCircle, label: "WhatsApp" },
        ...(reminders ? [{ href: "/settings/reminders", icon: BellRing, label: "Promemoria" }] : []),
        ...(documents ? [{ href: "/settings/documents", icon: FileSignature, label: "Documenti" }] : []),
        ...(audit ? [{ href: "/settings/audit", icon: History, label: "Attività" }] : []),
      ],
    },
  ];

  if (legacyDestination) return null;

  return (
    <div className="settings-shell w-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="border-b border-[#ded6da] bg-[#f7f4f5] px-4 py-3 lg:hidden">
        <p className="mb-2 text-xs font-semibold text-stone-500">Impostazioni salone</p>
        <nav aria-label="Navigazione impostazioni" className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {groups.flatMap((group) => group.links).map((item) => {
            const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "bg-[#eadfe5] font-semibold text-[#4b263b] shadow-[inset_0_0_0_1px_rgb(121_47_89_/_0.08)]" : "text-stone-600 hover:bg-black/[.035] hover:text-stone-900"}`}
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

      <aside className="sticky top-[var(--app-topbar-height)] hidden h-[calc(100dvh-var(--app-topbar-height))] overflow-y-auto border-r border-[#ded6da] bg-[#f5f1f3] px-3 py-4 lg:block">
        <div className="border-b border-[#ded6da] px-2 pb-4 pt-1">
          <h2 className="text-base font-semibold text-[#2d1d27]">Impostazioni</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">Salone e sistema</p>
        </div>
        <nav aria-label="Navigazione impostazioni" className="mt-4 space-y-5">
            {groups.map((group) => <section key={group.label}>
              <h3 className="mb-1.5 px-2 text-xs font-semibold text-stone-500">{group.label}</h3>
              <div className="space-y-1">
                {group.links.map((item) => {
                  const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "bg-[#e7dce2] font-semibold text-[#452536] shadow-[inset_0_0_0_1px_rgb(121_47_89_/_0.08)]" : "text-stone-600 hover:bg-black/[.035] hover:text-stone-900"}`}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon aria-hidden="true" className={`size-4 shrink-0 ${active ? "text-[#6f3556]" : "text-stone-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>)}
        </nav>
      </aside>

      <div className="min-w-0 px-3 py-4 sm:px-4 lg:px-5 [&>.esse-workspace-page]:min-h-0 [&>.esse-workspace-page]:px-0 [&>.esse-workspace-page]:py-0 [&>.esse-workspace-page>div]:max-w-none">
        {children}
      </div>
    </div>
  );
}
