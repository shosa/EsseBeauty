"use client";

import { CalendarDays, CalendarPlus, Gift, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { icon: Home, label: "Home", suffix: "" },
  { icon: CalendarPlus, label: "Prenota", suffix: "/book" },
  { icon: CalendarDays, label: "Appuntamenti", suffix: "/appointments" },
  { icon: Gift, label: "Fedeltà", suffix: "/loyalty" },
];

export function SalonBottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigazione cliente" className="fixed inset-x-3 bottom-3 z-30 mx-auto grid h-[68px] max-w-[430px] grid-cols-4 rounded-[1.4rem] border border-white/80 bg-white/94 p-1.5 shadow-[0_18px_50px_rgb(45_29_39_/_0.18)] backdrop-blur-xl">
      {items.map(({ icon: Icon, label, suffix }) => {
        const href = `/${slug}${suffix}`;
        const active = suffix ? pathname.startsWith(href) : pathname === href;
        return <Link aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition ${active ? "bg-[#402334] text-white shadow-sm" : "text-stone-500 hover:bg-[#faf3f7] hover:text-[#792f59]"}`} href={href} key={suffix || "home"}><Icon className="size-[19px]" strokeWidth={active ? 2.6 : 2} /><span className="max-w-full truncate">{label}</span></Link>;
      })}
    </nav>
  );
}
