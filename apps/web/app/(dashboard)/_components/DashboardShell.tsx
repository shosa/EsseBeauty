"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, ModuleProvider, useModuleEnabled } from "@esse-beauty/feature-flags";
import { Button, Dialog, Drawer, EmptyState, InlineError, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import {
  BellIcon,
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  InventoryIcon,
  LoyaltyIcon,
  LogoutIcon,
  MarketingIcon,
  ModuleIcon,
  MoreIcon,
  RemindersIcon,
  ReportsIcon,
  ReviewsIcon,
  ServicesIcon,
  SidebarToggleIcon,
  SettingsIcon,
  StaffIcon,
  WaitlistIcon,
} from "./Icons";
import { notificationTypeLabels, quickCreateActions, searchGroups, type SearchGroupKey } from "./shell-config";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type IconComponent = ComponentType<{ className?: string }>;

const primary: Array<{ href: string; icon: IconComponent; label: string; section: string }> = [
  { href: "/", icon: DashboardIcon, label: "Home", section: "Operativita" },
  { href: "/calendar", icon: CalendarIcon, label: "Agenda", section: "Operativita" },
  { href: "/clients", icon: ClientsIcon, label: "Clienti", section: "Archivio" },
  { href: "/services", icon: ServicesIcon, label: "Servizi", section: "Archivio" },
  { href: "/staff", icon: StaffIcon, label: "Staff", section: "Archivio" },
];

const moduleLinks = [
  { moduleKey: MODULE_KEYS.REMINDERS, href: "/settings/reminders", icon: RemindersIcon, label: "Promemoria" },
  { moduleKey: MODULE_KEYS.REVIEWS, href: "/reviews", icon: ReviewsIcon, label: "Recensioni" },
  { moduleKey: MODULE_KEYS.WAITLIST, href: "/waitlist", icon: WaitlistIcon, label: "Lista attesa" },
  { moduleKey: MODULE_KEYS.LOYALTY, href: "/settings/loyalty", icon: LoyaltyIcon, label: "Fedelta" },
  { moduleKey: MODULE_KEYS.MARKETING, href: "/marketing", icon: MarketingIcon, label: "Marketing" },
  { moduleKey: MODULE_KEYS.INVENTORY, href: "/inventory", icon: InventoryIcon, label: "Inventario" },
  { moduleKey: MODULE_KEYS.STAFF_PERF, href: "/reports", icon: ReportsIcon, label: "Report" },
  { moduleKey: MODULE_KEYS.DOCUMENTS, href: "/settings/documents", icon: ModuleIcon, label: "Consensi" },
  { moduleKey: MODULE_KEYS.PACKAGES, href: "/settings/packages", icon: ServicesIcon, label: "Pacchetti" },
  { moduleKey: MODULE_KEYS.AUDIT_COMPLIANCE, href: "/settings/audit", icon: ReportsIcon, label: "Audit" },
];

const settingsLinks = [
  { href: "/settings", icon: SettingsIcon, label: "Centro controllo" },
  { href: "/settings/users", icon: StaffIcon, label: "Utenti" },
  { href: "/settings/modules", icon: ModuleIcon, label: "Moduli" },
];

interface SearchResult {
  group: SearchGroupKey;
  href: string;
  subtitle?: string;
  title: string;
}

interface NotificationItem {
  body?: string;
  category?: string;
  channel?: string;
  entity_id?: string | null;
  entity_type?: string | null;
  href?: string | null;
  id: string;
  priority?: string;
  read_at?: string | null;
  title: string;
  type: keyof typeof notificationTypeLabels;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavigationLink({ collapsed = false, href, icon: Icon, label, onClick }: { collapsed?: boolean; href: string; icon: IconComponent; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      aria-label={label}
      className={`${collapsed ? "grid size-12 place-items-center" : "flex min-h-11 items-center gap-3 px-3"} rounded-2xl text-sm font-bold transition ${active ? "bg-[#f3e2eb] text-[#792f59] shadow-sm" : "text-stone-600 hover:bg-white hover:text-[#792f59]"}`}
      href={href}
      onClick={onClick}
      title={label}
    >
      <Icon className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function ModuleNav({ close, collapsed = false }: { close?: () => void; collapsed?: boolean }) {
  return (
    <div className="space-y-1">
      {moduleLinks.map((item) => <ModuleNavItem close={close} collapsed={collapsed} key={item.moduleKey} {...item} />)}
    </div>
  );
}

function ModuleNavItem({ close, collapsed = false, href, icon, moduleKey, label }: { close?: () => void; collapsed?: boolean; href: string; icon: IconComponent; moduleKey: (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS]; label: string }) {
  return useModuleEnabled(moduleKey) ? <NavigationLink collapsed={collapsed} href={href} icon={icon} label={label} onClick={close} /> : null;
}

function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)} size="sm" variant="primary">Crea</Button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgb(45_29_39_/_0.16)] ring-1 ring-stone-950/5 backdrop-blur">
          {quickCreateActions.map((action) => (
            <Link className="block rounded-xl px-4 py-3 text-sm font-bold text-stone-700 hover:bg-[#faf3f7] hover:text-[#792f59]" href={action.href} key={action.key} onClick={() => setOpen(false)}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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

  return (
    <Dialog onClose={onClose} open={open} title="Cerca in EsseBeauty">
      <input autoFocus className="w-full" onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, appuntamento, servizio..." value={query} />
      <div className="mt-4 border-b border-stone-100 pb-4">
        <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-stone-400">Azioni rapide</p>
        <div className="grid gap-2">
          {quickCreateActions.map((action) => <Link className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-bold hover:bg-[#f3e2eb]" href={action.href} key={action.key} onClick={onClose}>{action.label}</Link>)}
        </div>
      </div>
      {error && <InlineError className="mt-4">{error}</InlineError>}
      {query.trim().length < 2 ? <p className="mt-4 text-sm text-stone-500">Scrivi almeno due caratteri.</p> :
        results.length === 0 && !error ? <EmptyState description="Prova con nome cliente, telefono, servizio o collaboratore." title="Nessun risultato" /> :
        <div className="mt-4 space-y-4">{searchGroups.map((group) => {
          const groupResults = results.filter((item) => item.group === group.key);
          if (groupResults.length === 0) return null;
          return <section key={group.key}><h3 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-stone-400">{group.label}</h3><div className="space-y-2">{groupResults.map((item) => <Link className="block rounded-xl border border-stone-100 p-3 hover:border-[#792f59]" href={item.href} key={`${item.group}-${item.href}`} onClick={onClose}><b className="block text-sm">{item.title}</b>{item.subtitle && <span className="text-xs text-stone-500">{item.subtitle}</span>}</Link>)}</div></section>;
        })}</div>}
    </Dialog>
  );
}

function NotificationCenter({ onClose, open, salonId, onRead }: { onClose(): void; open: boolean; salonId?: string; onRead(): void }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");

  function load() {
    if (!open || !salonId) return;
    void fetch(`${api}/api/salons/${salonId}/notifications`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Centro notifiche non disponibile.");
        const data = await response.json() as { items?: NotificationItem[] };
        setItems(data.items ?? []);
        setError("");
      })
      .catch((reason: unknown) => {
        setItems([]);
        setError(reason instanceof Error ? reason.message : "Centro notifiche non disponibile.");
      });
  }

  useEffect(load, [open, salonId]);

  async function markRead(item: NotificationItem) {
    if (!salonId) return;
    await fetch(`${api}/api/salons/${salonId}/notifications/${item.id}/read`, { credentials: "include", method: "PATCH" });
    onRead();
    load();
  }

  async function archive(item: NotificationItem) {
    if (!salonId) return;
    await fetch(`${api}/api/salons/${salonId}/notifications/${item.id}`, { credentials: "include", method: "DELETE" });
    onRead();
    load();
  }

  return (
    <Drawer onClose={onClose} open={open} title="Notifiche">
      {error && <InlineError>{error}</InlineError>}
      {!error && items.length === 0 && <EmptyState description="Appuntamenti, recensioni, scorte e richieste appariranno qui." title="Nessuna notifica" />}
      <div className="space-y-3">
        {items.map((item) => (
          <article className={`rounded-2xl border p-4 ${item.read_at ? "border-stone-100 bg-white" : "border-[#d7a6c1] bg-[#fffafd]"}`} key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{item.category ?? notificationTypeLabels[item.type] ?? item.type}</p>
                <h3 className="mt-1 font-bold text-stone-950">{item.title}</h3>
              </div>
              <StatusBadge status={item.priority === "high" || item.priority === "critical" ? "waiting" : "active"}>{item.priority ?? "normal"}</StatusBadge>
            </div>
            {item.body && <p className="mt-2 text-sm leading-6 text-stone-500">{item.body}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.href && <Link className="rounded-xl bg-[#402334] px-3 py-2 text-xs font-bold text-white" href={item.href} onClick={onClose}>Apri</Link>}
              {!item.read_at && <Button onClick={() => void markRead(item)} size="sm" variant="outline">Letta</Button>}
              <Button onClick={() => void archive(item)} size="sm" variant="tableAction">Archivia</Button>
            </div>
          </article>
        ))}
      </div>
    </Drawer>
  );
}

function UnifiedSideNavigation({
  collapsed,
  logout,
  onNotificationOpen,
  sectionLinks,
  unreadCount,
  user,
}: {
  collapsed: boolean;
  logout(): void;
  onNotificationOpen(): void;
  sectionLinks: Array<{ href: string; icon: IconComponent; label: string }>;
  unreadCount: number;
  user?: { full_name: string; role: string } | null;
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-white/70 bg-white/78 shadow-[12px_0_40px_rgb(45_29_39_/_0.06)] backdrop-blur transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-20 p-3" : "w-72 p-5"}`}>
      <div className={`flex shrink-0 items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 border-b border-stone-100 pb-5`}>
        <Link className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#402334] text-lg font-black text-white" href="/">E</Link>
        {!collapsed && <div className="min-w-0 flex-1"><b className="block truncate text-lg text-stone-950">EsseBeauty</b><small className="text-stone-400">Gestione salone</small></div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-5 pr-1 [scrollbar-width:thin]">
        <nav className="space-y-1">
          {sectionLinks.map((item) => <NavigationLink collapsed={collapsed} href={item.href} icon={item.icon} key={item.href} label={item.label} />)}
        </nav>

        <div className="mt-6 border-t border-stone-100 pt-5">
          {!collapsed && <p className="mb-2 px-3 text-xs font-black uppercase tracking-[.18em] text-stone-400">Moduli attivi</p>}
          <ModuleNav collapsed={collapsed} />
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-stone-100 pt-3">
        <NavigationLink collapsed={collapsed} href="/settings" icon={SettingsIcon} label="Impostazioni" />
        <button className={`${collapsed ? "grid size-12 place-items-center" : "flex min-h-11 w-full items-center gap-3 px-3"} relative rounded-2xl text-sm font-bold text-stone-600 hover:bg-white hover:text-[#792f59]`} onClick={onNotificationOpen} type="button">
          <BellIcon className="shrink-0" />
          {!collapsed && <span>Notifiche</span>}
          {unreadCount > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(unreadCount, 9)}</span>}
        </button>
        <div className={`rounded-3xl border border-white/80 bg-[#fffafd] p-3 shadow-sm ${collapsed ? "text-center" : ""}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d9a5c2] font-bold text-[#402334]">{user?.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
            {!collapsed && <div className="min-w-0 flex-1"><b className="block truncate text-sm">{user?.full_name}</b><small className="text-stone-500">{user?.role}</small></div>}
            {!collapsed && <button className="rounded-lg p-2 text-stone-500 hover:bg-white hover:text-red-700" onClick={logout} title="Esci"><LogoutIcon /></button>}
          </div>
        </div>
        {collapsed && <button className="grid size-12 place-items-center rounded-2xl text-red-700 hover:bg-white" onClick={logout} title="Esci" type="button"><LogoutIcon /></button>}
      </div>
    </aside>
  );
}

function ShellContent({ children }: { children: ReactNode }) {
  const { salon, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const sectionLinks = useMemo(() => {
    if (pathname.startsWith("/settings")) return settingsLinks;
    return primary;
  }, [pathname]);

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

  function loadUnread() {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/notifications`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : { unread_count: 0 })
      .then((data: { unread_count?: number }) => setUnreadCount(data.unread_count ?? 0));
  }

  useEffect(loadUnread, [salon?.id]);

  useEffect(() => {
    if (!salon?.id) return;
    const controller = new AbortController();
    void fetch(`${api}/api/salons/${salon.id}/shell-preferences`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { navigation_collapsed?: boolean };
        setNavigationCollapsed(data.navigation_collapsed === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [salon?.id]);

  function setCollapsedPreference(next: boolean) {
    setNavigationCollapsed(next);
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/shell-preferences`, {
      body: JSON.stringify({ navigation_collapsed: next }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }).catch(() => undefined);
  }

  async function logout() {
    await fetch(`${api}/api/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const shellStyle = {
    "--shell-nav-width": navigationCollapsed ? "5rem" : "18rem",
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-[#f6f2f4] pl-0 md:pl-[var(--shell-nav-width)]" style={shellStyle}>
      <UnifiedSideNavigation
        collapsed={navigationCollapsed}
        logout={() => void logout()}
        onNotificationOpen={() => setNotificationsOpen(true)}
        sectionLinks={sectionLinks}
        unreadCount={unreadCount}
        user={user}
      />

      <header className="fixed left-0 right-0 top-0 z-20 border-b border-white/70 bg-white/72 px-4 py-3 shadow-[0_12px_34px_rgb(45_29_39_/_0.06)] backdrop-blur md:left-[var(--shell-nav-width)]">
        <div className="flex items-center justify-between gap-3">
          <button className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-600 md:hidden" onClick={() => setMoreOpen(true)} type="button"><MoreIcon />Menu</button>
          <button
            aria-label={navigationCollapsed ? "Espandi navigazione" : "Comprimi navigazione"}
            aria-pressed={navigationCollapsed}
            className="hidden min-h-10 min-w-10 place-items-center rounded-2xl border border-stone-200 bg-white text-[#792f59] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d7a6c1] hover:bg-[#fffafd] md:grid"
            onClick={() => setCollapsedPreference(!navigationCollapsed)}
            title={navigationCollapsed ? "Espandi navigazione" : "Comprimi navigazione"}
            type="button"
          >
            <SidebarToggleIcon />
          </button>
          <button className="hidden min-h-10 min-w-[280px] rounded-2xl border border-stone-200 bg-white px-4 text-left text-sm font-semibold text-stone-500 shadow-sm md:block" onClick={() => setSearchOpen(true)} type="button">Cerca cliente, appuntamento, servizio... Ctrl+K</button>
          <div className="ml-auto flex items-center gap-2">
            <QuickCreateMenu />
            <button aria-label="Apri notifiche" className="relative grid min-h-10 min-w-10 place-items-center rounded-xl border border-stone-200 bg-white text-sm font-black text-[#792f59] shadow-sm" onClick={() => setNotificationsOpen(true)} type="button">
              <BellIcon />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(unreadCount, 9)}</span>}
            </button>
          </div>
        </div>
      </header>

      <CommandPalette onClose={() => setSearchOpen(false)} open={searchOpen} salonId={salon?.id} />
      <NotificationCenter onClose={() => setNotificationsOpen(false)} onRead={loadUnread} open={notificationsOpen} salonId={salon?.id} />
      <main className="pt-16 md:pt-[72px]">{children}</main>

      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-[#2d1d27]/40 backdrop-blur-sm md:hidden" onClick={() => setMoreOpen(false)}>
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Navigazione</h2><button onClick={() => setMoreOpen(false)}>Chiudi</button></div>
            <nav className="mt-6 space-y-1">{primary.map((item) => <NavigationLink href={item.href} icon={item.icon} key={item.href} label={item.label} onClick={() => setMoreOpen(false)} />)}<ModuleNav close={() => setMoreOpen(false)} />{settingsLinks.map((item) => <NavigationLink href={item.href} icon={item.icon} key={item.href} label={item.label} onClick={() => setMoreOpen(false)} />)}</nav>
            <button className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 font-semibold text-red-700" onClick={() => void logout()}><LogoutIcon />Esci</button>
          </aside>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { salon } = useAuth();
  return salon ? <ModuleProvider apiBaseUrl={api} salonId={salon.id}><ShellContent>{children}</ShellContent></ModuleProvider> : <>{children}</>;
}
