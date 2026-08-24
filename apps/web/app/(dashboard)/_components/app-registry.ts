import type { ComponentType, SVGProps } from "react";

import { MODULE_KEYS, type ModuleKey } from "@esse-beauty/feature-flags";

import {
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  InventoryIcon,
  LoyaltyIcon,
  MarketingIcon,
  ModuleIcon,
  RemindersIcon,
  ReportsIcon,
  ReviewsIcon,
  SalesIcon,
  ServicesIcon,
  SettingsIcon,
  StaffIcon,
  WaitlistIcon,
} from "./Icons";

export type AppDomainKey = "day" | "relationships" | "growth" | "control";
export type AppIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface AppTab {
  href: string;
  label: string;
}

export interface AppQuickAction {
  href: string;
  label: string;
}

export interface AppDefinition {
  accent: string;
  description: string;
  domain: AppDomainKey;
  href: string;
  icon: AppIcon;
  key: string;
  label: string;
  moduleKey?: ModuleKey;
  paths: readonly string[];
  quickActions?: readonly AppQuickAction[];
  tabs?: readonly AppTab[];
}

export const APP_DOMAINS: ReadonlyArray<{ key: AppDomainKey; label: string }> = [
  { key: "day", label: "Giornata" },
  { key: "relationships", label: "Relazioni" },
  { key: "growth", label: "Crescita" },
  { key: "control", label: "Controllo" },
];

