import type { ComponentType, SVGProps } from "react";

import { MODULE_KEYS, type ModuleKey } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS, type PermissionKey } from "@esse-beauty/shared";

import {
  AccountingIcon,
  AuditIcon,
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  DoorIcon,
  InventoryIcon,
  LoyaltyIcon,
  MarketingIcon,
  PackagesIcon,
  ReportsIcon,
  ReviewsIcon,
  SalesIcon,
  ServicesIcon,
  SettingsIcon,
  StaffIcon,
  WaitlistIcon,
  VouchersIcon,
} from "./Icons";

export type AppDomainKey = "day" | "relationships" | "growth" | "control";
export type AppIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface AppTab {
  href: string;
  label: string;
  permissions?: readonly PermissionKey[];
}

export interface AppQuickAction {
  href: string;
  label: string;
  permissions?: readonly PermissionKey[];
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
  permissions?: readonly PermissionKey[];
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
    domain: "control",
    href: "/calendar",
    icon: CalendarIcon,
    key: "calendar",
    label: "Agenda",
    paths: ["/calendar"],
    permissions: [
      PERMISSION_KEYS.CALENDAR_VIEW_OWN,
      PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
      PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
      PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
    ],
    quickActions: [{
      href: "/calendar/appointments/new",
      label: "Nuovo appuntamento",
      permissions: [
        PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
        PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
      ],
    }],
    tabs: [
      {
        href: "/calendar",
        label: "Agenda",
        permissions: [
          PERMISSION_KEYS.CALENDAR_VIEW_OWN,
          PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
          PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
          PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
        ],
      },
      {
        href: "/calendar/appointments/new",
        label: "Nuovo appuntamento",
        permissions: [
          PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
          PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
        ],
      },
    ],
  },
  {
    accent: "#0f766e",
    description: "Vendite, pagamenti e chiusura",
    domain: "control",
    href: "/sales",
    icon: SalesIcon,
    key: "sales",
    label: "Cassa",
    paths: ["/sales"],
    permissions: [
      PERMISSION_KEYS.REPORTS_VIEW_ALL,
      PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
      PERMISSION_KEYS.INVENTORY_MANAGE,
    ],
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
    permissions: [PERMISSION_KEYS.CLIENTS_VIEW, PERMISSION_KEYS.CLIENTS_EDIT],
    quickActions: [{
      href: "/clients/new",
      label: "Nuovo cliente",
      permissions: [PERMISSION_KEYS.CLIENTS_EDIT],
    }],
  },
  {
    accent: "#0369a1",
    description: "Team, ruoli e operatività",
    domain: "relationships",
    href: "/staff",
    icon: StaffIcon,
    key: "staff",
    label: "Staff",
    paths: ["/staff"],
    permissions: [
      PERMISSION_KEYS.SETTINGS_STAFF,
      PERMISSION_KEYS.CALENDAR_VIEW_OWN,
      PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
    ],
    quickActions: [{
      href: "/staff/new",
      label: "Nuovo collaboratore",
      permissions: [PERMISSION_KEYS.SETTINGS_STAFF],
    }],
    tabs: [
      { href: "/staff", label: "Operatività" },
      { href: "/staff/manage", label: "Collaboratori", permissions: [PERMISSION_KEYS.SETTINGS_STAFF] },
      { href: "/staff/permissions", label: "Permessi", permissions: [PERMISSION_KEYS.SETTINGS_STAFF] },
    ],
  },
  {
    accent: "#9333ea",
    description: "Catalogo, categorie e prezzi",
    domain: "relationships",
    href: "/services",
    icon: ServicesIcon,
    key: "services",
    label: "Servizi",
    paths: ["/services"],
    permissions: [
      PERMISSION_KEYS.SETTINGS_SERVICES,
      PERMISSION_KEYS.CALENDAR_VIEW_OWN,
      PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
      PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
      PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
    ],
    quickActions: [{
      href: "/services/new",
      label: "Nuovo servizio",
      permissions: [PERMISSION_KEYS.SETTINGS_SERVICES],
    }],
    tabs: [
      { href: "/services", label: "Catalogo" },
      { href: "/services/manage", label: "Gestione", permissions: [PERMISSION_KEYS.SETTINGS_SERVICES] },
    ],
  },
  {
    accent: "#b45309",
    description: "Emissione e utilizzo dei buoni",
    domain: "relationships",
    href: "/vouchers",
    icon: VouchersIcon,
    key: "vouchers",
    label: "Buoni acquisto",
    paths: ["/vouchers"],
    permissions: [
      PERMISSION_KEYS.CLIENTS_VIEW,
      PERMISSION_KEYS.REPORTS_VIEW_ALL,
      PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
      PERMISSION_KEYS.INVENTORY_MANAGE,
    ],
  },
  {
    accent: "#0e7490",
    description: "Sedi, ambienti e compatibilità servizi",
    domain: "relationships",
    href: "/cabins",
    icon: DoorIcon,
    key: "cabins",
    label: "Cabine",
    paths: ["/cabins"],
    permissions: [PERMISSION_KEYS.SETTINGS_SALON],
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
    permissions: [PERMISSION_KEYS.MARKETING_SEND],
    quickActions: [{
      href: "/marketing/new",
      label: "Nuova campagna",
      permissions: [PERMISSION_KEYS.MARKETING_SEND],
    }],
  },
  {
    accent: "#c026d3",
    description: "Punti, premi e fidelizzazione",
    domain: "growth",
    href: "/loyalty",
    icon: LoyaltyIcon,
    key: "loyalty",
    label: "Fedeltà",
    moduleKey: MODULE_KEYS.LOYALTY,
    paths: ["/loyalty"],
    permissions: [PERMISSION_KEYS.LOYALTY_MANAGE],
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
    permissions: [PERMISSION_KEYS.REVIEWS_REPLY, PERMISSION_KEYS.SETTINGS_SALON],
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
    permissions: [PERMISSION_KEYS.WAITLIST_MANAGE],
  },
  {
    accent: "#15803d",
    description: "Prodotti, giacenze e movimenti",
    domain: "control",
    href: "/inventory",
    icon: InventoryIcon,
    key: "inventory",
    label: "Magazzino",
    moduleKey: MODULE_KEYS.INVENTORY,
    paths: ["/inventory"],
    permissions: [PERMISSION_KEYS.INVENTORY_MANAGE],
    quickActions: [{
      href: "/inventory/new",
      label: "Nuovo prodotto",
      permissions: [PERMISSION_KEYS.INVENTORY_MANAGE],
    }],
  },
  {
    accent: "#0f766e",
    description: "Movimenti e andamento economico",
    domain: "control",
    href: "/accounting",
    icon: AccountingIcon,
    key: "accounting",
    label: "Contabilità",
    paths: ["/accounting"],
    permissions: [
      PERMISSION_KEYS.REPORTS_VIEW_ALL,
      PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
      PERMISSION_KEYS.INVENTORY_MANAGE,
    ],
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
    permissions: [PERMISSION_KEYS.REPORTS_VIEW_OWN, PERMISSION_KEYS.REPORTS_VIEW_ALL],
  },
  {
    accent: "#7e22ce",
    description: "Offerte composte e percorsi",
    domain: "control",
    href: "/packages",
    icon: PackagesIcon,
    key: "packages",
    label: "Pacchetti",
    moduleKey: MODULE_KEYS.PACKAGES,
    paths: ["/packages"],
    permissions: [
      PERMISSION_KEYS.CLIENTS_VIEW,
      PERMISSION_KEYS.CLIENTS_EDIT,
      PERMISSION_KEYS.SETTINGS_SERVICES,
      PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
    ],
  },
  {
    accent: "#475569",
    description: "Cronologia delle operazioni",
    domain: "control",
    href: "/settings/audit",
    icon: AuditIcon,
    key: "audit",
    label: "Attività",
    moduleKey: MODULE_KEYS.AUDIT_COMPLIANCE,
    paths: ["/settings/audit"],
    permissions: [PERMISSION_KEYS.SETTINGS_USERS],
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
    permissions: [
      PERMISSION_KEYS.SETTINGS_SALON,
      PERMISSION_KEYS.SETTINGS_SERVICES,
      PERMISSION_KEYS.SETTINGS_STAFF,
      PERMISSION_KEYS.SETTINGS_USERS,
      PERMISSION_KEYS.SETTINGS_MODULES,
    ],
    tabs: [
      {
        href: "/settings",
        label: "Salone",
        permissions: [PERMISSION_KEYS.SETTINGS_SALON],
      },
      {
        href: "/settings/users",
        label: "Team e accessi",
        permissions: [PERMISSION_KEYS.SETTINGS_USERS],
      },
      {
        href: "/settings/reminders",
        label: "Comunicazioni",
        permissions: [PERMISSION_KEYS.SETTINGS_SALON],
      },
      {
        href: "/settings/pwa",
        label: "App clienti",
        permissions: [PERMISSION_KEYS.SETTINGS_SALON],
      },
    ],
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

export function browserTitleForPath(pathname: string): string {
  const appLabel = pathname === "/apps" ? "Apps" : appForPath(pathname)?.label;
  return appLabel ? `${appLabel.toLocaleUpperCase("it-IT")} | EsseBeauty` : "EsseBeauty";
}

function hasPermission(
  requiredPermissions: readonly PermissionKey[] | undefined,
  grantedPermissions: ReadonlySet<PermissionKey | string>,
): boolean {
  return !requiredPermissions?.length
    || requiredPermissions.some((permission) => grantedPermissions.has(permission));
}

export function visibleApps(
  enabledModules: ReadonlySet<ModuleKey | string>,
  grantedPermissions: ReadonlySet<PermissionKey | string>,
): AppDefinition[] {
  return APP_REGISTRY.filter(
    (app) => (!app.moduleKey || enabledModules.has(app.moduleKey))
      && hasPermission(app.permissions, grantedPermissions),
  );
}

export function drawerApps(apps: readonly AppDefinition[]): AppDefinition[] {
  return apps.filter((app) => app.key !== "home");
}

export function visibleQuickActions(
  app: AppDefinition | undefined,
  grantedPermissions: ReadonlySet<PermissionKey | string>,
): AppQuickAction[] {
  return (app?.quickActions ?? []).filter((action) =>
    hasPermission(action.permissions, grantedPermissions));
}

export function visibleTabs(
  app: AppDefinition | undefined,
  grantedPermissions: ReadonlySet<PermissionKey | string>,
): AppTab[] {
  return (app?.tabs ?? []).filter((tab) =>
    hasPermission(tab.permissions, grantedPermissions));
}

export function contextTabsForPath(
  pathname: string,
  grantedPermissions: ReadonlySet<PermissionKey | string>,
): AppTab[] {
  return visibleTabs(appForPath(pathname), grantedPermissions);
}
