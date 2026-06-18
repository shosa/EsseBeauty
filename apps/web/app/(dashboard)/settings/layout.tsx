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
  useEffect(() => {
    setStaffRequestCount(Number(document.documentElement.dataset.staffPendingCount ?? 0));
    function update(event: Event) {
      setStaffRequestCount(Number((event as CustomEvent<number>).detail ?? 0));
    }
    window.addEventListener("esse:staff-request-count", update);
    return () => window.removeEventListener("esse:staff-request-count", update);
  }, []);

  const links = [
    { href: "/settings", label: "Centro controllo" },
    { href: "/settings/users", label: "Utenti" },
    { href: "/settings/staff", label: "Staff & disponibilità" },
    { badge: staffRequestCount, href: "/settings/staff/requests", label: "Richieste staff" },
    { href: "/settings/services", label: "Catalogo servizi" },
    { href: "/settings/modules", label: "Moduli" },
    ...(reminders ? [{ href: "/settings/reminders", label: "Promemoria" }] : []),
    ...(loyalty ? [{ href: "/settings/loyalty", label: "Fedeltà" }] : []),
    ...(documents ? [{ href: "/settings/documents", label: "Documenti" }] : []),
    ...(packages ? [{ href: "/settings/packages", label: "Pacchetti" }] : []),
    ...(audit ? [{ href: "/settings/audit", label: "Audit" }] : []),
  ];

  return (
    <div className="px-4 pt-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_8px_24px_rgb(45_29_39_/_0.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee6ea] px-2 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8f3a68]">Sistema</p>
            <h2 className="text-base font-bold text-[#2d1d27]">Impostazioni salone</h2>
          </div>
          <p className="text-xs text-stone-500">Configurazione, accessi e moduli in un unico spazio</p>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {links.map((item) => {
            const active = item.href === "/settings"
              ? pathname === item.href
              : item.href === "/settings/staff"
                ? pathname === item.href || (pathname.startsWith(`${item.href}/`) && !pathname.startsWith("/settings/staff/requests"))
                : pathname.startsWith(item.href);
            const badge = "badge" in item ? item.badge ?? 0 : 0;
            return (
              <Link
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? "border-[#d7a6c1] bg-[#f7eaf1] text-[#792f59]" : "border-transparent text-stone-500 hover:bg-[#faf7f9] hover:text-[#792f59]"}`}
                href={item.href}
                key={item.href}
              >
                <span className="flex items-center gap-2">
                  {item.label}
                  {badge > 0 && <span className="grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(badge, 9)}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="-mx-4 sm:-mx-6 md:-mx-8">{children}</div>
    </div>
  );
}