export const APP_REGISTRY: readonly AppDefinition[] = [
  {
    accent: "#792f59",
    description: "Panoramica operativa del salone",
    domain: "day",
    href: "/",
    icon: DashboardIcon,
    key: "home",
    label: "Home",
    paths: ["/"],
  },
  {
    accent: "#7c3aed",
    description: "Appuntamenti, risorse e disponibilità",
    domain: "day",
    href: "/calendar",
    icon: CalendarIcon,
    key: "calendar",
    label: "Agenda",
    paths: ["/calendar"],
    quickActions: [{ href: "/calendar/appointments/new", label: "Nuovo appuntamento" }],
    tabs: [
      { href: "/calendar", label: "Agenda" },
      { href: "/calendar/appointments/new", label: "Nuovo appuntamento" },
    ],
  },
  {
    accent: "#0f766e",
    description: "Vendite, pagamenti e chiusura",
    domain: "day",
    href: "/sales",
    icon: SalesIcon,
    key: "sales",
    label: "Cassa",
    paths: ["/sales"],
  },
  {
    accent: "#2563eb",
    description: "Anagrafiche, preferenze e storico",
    domain: "relationships",
    href: "/clients",
    icon: ClientsIcon,
    key: "clients",
    label: "Clienti",
    paths: ["/clients"],
    quickActions: [{ href: "/clients/new", label: "Nuovo cliente" }],
  },
  {
    accent: "#0369a1",
    description: "Team, ruoli e operatività",
    domain: "relationships",
    href: "/staff",
    icon: StaffIcon,
    key: "staff",
    label: "Staff",
    paths: ["/staff", "/settings/staff"],
  },
  {
    accent: "#9333ea",
    description: "Catalogo, categorie e prezzi",
    domain: "relationships",
    href: "/services",
    icon: ServicesIcon,
    key: "services",
    label: "Servizi",
    paths: ["/services", "/settings/services"],
    quickActions: [{ href: "/settings/services/new", label: "Nuovo servizio" }],
  },
  {
    accent: "#b45309",
    description: "Emissione e utilizzo dei buoni",
    domain: "relationships",
    href: "/vouchers",
    icon: LoyaltyIcon,
    key: "vouchers",
    label: "Buoni acquisto",
    paths: ["/vouchers"],
  },
  {
    accent: "#be185d",
    description: "Campagne e comunicazioni clienti",
    domain: "growth",
    href: "/marketing",
    icon: MarketingIcon,
    key: "marketing",
    label: "Marketing",
    moduleKey: MODULE_KEYS.MARKETING,
    paths: ["/marketing"],
    quickActions: [{ href: "/marketing/new", label: "Nuova campagna" }],
  },
  {
    accent: "#c026d3",
    description: "Punti, premi e fidelizzazione",
    domain: "growth",
    href: "/settings/loyalty",
    icon: LoyaltyIcon,
    key: "loyalty",
    label: "Fedeltà",
    moduleKey: MODULE_KEYS.LOYALTY,
    paths: ["/settings/loyalty"],
  },
  {
    accent: "#ca8a04",
    description: "Feedback e reputazione",
    domain: "growth",
    href: "/reviews",
    icon: ReviewsIcon,
    key: "reviews",
    label: "Recensioni",
    moduleKey: MODULE_KEYS.REVIEWS,
    paths: ["/reviews"],
  },
  {
    accent: "#ea580c",
    description: "Richieste e slot liberati",
    domain: "growth",
    href: "/waitlist",
    icon: WaitlistIcon,
    key: "waitlist",
    label: "Lista d’attesa",
    moduleKey: MODULE_KEYS.WAITLIST,
    paths: ["/waitlist"],
  },
  {
    accent: "#15803d",
    description: "Prodotti, giacenze e movimenti",
    domain: "control",
    href: "/inventory",
    icon: InventoryIcon,
    key: "inventory",
    label: "Inventario",
    moduleKey: MODULE_KEYS.INVENTORY,
    paths: ["/inventory"],
    quickActions: [{ href: "/inventory/new", label: "Nuovo prodotto" }],
  },
  {
    accent: "#0f766e",
    description: "Movimenti e andamento economico",
    domain: "control",
    href: "/accounting",
    icon: ReportsIcon,
    key: "accounting",
    label: "Contabilità",
    paths: ["/accounting"],
  },
  {
    accent: "#4338ca",
    description: "Indicatori e performance",
    domain: "control",
    href: "/reports",
    icon: ReportsIcon,
    key: "reports",
    label: "Report",
    moduleKey: MODULE_KEYS.STAFF_PERF,
    paths: ["/reports"],
  },
  {
    accent: "#475569",
    description: "Documenti e consensi",
    domain: "control",
    href: "/settings/documents",
    icon: ModuleIcon,
    key: "documents",
    label: "Consensi",
    moduleKey: MODULE_KEYS.DOCUMENTS,
    paths: ["/settings/documents"],
  },
  {
    accent: "#7e22ce",
    description: "Offerte composte e percorsi",
    domain: "control",
    href: "/settings/packages",
    icon: ServicesIcon,
    key: "packages",
    label: "Pacchetti",
    moduleKey: MODULE_KEYS.PACKAGES,
    paths: ["/settings/packages"],
  },
  {
    accent: "#475569",
    description: "Cronologia delle operazioni",
    domain: "control",
    href: "/settings/audit",
    icon: ReportsIcon,
    key: "audit",
    label: "Attività",
    moduleKey: MODULE_KEYS.AUDIT_COMPLIANCE,
    paths: ["/settings/audit"],
  },
  {
    accent: "#57534e",
    description: "Configurazione del salone",
    domain: "control",
    href: "/settings",
    icon: SettingsIcon,
    key: "settings",
    label: "Impostazioni",
    paths: ["/settings"],
    tabs: [
      { href: "/settings", label: "Salone" },
      { href: "/settings/users", label: "Team e accessi" },
      { href: "/settings/permissions", label: "Operatività" },
      { href: "/settings/reminders", label: "Comunicazioni" },
      { href: "/settings/pwa", label: "App clienti" },
    ],
  },
  {
    accent: "#b45309",
    description: "Promemoria automatici",
    domain: "control",
    href: "/settings/reminders",
    icon: RemindersIcon,
    key: "reminders",
    label: "Promemoria",
    moduleKey: MODULE_KEYS.REMINDERS,
    paths: ["/settings/reminders"],
  },
] as const;

function matchesPath(pathname: string, candidate: string): boolean {
  return candidate === "/"
    ? pathname === "/"
    : pathname === candidate || pathname.startsWith(`${candidate}/`);
}

export function appForPath(pathname: string): AppDefinition | undefined {
  return APP_REGISTRY
    .flatMap((app) => app.paths.map((path) => ({ app, path })))
    .filter(({ path }) => matchesPath(pathname, path))
    .sort((left, right) => right.path.length - left.path.length)[0]?.app;
}

export function visibleApps(enabledModules: ReadonlySet<ModuleKey | string>): AppDefinition[] {
  return APP_REGISTRY.filter((app) => !app.moduleKey || enabledModules.has(app.moduleKey));
}

export function contextTabsForPath(pathname: string): readonly AppTab[] {
  return appForPath(pathname)?.tabs ?? [];
}
