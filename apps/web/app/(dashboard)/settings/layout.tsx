"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reminders = useModuleEnabled(MODULE_KEYS.REMINDERS);
  const loyalty = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const documents = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const packages = useModuleEnabled(MODULE_KEYS.PACKAGES);
  const audit = useModuleEnabled(MODULE_KEYS.AUDIT_COMPLIANCE);
  const links = [
    { href: "/settings", label: "Centro controllo" },
    { href: "/settings/users", label: "Utenti" },
    { href: "/settings/staff", label: "Staff & disponibilità" },
    { href: "/settings/services", label: "Catalogo servizi" },
    { href: "/settings/modules", label: "Moduli" },
    ...(reminders ? [{ href: "/settings/reminders", label: "Promemoria" }] : []),
    ...(loyalty ? [{ href: "/settings/loyalty", label: "Fedeltà" }] : []),
    ...(documents ? [{ href: "/settings/documents", label: "Documenti" }] : []),
    ...(packages ? [{ href: "/settings/packages", label: "Pacchetti" }] : []),
    ...(audit ? [{ href: "/settings/audit", label: "Audit" }] : []),
  ];

  return (
    <div>
      <div className="border-b border-white/80 bg-white/70 px-5 pt-5 shadow-sm backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto">
          {links.map((item) => {
            const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                className={`whitespace-nowrap rounded-t-2xl border-b-2 px-4 py-3 text-sm font-bold transition ${active ? "border-[#792f59] bg-[#faf3f7] text-[#792f59]" : "border-transparent text-stone-500 hover:bg-white hover:text-[#792f59]"}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
