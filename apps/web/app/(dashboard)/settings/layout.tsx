"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reminders = useModuleEnabled(MODULE_KEYS.REMINDERS);
  const loyalty = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const links = [
    { href: "/settings", label: "Generali" },
    { href: "/settings/users", label: "Utenti" },
    { href: "/settings/modules", label: "Moduli" },
    ...(reminders
      ? [{ href: "/settings/reminders", label: "Promemoria" }]
      : []),
    ...(loyalty
      ? [{ href: "/settings/loyalty", label: "Fedeltà" }]
      : []),
  ];
  return <div><div className="border-b border-stone-200 bg-white px-5 pt-5 md:px-10"><div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto">{links.map((item) => {
    const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${active ? "border-[#792f59] text-[#792f59]" : "border-transparent text-stone-500"}`}>{item.label}</Link>;
  })}</div></div>{children}</div>;
}
