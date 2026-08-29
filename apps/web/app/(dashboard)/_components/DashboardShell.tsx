"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Plus, X } from "lucide-react";

import { MODULE_KEYS, ModuleProvider, useModuleEnabled, useModules } from "@esse-beauty/feature-flags";
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
  MoreIcon,
  RemindersIcon,
  ReportsIcon,
  ReviewsIcon,
  SalesIcon,
  ServicesIcon,
  SidebarToggleIcon,
  SettingsIcon,
  StaffIcon,
  WaitlistIcon,
  WhatsAppIcon,
} from "./Icons";
import { notificationTypeLabels, searchGroups, type SearchGroupKey } from "./shell-config";
import { AppRail } from "./AppRail";
import { AppDrawerOverlay } from "./AppDrawerOverlay";
import { MobileAppNavigation } from "./MobileAppNavigation";
import { WorkspaceTopbar } from "./WorkspaceTopbar";
import { CommunicationWorkspaceProvider, useCommunicationWorkspace } from "./CommunicationWorkspaceProvider";
import { WhatsAppChatDrawer } from "./WhatsAppChatDrawer";
import { appForPath, browserTitleForPath, visibleApps, visibleQuickActions, visibleTabs, type AppQuickAction } from "./app-registry";
import { applyNotificationSnapshot, markNotificationRead, playIncomingMessageSound, type ShellNotification } from "./notification-state";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type IconComponent = ComponentType<{ className?: string }>;

const primary: Array<{ href: string; icon: IconComponent; label: string; section: string }> = [
  { href: "/", icon: DashboardIcon, label: "Home", section: "Operativita" },
  { href: "/calendar", icon: CalendarIcon, label: "Agenda", section: "Operativita" },
  { href: "/sales", icon: SalesIcon, label: "Cassa", section: "Operativita" },
  { href: "/accounting", icon: ReportsIcon, label: "Contabilita", section: "Operativita" },
  { href: "/clients", icon: ClientsIcon, label: "Clienti", section: "Archivio" },
  { href: "/vouchers", icon: LoyaltyIcon, label: "Buoni acquisto", section: "Archivio" },
  { href: "/services", icon: ServicesIcon, label: "Servizi", section: "Archivio" },
  { href: "/staff", icon: StaffIcon, label: "Staff", section: "Archivio" },
];

const moduleLinks = [
  { moduleKey: MODULE_KEYS.REVIEWS, href: "/reviews", icon: ReviewsIcon, label: "Recensioni" },
  { moduleKey: MODULE_KEYS.WAITLIST, href: "/waitlist", icon: WaitlistIcon, label: "Lista attesa" },
  { moduleKey: MODULE_KEYS.LOYALTY, href: "/loyalty", icon: LoyaltyIcon, label: "Fedelta" },
  { moduleKey: MODULE_KEYS.MARKETING, href: "/marketing", icon: MarketingIcon, label: "Marketing" },
  { moduleKey: MODULE_KEYS.INVENTORY, href: "/inventory", icon: InventoryIcon, label: "Magazzino" },
  { moduleKey: MODULE_KEYS.STAFF_PERF, href: "/reports", icon: ReportsIcon, label: "Report" },
  { moduleKey: MODULE_KEYS.PACKAGES, href: "/packages", icon: ServicesIcon, label: "Pacchetti" },
  { moduleKey: MODULE_KEYS.AUDIT_COMPLIANCE, href: "/settings/audit", icon: ReportsIcon, label: "Attività" },
];

const settingsLinks = [
  { href: "/settings", icon: SettingsIcon, label: "Centro controllo" },
  { href: "/settings/users", icon: StaffIcon, label: "Utenti" },
  { href: "/staff/permissions", icon: RemindersIcon, label: "Permessi e assenze" },
];

const workspaceSections = [
  { label: "Oggi", paths: ["/", "/calendar", "/sales"] },
  { label: "Relazioni", paths: ["/clients", "/vouchers", "/staff", "/services", "/cabins", "/packages", "/loyalty"] },
  { label: "Operatività", paths: ["/accounting", "/inventory", "/reviews", "/waitlist", "/marketing", "/reports"] },
  { label: "Sistema", paths: ["/settings"] },
] as const;

