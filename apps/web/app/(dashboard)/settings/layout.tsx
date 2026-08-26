"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { BellRing, FileSignature, History, MapPinned, MessageCircle, SlidersHorizontal, Smartphone, Users } from "lucide-react";

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
        { href: "/settings", icon: SlidersHorizontal, label: "Centro controllo" },
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
    <div className="w-full px-3 py-4 sm:px-4 lg:px-5">
      <div className="grid w-full gap-3 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_8px_24px_rgb(45_29_39_/_0.045)] lg:sticky lg:top-[124px]">
          <div className="border-b border-[#eee6ea] px-2 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8f3a68]">Sistema</p>
            <h2 className="text-base font-bold text-[#2d1d27]">Impostazioni salone</h2>
          </div>
          <nav aria-label="Navigazione impostazioni" className="mt-4 space-y-5">
            {groups.map((group) => <section key={group.label}>
              <h3 className="mb-1.5 px-2 text-[9px] font-black uppercase tracking-[.16em] text-stone-400">{group.label}</h3>
              <div className="space-y-1">
                {group.links.map((item) => {
                  const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? "border-[#d7a6c1] bg-[#faf3f7] text-[#792f59] shadow-sm" : "border-transparent text-stone-600 hover:bg-[#faf7f9] hover:text-[#792f59]"}`}
                      href={item.href}
                      key={item.href}
                    >
                      <span className="flex min-w-0 items-center gap-2.5"><Icon className={`size-4 shrink-0 ${active ? "text-[#792f59]" : "text-stone-400"}`} /><span className="truncate">{item.label}</span></span>
                    </Link>
                  );
                })}
              </div>
            </section>)}
          </nav>
        </aside>
        <div className="min-w-0 [&>.esse-workspace-page]:min-h-0 [&>.esse-workspace-page]:px-0 [&>.esse-workspace-page]:py-0 [&>.esse-workspace-page>div]:max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
