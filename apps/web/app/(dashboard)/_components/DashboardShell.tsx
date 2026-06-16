"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

import { MODULE_KEYS, ModuleProvider, useModuleEnabled } from "@esse-beauty/feature-flags";
import { Button, Dialog, Drawer, EmptyState, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import {
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  LogoutIcon,
  ModuleIcon,
  MoreIcon,
  ServicesIcon,
  SettingsIcon,
  StaffIcon,
} from "./Icons";
import { notificationTypeLabels, quickCreateActions, searchGroups, type SearchGroupKey } from "./shell-config";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type IconComponent = ComponentType<{ className?: string }>;

const primary: Array<{ href: string; icon: IconComponent; label: string }> = [
  { href: "/", icon: DashboardIcon, label: "Dashboard" },
  { href: "/calendar", icon: CalendarIcon, label: "Calendario" },
  { href: "/clients", icon: ClientsIcon, label: "Clienti" },
  { href: "/services", icon: ServicesIcon, label: "Servizi" },
  { href: "/staff", icon: StaffIcon, label: "Staff" },
];

const moduleLinks = [
  { moduleKey: MODULE_KEYS.REMINDERS, href: "/settings/reminders", label: "Promemoria" },
  { moduleKey: MODULE_KEYS.REVIEWS, href: "/reviews", label: "Recensioni" },
  { moduleKey: MODULE_KEYS.WAITLIST, href: "/waitlist", label: "Lista attesa" },
  { moduleKey: MODULE_KEYS.LOYALTY, href: "/settings/loyalty", label: "Fedeltà" },
  { moduleKey: MODULE_KEYS.MARKETING, href: "/marketing", label: "Marketing" },
  { moduleKey: MODULE_KEYS.INVENTORY, href: "/inventory", label: "Inventario" },
  { moduleKey: MODULE_KEYS.STAFF_PERF, href: "/reports", label: "Report" },
];

function NavLink({ href, icon: Icon, label, onClick }: { href: string; icon?: IconComponent; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <Link href={href} onClick={onClick} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[#f3e2eb] text-[#792f59]" : "text-stone-600 hover:bg-stone-50"}`}>{Icon ? <Icon className="shrink-0" /> : <ModuleIcon className="shrink-0" />}{label}</Link>;
}

function ModuleNav({ close }: { close?: () => void }) {
  return <div className="space-y-1">{moduleLinks.map((item) => <ModuleNavItem key={item.moduleKey} {...item} close={close} />)}</div>;
}

function ModuleNavItem({ close, href, moduleKey, label }: { close?: () => void; href: string; moduleKey: (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS]; label: string }) {
  return useModuleEnabled(moduleKey) ? <NavLink href={href} label={label} onClick={close} /> : null;
}

interface SearchResult {
  group: SearchGroupKey;
  href: string;
  subtitle?: string;
  title: string;
}

interface NotificationItem {
  body?: string;
  id: string;
  read_at?: string | null;
  title: string;
  type: keyof typeof notificationTypeLabels;
}

function QuickCreateMenu() {
  const [open, setOpen] = useState(false);

  return <div className="relative">
    <Button onClick={() => setOpen((value) => !value)} size="sm" variant="primary">Crea</Button>
    {open && <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
      {quickCreateActions.map((action) => <Link key={action.key} href={action.href} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">{action.label}</Link>)}
    </div>}
  </div>;
}

function CommandPalette({ onClose, open, salonId }: { onClose(): void; open: boolean; salonId?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !salonId || query.trim().length < 2) {
      setResults([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query.trim() });
    void fetch(`${api}/api/salons/${salonId}/search?${params}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ricerca non disponibile.");
        const data = await response.json() as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setResults([]);
          setError(reason instanceof Error ? reason.message : "Ricerca non disponibile.");
        }
      });
    return () => controller.abort();
  }, [open, query, salonId]);

  return <Dialog onClose={onClose} open={open} title="Cerca in EsseBeauty">
    <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, appuntamento, servizio..." className="min-h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#792f59]" />
    <div className="mt-4 border-b border-stone-100 pb-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Azioni rapide</p>
      <div className="grid gap-2">
        {quickCreateActions.map((action) => <Link key={action.key} href={action.href} onClick={onClose} className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-semibold hover:bg-[#f3e2eb]">{action.label}</Link>)}
      </div>
    </div>
    {error && <InlineError className="mt-4">{error}</InlineError>}
    {query.trim().length < 2 ? <p className="mt-4 text-sm text-stone-500">Scrivi almeno due caratteri per cercare clienti, appuntamenti, servizi, staff, campagne e prodotti.</p> :
      results.length === 0 && !error ? <EmptyState title="Nessun risultato" description="Prova con nome cliente, telefono, servizio o collaboratore." /> :
      <div className="mt-4 space-y-4">{searchGroups.map((group) => {
        const groupResults = results.filter((item) => item.group === group.key);
        if (groupResults.length === 0) return null;
        return <section key={group.key}><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">{group.label}</h3><div className="space-y-2">{groupResults.map((item) => <Link key={`${item.group}-${item.href}`} href={item.href} onClick={onClose} className="block rounded-xl border border-stone-100 p-3 hover:border-[#792f59]"><b className="block text-sm">{item.title}</b>{item.subtitle && <span className="text-xs text-stone-500">{item.subtitle}</span>}</Link>)}</div></section>;
      })}</div>}
  </Dialog>;
}

function NotificationCenter({ onClose, open, salonId }: { onClose(): void; open: boolean; salonId?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !salonId) return;
    void fetch(`${api}/api/salons/${salonId}/notifications`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Centro notifiche non ancora disponibile.");
        const data = await response.json() as { items?: NotificationItem[] };
        setItems(data.items ?? []);
        setError("");
      })
      .catch((reason: unknown) => {
        setItems([]);
        setError(reason instanceof Error ? reason.message : "Centro notifiche non ancora disponibile.");
      });
  }, [open, salonId]);

  return <Drawer onClose={onClose} open={open} title="Notifiche">
    {error && <InlineError>{error}</InlineError>}
    {!error && items.length === 0 && <EmptyState title="Nessuna notifica" description="Scorte basse, recensioni e lista d'attesa compariranno qui." />}
    <div className="space-y-3">
      {items.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.read_at ? "border-stone-100 bg-white" : "border-[#d7a6c1] bg-[#faf3f7]"}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-[#792f59]">{notificationTypeLabels[item.type] ?? item.type}</p>
        <h3 className="mt-1 font-bold">{item.title}</h3>
        {item.body && <p className="mt-1 text-sm text-stone-500">{item.body}</p>}
      </article>)}
    </div>
  </Drawer>;
}

function ShellContent({ children }: { children: ReactNode }) {
  const { salon, user } = useAuth();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  async function logout() {
    await fetch(`${api}/api/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }
  return <div className="min-h-screen bg-[#f6f2f4] md:pl-72">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-stone-200 bg-white p-5 md:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-stone-100 pb-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#402334] text-lg font-black text-white">E</span><span><b className="block text-lg">{salon?.name ?? "Esse Beauty"}</b><small className="text-stone-400">Gestione salone</small></span></Link>
      <nav className="mt-5 space-y-1">{primary.map((item) => <NavLink key={item.href} {...item} />)}</nav>
      <div className="mt-6"><p className="mb-2 px-3 text-xs font-bold uppercase tracking-[.18em] text-stone-400">Moduli attivi</p><ModuleNav /><Link href="/settings/modules" className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-stone-200 px-3 text-sm font-semibold text-stone-500 hover:border-[#792f59] hover:text-[#792f59]"><ModuleIcon />Licenza moduli</Link></div>
      <div className="mt-auto border-t border-stone-100 pt-4"><NavLink href="/settings" icon={SettingsIcon} label="Impostazioni" /><div className="mt-3 flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><span className="grid size-10 place-items-center rounded-full bg-[#d9a5c2] font-bold text-[#402334]">{user?.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{user?.full_name}</b><small className="text-stone-500">{user?.role}</small></div><button onClick={() => void logout()} title="Esci" className="rounded-lg p-2 text-stone-500 hover:bg-white hover:text-red-700"><LogoutIcon /></button></div></div>
    </aside>
    <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
      <button onClick={() => setSearchOpen(true)} className="hidden min-h-10 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 shadow-sm md:block">Cerca Ctrl+K</button>
      <QuickCreateMenu />
      <button onClick={() => setNotificationsOpen(true)} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-stone-200 bg-white text-sm font-bold text-[#792f59] shadow-sm" aria-label="Apri notifiche">N</button>
    </div>
    <CommandPalette onClose={() => setSearchOpen(false)} open={searchOpen} salonId={salon?.id} />
    <NotificationCenter onClose={() => setNotificationsOpen(false)} open={notificationsOpen} salonId={salon?.id} />
    <div className="pb-20 md:pb-0">{children}</div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-stone-200 bg-white px-2 py-2 md:hidden">{primary.map((item) => <Link key={item.href} href={item.href} className="grid place-items-center gap-1 text-[10px] font-semibold text-stone-600"><item.icon /><span>{item.label}</span></Link>)}<button onClick={() => setMoreOpen(true)} className="grid place-items-center gap-1 text-[10px] font-semibold"><MoreIcon /><span>Altro</span></button></nav>
    {moreOpen && <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMoreOpen(false)}><aside className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Navigazione</h2><button onClick={() => setMoreOpen(false)}>Chiudi</button></div><nav className="mt-6 space-y-1"><ModuleNav close={() => setMoreOpen(false)} /><NavLink href="/settings/modules" icon={ModuleIcon} label="Licenza moduli" onClick={() => setMoreOpen(false)} /><NavLink href="/settings" icon={SettingsIcon} label="Impostazioni" onClick={() => setMoreOpen(false)} /></nav><button onClick={() => void logout()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 font-semibold text-red-700"><LogoutIcon />Esci</button></aside></div>}
  </div>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { salon } = useAuth();
  return salon ? <ModuleProvider apiBaseUrl={api} salonId={salon.id}><ShellContent>{children}</ShellContent></ModuleProvider> : <>{children}</>;
}
