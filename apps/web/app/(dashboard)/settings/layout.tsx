"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [staffRequestCount, setStaffRequestCount] = useState(0);
  const reminders = useModuleEnabled(MODULE_KEYS.REMINDERS);
  const loyalty = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const documents = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const packages = useModuleEnabled(MODULE_KEYS.PACKAGES);
  const audit = useModuleEnabled(MODULE_KEYS.AUDIT_COMPLIANCE);
  const multiLocation = useModuleEnabled(MODULE_KEYS.MULTI_LOCATION);
  useEffect(() => {
    setStaffRequestCount(Number(document.documentElement.dataset.staffPendingCount ?? 0));
    function update(event: Event) {
      setStaffRequestCount(Number((event as CustomEvent<number>).detail ?? 0));
    }
    window.addEventListener("esse:staff-request-count", update);
    return () => window.removeEventListener("esse:staff-request-count", update);
  }, []);

  const groups = [
    {
      label: "Salone",
      links: [
        { href: "/settings", label: "Centro controllo" },
        { href: "/settings/users", label: "Utenti" },
        { href: "/settings/staff", label: "Staff" },
        { badge: staffRequestCount, href: "/settings/permissions", label: "Permessi" },
        { href: "/settings/pwa", label: "App Clienti" },
        { href: "/settings/locations", label: multiLocation ? "Sedi e cabine" : "Cabine" },
      ],
    },
    {
      label: "Offerta",
      links: [
        { href: "/settings/services", label: "Servizi" },
        ...(packages ? [{ href: "/settings/packages", label: "Pacchetti" }] : []),
        ...(loyalty ? [{ href: "/settings/loyalty", label: "Fedeltà" }] : []),
      ],
    },
    {
      label: "Sistema",
      links: [
        ...(reminders ? [{ href: "/settings/reminders", label: "Promemoria" }] : []),
        ...(documents ? [{ href: "/settings/documents", label: "Documenti" }] : []),
        ...(audit ? [{ href: "/settings/audit", label: "Attività" }] : []),
      ],
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6 md:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_8px_24px_rgb(45_29_39_/_0.045)] lg:sticky lg:top-[124px]">
          <div className="border-b border-[#eee6ea] px-2 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8f3a68]">Sistema</p>
            <h2 className="text-base font-bold text-[#2d1d27]">Impostazioni salone</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">Configurazione, accessi e moduli.</p>
          </div>
          <nav aria-label="Navigazione impostazioni" className="mt-4 space-y-5">
            {groups.map((group) => <section key={group.label}>
              <h3 className="mb-1.5 px-2 text-[9px] font-black uppercase tracking-[.16em] text-stone-400">{group.label}</h3>
              <div className="space-y-1">
                {group.links.map((item) => {
                  const active = item.href === "/settings"
                    ? pathname === item.href
                    : item.href === "/settings/staff"
                      ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                      : pathname.startsWith(item.href);
                  const badge = "badge" in item ? item.badge ?? 0 : 0;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? "border-[#d7a6c1] bg-[#faf3f7] text-[#792f59] shadow-sm" : "border-transparent text-stone-600 hover:bg-[#faf7f9] hover:text-[#792f59]"}`}
                      href={item.href}
                      key={item.href}
                    >
                      <span>{item.label}</span>
                      {badge > 0 && <span className="grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(badge, 9)}</span>}
                    </Link>
                  );
                })}
              </div>
            </section>)}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