function currentSection(pathname: string) {
  if (pathname === "/") return { area: "Oggi", label: "Panoramica" };
  const workspaceArea = workspaceSections.find((section) =>
    section.paths.some((path) => path !== "/" && pathname.startsWith(path)),
  )?.label ?? "Workspace";
  const labels: Array<[string, string, string]> = [
    ["/calendar", "Oggi", "Agenda"],
    ["/sales", "Oggi", "Cassa"],
    ["/accounting", "Operatività", "Contabilita"],
    ["/clients", "Relazioni", "Clienti"],
    ["/vouchers", "Relazioni", "Buoni acquisto"],
    ["/staff", "Relazioni", "Staff"],
    ["/services", "Relazioni", "Servizi"],
    ["/cabins", "Relazioni", "Cabine"],
    ["/packages", "Relazioni", "Pacchetti"],
    ["/loyalty", "Relazioni", "Fedeltà"],
    ["/inventory", "Operatività", "Magazzino"],
    ["/reviews", "Operatività", "Recensioni"],
    ["/waitlist", "Operatività", "Lista d’attesa"],
    ["/marketing", "Operatività", "Marketing"],
    ["/reports", "Operatività", "Report"],
    ["/settings", "Sistema", "Impostazioni"],
  ];
  const match = labels.find(([path]) => pathname.startsWith(path));
  return match ? { area: match[1], label: match[2] } : { area: workspaceArea, label: "EsseBeauty" };
}

interface SearchResult {
  group: SearchGroupKey;
  href: string;
  subtitle?: string;
  title: string;
}

interface NotificationItem extends ShellNotification {
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

function NavigationLink({ badge = 0, collapsed = false, href, icon: Icon, label, onClick }: { badge?: number; collapsed?: boolean; href: string; icon: IconComponent; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      aria-label={label}
      className={`${collapsed ? "grid size-12 place-items-center" : "flex min-h-11 items-center gap-3 px-3"} relative rounded-xl text-sm font-bold transition ${active ? "bg-white text-[#5f2447] shadow-[0_8px_22px_rgb(20_10_16_/_0.22)]" : "text-white/68 hover:bg-white/10 hover:text-white"}`}
      href={href}
      onClick={onClick}
      title={label}
    >
      <Icon className="shrink-0" />
      {!collapsed && <span>{label}</span>}
      {badge > 0 && <span className={`${collapsed ? "absolute -right-1 -top-1" : "ml-auto"} grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white`}>{Math.min(badge, 9)}</span>}
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

function QuickCreateMenu({ actions }: { actions: readonly AppQuickAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Crea nuovo"
        className="grid size-10 place-items-center rounded-xl border border-[#792f59] bg-[#792f59] text-white transition-colors hover:bg-[#66264b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20"
        onClick={() => setOpen((value) => !value)}
        title="Crea nuovo"
        type="button"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-[0_18px_48px_rgb(45_29_39_/_0.14)]" role="menu">
          {actions.map((action) => (
            <Link className="block rounded-xl px-4 py-3 text-sm font-bold text-stone-700 hover:bg-[#faf3f7] hover:text-[#792f59]" href={action.href} key={action.href} onClick={() => setOpen(false)} role="menuitem">
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandPalette({ actions, onClose, open, salonId }: { actions: readonly AppQuickAction[]; onClose(): void; open: boolean; salonId?: string }) {
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
          {actions.map((action) => <Link className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-bold hover:bg-[#f3e2eb]" href={action.href} key={action.href} onClick={onClose}>{action.label}</Link>)}
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

function NotificationCenter({ error, items, onArchive, onClose, onMarkAllRead, onMarkRead, onOpenItem, open }: { error: string; items: NotificationItem[]; onArchive(item: NotificationItem): void; onClose(): void; onMarkAllRead(): void; onMarkRead(item: NotificationItem): void; onOpenItem(item: NotificationItem): void; open: boolean }) {
  return (
    <Drawer onClose={onClose} open={open} title="Notifiche">
      {items.some((item) => !item.read_at) && <div className="mb-4 flex justify-end"><Button onClick={onMarkAllRead} size="sm" variant="outline">Segna tutte come lette</Button></div>}
      {error && <InlineError>{error}</InlineError>}
      {!error && items.length === 0 && <EmptyState description="Appuntamenti, recensioni, scorte e richieste appariranno qui." title="Nessuna notifica" />}
      <div className="space-y-3">
        {items.map((item) => (
          <article className={`rounded-xl border p-4 ${item.read_at ? "border-stone-100 bg-white" : "border-[#d7a6c1] bg-[#fffafd]"}`} key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{item.category ?? notificationTypeLabels[item.type] ?? item.type}</p>
                <h3 className="mt-1 font-bold text-stone-950">{item.title}</h3>
              </div>
              <StatusBadge status={item.priority === "high" || item.priority === "critical" ? "waiting" : "active"}>{item.priority ?? "normal"}</StatusBadge>
            </div>
            {item.body && <p className="mt-2 text-sm leading-6 text-stone-500">{item.body}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.href && <button className="rounded-xl bg-[#402334] px-3 py-2 text-xs font-bold text-white" onClick={() => onOpenItem(item)} type="button">Apri</button>}
              {item.entity_type === "staff_availability_request" && <StatusBadge status="pending">Da completare</StatusBadge>}
              {!item.read_at && <Button onClick={() => onMarkRead(item)} size="sm" variant="outline">Letta</Button>}
              <Button onClick={() => onArchive(item)} size="sm" variant="tableAction">Archivia</Button>
            </div>
          </article>
        ))}
      </div>
    </Drawer>
  );
}

function NotificationPreviewCard({ item, onDismiss, onOpen }: { item: Pick<NotificationItem, "body" | "title">; onDismiss(): void; onOpen(): void }) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), 6_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <article className="pointer-events-auto relative isolate mb-3 w-[min(360px,calc(100vw-1.5rem))]" role="status">
      <div className="relative z-10 overflow-hidden rounded-xl border border-[#b8dfc9] bg-white shadow-md">
        <div className="flex min-w-0 items-start gap-3 bg-white p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f7ee] text-[#237449]"><MessageSquareText className="size-5" /></span>
          <button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button"><b className="block truncate text-sm text-stone-950">{item.title}</b>{item.body && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-stone-500">{item.body}</span>}</button>
          <button aria-label="Chiudi anteprima notifica" className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100" onClick={onDismiss} type="button"><X className="size-4" /></button>
        </div>
        <div className="h-1 origin-left animate-[notification-life_6s_linear_forwards] bg-[#25D366]" />
      </div>
      <span aria-hidden="true" className="absolute -bottom-[11px] right-5 z-0 h-3 w-[18px] bg-[#b8dfc9]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
      <span aria-hidden="true" className="absolute -bottom-[9px] right-[21px] z-20 h-[10px] w-4 bg-white" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
    </article>
  );
}

function UnifiedSideNavigation({
  collapsed,
  logout,
  onNotificationOpen,
  sectionLinks,
  staffRequestCount,
  unreadCount,
  user,
}: {
  collapsed: boolean;
  logout(): void;
  onNotificationOpen(): void;
  sectionLinks: Array<{ href: string; icon: IconComponent; label: string }>;
  staffRequestCount: number;
  unreadCount: number;
  user?: { full_name: string; role: string } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [scrollShadows, setScrollShadows] = useState({ bottom: false, top: false });

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = scrollContentRef.current;
    if (!scrollElement || !contentElement) return;

    function updateShadows() {
      const element = scrollRef.current;
      if (!element) return;
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      setScrollShadows({
        bottom: remaining > 2,
        top: element.scrollTop > 2,
      });
    }

    updateShadows();
    const observer = new ResizeObserver(updateShadows);
    observer.observe(scrollElement);
    observer.observe(contentElement);
    window.addEventListener("resize", updateShadows);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateShadows);
    };
  }, [collapsed, sectionLinks]);

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-white/10 bg-[#35212e] text-white shadow-[12px_0_36px_rgb(30_15_24_/_0.16)] transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-20 p-3" : "w-72 p-5"}`}>
      <div className={`flex shrink-0 items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 border-b border-white/10 pb-5`}>
        <Link className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-lg font-black text-[#792f59] shadow-lg" href="/">E</Link>
        {!collapsed && <div className="min-w-0 flex-1"><b className="block truncate text-lg text-white">EsseBeauty</b><small className="text-white/50">Gestione salone</small></div>}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-1 top-0 z-10 h-px bg-[#d7a6c1] shadow-[0_10px_18px_8px_rgb(121_47_89_/_0.18)] transition-opacity duration-200 ${scrollShadows.top ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className="sidebar-scroll h-full overflow-y-auto overflow-x-hidden py-5"
          onScroll={() => {
            const element = scrollRef.current;
            if (!element) return;
            setScrollShadows({
              bottom: element.scrollHeight - element.clientHeight - element.scrollTop > 2,
              top: element.scrollTop > 2,
            });
          }}
          ref={scrollRef}
        >
          <div ref={scrollContentRef}>
            <nav className="space-y-1">
              {sectionLinks.map((item) => <NavigationLink badge={item.href === "/staff/permissions" ? staffRequestCount : 0} collapsed={collapsed} href={item.href} icon={item.icon} key={item.href} label={item.label} />)}
            </nav>

            <div className="mt-6 border-t border-stone-100 pt-5">
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.2em] text-white/35">Moduli attivi</p>}
              <ModuleNav collapsed={collapsed} />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-1 bottom-0 z-10 h-px bg-[#d7a6c1] shadow-[0_-10px_18px_8px_rgb(121_47_89_/_0.18)] transition-opacity duration-200 ${scrollShadows.bottom ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/10 pt-3">
        <NavigationLink badge={staffRequestCount} collapsed={collapsed} href="/settings" icon={SettingsIcon} label="Impostazioni" />
        <button className={`${collapsed ? "grid size-12 place-items-center" : "flex min-h-11 w-full items-center gap-3 px-3"} relative rounded-xl text-sm font-bold text-white/68 hover:bg-white/10 hover:text-white`} onClick={onNotificationOpen} type="button">
          <BellIcon className="shrink-0" />
          {!collapsed && <span>Notifiche</span>}
          {unreadCount > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(unreadCount, 9)}</span>}
        </button>
        <div className={`rounded-xl border border-white/10 bg-white/7 p-3 ${collapsed ? "text-center" : ""}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d9a5c2] font-bold text-[#402334]">{user?.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
            {!collapsed && <div className="min-w-0 flex-1"><b className="block truncate text-sm text-white">{user?.full_name}</b><small className="text-white/45">{user?.role}</small></div>}
            {!collapsed && <button className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" onClick={logout} title="Esci"><LogoutIcon /></button>}
          </div>
        </div>
        {collapsed && <button className="grid size-12 place-items-center rounded-xl text-red-700 hover:bg-white" onClick={logout} title="Esci" type="button"><LogoutIcon /></button>}
      </div>
    </aside>
  );
}

function ShellContent({ children }: { children: ReactNode }) {
  const { permissions, salon, user } = useAuth();
  const { modules } = useModules();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [staffRequestCount, setStaffRequestCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [notificationPreviews, setNotificationPreviews] = useState<NotificationItem[]>([]);
  const [whatsappPreviews, setWhatsappPreviews] = useState<Array<{ body: string; conversationId: string; id: string; title: string }>>([]);
  const notificationItemsRef = useRef<NotificationItem[]>([]);
  const notificationsInitializedRef = useRef(false);
  const notificationRequestPendingRef = useRef(false);
  const notificationMutationCountRef = useRef(0);
  const communications = useCommunicationWorkspace();

  useEffect(() => {
    function incoming(rawEvent: Event) {
      const detail = (rawEvent as CustomEvent<{ body: string; conversationId: string; id: string; title: string }>).detail;
      if (!detail?.id || !detail.conversationId) return;
      playIncomingMessageSound();
      setWhatsappPreviews((current) => [...current.filter((item) => item.id !== detail.id), detail].slice(-3));
    }
    window.addEventListener("esse:whatsapp-message", incoming);
    return () => window.removeEventListener("esse:whatsapp-message", incoming);
  }, []);

  const grantedPermissions = useMemo(() => new Set(permissions), [permissions]);

  const sectionLinks = useMemo(() => {
    return primary;
  }, [pathname]);
  const section = currentSection(pathname);
  const apps = useMemo(
    () => visibleApps(
      new Set(Object.entries(modules).filter(([, enabled]) => enabled).map(([key]) => key)),
      grantedPermissions,
    ),
    [grantedPermissions, modules],
  );
  const currentApp = apps.find((app) => app.key === appForPath(pathname)?.key);
  const quickActions = useMemo(
    () => apps.flatMap((app) => visibleQuickActions(app, grantedPermissions)),
    [apps, grantedPermissions],
  );
  const currentQuickActions = useMemo(
    () => visibleQuickActions(currentApp, grantedPermissions),
    [currentApp, grantedPermissions],
  );
  const currentTabs = useMemo(
    () => visibleTabs(currentApp, grantedPermissions),
    [currentApp, grantedPermissions],
  );
  const topbarTabs = pathname.startsWith("/settings") ? [] : currentTabs;

  useEffect(() => {
    document.title = browserTitleForPath(pathname);
    setLauncherOpen(false);
    return () => {
      document.title = "EsseBeauty";
    };
  }, [pathname]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", keydown);
    function openNotifications() {
      setNotificationsOpen(true);
    }
    window.addEventListener("esse:open-notifications", openNotifications);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("esse:open-notifications", openNotifications);
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!salon?.id || notificationRequestPendingRef.current || notificationMutationCountRef.current > 0) return;
    notificationRequestPendingRef.current = true;
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/notifications`, { credentials: "include" });
      if (!response.ok) throw new Error("Centro notifiche non disponibile.");
      const data = await response.json() as { items?: NotificationItem[] };
      const snapshot = applyNotificationSnapshot(notificationItemsRef.current, data.items ?? [], notificationsInitializedRef.current);
      notificationItemsRef.current = snapshot.items as NotificationItem[];
      setNotificationItems(snapshot.items as NotificationItem[]);
      setUnreadCount(snapshot.unreadCount);
      if (snapshot.previews.length > 0) {
        setNotificationPreviews((current) => [...current, ...(snapshot.previews as NotificationItem[])].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).slice(-3));
      }
      notificationsInitializedRef.current = true;
      setNotificationError("");
    } catch (reason) {
      setNotificationError(reason instanceof Error ? reason.message : "Centro notifiche non disponibile.");
    } finally {
      notificationRequestPendingRef.current = false;
    }
  }, [salon?.id]);

  function replaceNotifications(items: NotificationItem[]) {
    notificationItemsRef.current = items;
    setNotificationItems(items);
    setUnreadCount(items.reduce((total, item) => total + (item.read_at ? 0 : 1), 0));
  }

  async function markRead(item: NotificationItem) {
    if (!salon?.id || item.read_at) return;
    const previous = notificationItemsRef.current;
    notificationMutationCountRef.current += 1;
    replaceNotifications(markNotificationRead(previous, item.id) as NotificationItem[]);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/notifications/${item.id}/read`, { credentials: "include", method: "PATCH" });
      if (!response.ok) {
        replaceNotifications(previous);
        setNotificationError("Impossibile aggiornare la notifica.");
      }
    } catch {
      replaceNotifications(previous);
      setNotificationError("Impossibile aggiornare la notifica.");
    } finally {
      notificationMutationCountRef.current -= 1;
    }
  }

  async function archiveNotification(item: NotificationItem) {
    if (!salon?.id) return;
    const previous = notificationItemsRef.current;
    notificationMutationCountRef.current += 1;
    replaceNotifications(previous.filter((candidate) => candidate.id !== item.id));
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/notifications/${item.id}`, { credentials: "include", method: "DELETE" });
      if (!response.ok) {
        replaceNotifications(previous);
        setNotificationError("Impossibile archiviare la notifica.");
      }
    } catch {
      replaceNotifications(previous);
      setNotificationError("Impossibile archiviare la notifica.");
    } finally {
      notificationMutationCountRef.current -= 1;
    }
  }

  function openNotification(item: NotificationItem) {
    setNotificationPreviews((current) => current.filter((candidate) => candidate.id !== item.id));
    void markRead(item);
    if (item.href) {
      setNotificationsOpen(false);
      router.push(item.href);
    } else {
      setNotificationsOpen(true);
    }
  }

  function loadStaffRequestCount() {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/staff-availability-requests-summary`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : { pending_count: 0 })
      .then((data: { pending_count?: number }) => {
        const count = data.pending_count ?? 0;
        setStaffRequestCount(count);
        document.documentElement.dataset.staffPendingCount = String(count);
        window.dispatchEvent(new CustomEvent("esse:staff-request-count", { detail: count }));
      });
  }

  useEffect(() => {
    void loadNotifications();
    loadStaffRequestCount();
    const notificationInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 3_000);
    const staffInterval = window.setInterval(loadStaffRequestCount, 30_000);
    function refresh() {
      void loadNotifications();
      loadStaffRequestCount();
    }
    function visibility() {
      if (document.visibilityState === "visible") void loadNotifications();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("esse:staff-requests-updated", refresh);
    return () => {
      window.clearInterval(notificationInterval);
      window.clearInterval(staffInterval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("esse:staff-requests-updated", refresh);
    };
  }, [loadNotifications, salon?.id]);

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

  return (
    <div className="esse-workspace min-h-screen pb-16 md:pb-0 md:pl-[76px]">
      <AppRail
        apps={apps}
        logout={() => void logout()}
        onAppsOpen={() => setLauncherOpen(true)}
        onNavigate={() => setLauncherOpen(false)}
        onNotificationsOpen={() => setNotificationsOpen(true)}
        pathname={pathname}
        unreadCount={unreadCount}
        userName={user?.full_name ?? ""}
      />
      <AppDrawerOverlay apps={apps} onClose={() => setLauncherOpen(false)} open={launcherOpen} />
      <WorkspaceTopbar actions={currentQuickActions} app={currentApp} canViewWhatsApp={communications.canView} onAppsOpen={() => setLauncherOpen(true)} onNotificationsOpen={() => setNotificationsOpen(true)} onSearchOpen={() => setSearchOpen(true)} onWhatsAppOpen={communications.openChat} pathname={pathname} tabs={topbarTabs} unreadCount={unreadCount} whatsappUnreadCount={communications.unreadCount} />
      <CommandPalette actions={quickActions} onClose={() => setSearchOpen(false)} open={searchOpen} salonId={salon?.id} />
      <NotificationCenter
        error={notificationError}
        items={notificationItems}
        onArchive={(item) => void archiveNotification(item)}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() => void Promise.all(notificationItems.filter((item) => !item.read_at).map(markRead))}
        onMarkRead={(item) => void markRead(item)}
        onOpenItem={openNotification}
        open={notificationsOpen}
      />
      <WhatsAppChatDrawer />
      <div className="pointer-events-none fixed right-4 top-20 z-[90] flex flex-col gap-3">
        {whatsappPreviews.map((item) => <NotificationPreviewCard item={item} key={item.id} onDismiss={() => setWhatsappPreviews((current) => current.filter((candidate) => candidate.id !== item.id))} onOpen={() => { setWhatsappPreviews((current) => current.filter((candidate) => candidate.id !== item.id)); communications.selectConversation(item.conversationId); communications.openChat(); }} />)}
        {notificationPreviews.map((item) => <NotificationPreviewCard item={item} key={item.id} onDismiss={() => setNotificationPreviews((current) => current.filter((candidate) => candidate.id !== item.id))} onOpen={() => openNotification(item)} />)}
      </div>
      <main className={`${topbarTabs.length ? "pt-[109px]" : "pt-16"}`}><div className="esse-page-view" key={pathname}>{children}</div></main>
      <MobileAppNavigation apps={apps} onAppsOpen={() => setLauncherOpen(true)} pathname={pathname} />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { loading, salon, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!salon || !user) {
      router.replace("/login");
    } else if (user.role === "owner" && !salon.onboarding_completed) {
      router.replace("/onboarding");
    }
  }, [loading, router, salon, user]);
  if (
    loading ||
    !salon ||
    !user ||
    (user.role === "owner" && !salon.onboarding_completed)
  ) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f2f4]"><div className="size-12 animate-pulse rounded-xl bg-[#792f59]" /></main>;
  }
  return <ModuleProvider apiBaseUrl={api} salonId={salon.id}><CommunicationWorkspaceProvider apiBaseUrl={api} salonId={salon.id}><ShellContent>{children}</ShellContent></CommunicationWorkspaceProvider></ModuleProvider>;
}
