import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)");

function dashboardPages(directory = dashboardRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return dashboardPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const checkedFiles = [
  "calendar/page.tsx",
  "clients/page.tsx",
  "clients/[customerId]/page.tsx",
  "inventory/_components/StockMovementModal.tsx",
  "reviews/page.tsx",
  "services/page.tsx",
  "settings/loyalty/page.tsx",
  "settings/users/page.tsx",
  "staff/page.tsx",
  "waitlist/page.tsx",
];

describe("professional UI regression guard", () => {
  it("keeps every dashboard page aligned to the cash-register workspace and dashboard radii", () => {
    for (const page of dashboardPages()) {
      const source = readFileSync(page, "utf8");
      if (source.includes("redirect(") && !source.includes("return (")) continue;
      expect(source, page).not.toContain("<main className=");
      expect(source, page).not.toContain("rounded-3xl");
      expect(source, page).not.toMatch(/rounded-\[(?!2rem)[^\]]+\]/);
      expect(source, page).toContain('maxWidth="max-w-[1600px]"');
    }
  });

  it("uses the refreshed brand typography and breadcrumb treatment", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
    const ui = readFileSync(join(process.cwd(), "..", "..", "packages", "ui", "index.tsx"), "utf8");
    expect(layout).toContain("Manrope");
    expect(layout).toContain("Fraunces");
    expect(ui).toContain("›");
    expect(ui).toContain("backdrop-blur");
  });

  it("gives active CTAs an explicit hand cursor and tactile hover state", () => {
    const globals = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    const ui = readFileSync(join(process.cwd(), "..", "..", "packages", "ui", "index.tsx"), "utf8");
    expect(ui).toContain("cursor-pointer");
    expect(ui).toContain("shadow-[0_10px_24px");
    expect(globals).toContain('@source "../../../packages/ui"');
    expect(globals).toContain("button:not(:disabled)");
    expect(globals).toContain("a[href]");
    expect(globals).toContain("cursor: pointer");
  });

  it("does not use browser confirm in dashboard workflows", () => {
    for (const file of checkedFiles) {
      const source = readFileSync(join(dashboardRoot, file), "utf8");
      expect(source, file).not.toContain("window.confirm");
    }
  });

  it("does not render custom fixed CRUD modals outside shared primitives", () => {
    for (const file of checkedFiles) {
      const source = readFileSync(join(dashboardRoot, file), "utf8");
      expect(source, file).not.toContain("grid place-items-center bg-black");
      expect(source, file).not.toContain("fixed inset-0 z-50");
    }
  });

  it("does not keep old inline create modal state names in converted pages", () => {
    for (const file of ["calendar/page.tsx", "services/page.tsx", "settings/users/page.tsx", "staff/page.tsx"]) {
      const source = readFileSync(join(dashboardRoot, file), "utf8");
      expect(source, file).not.toMatch(/createOpen|inviteOpen|setOpen\(/);
    }
  });

  it("keeps CRUD forms labelled and appointment customer lookup scalable", () => {
    for (const file of [
      "settings/services/new/page.tsx",
      "settings/services/[serviceId]/page.tsx",
      "settings/staff/new/page.tsx",
      "settings/users/invite/page.tsx",
      "settings/loyalty/rewards/new/page.tsx",
      "settings/loyalty/rewards/[rewardId]/page.tsx",
    ]) {
      const source = readFileSync(join(dashboardRoot, file), "utf8");
      expect(source, file).toContain("FormField");
    }

    const appointmentNew = readFileSync(join(dashboardRoot, "calendar", "appointments", "new", "page.tsx"), "utf8");
    expect(appointmentNew).toContain("selectedCustomer");
    expect(appointmentNew).toContain("customers?${params");
    expect(appointmentNew).not.toContain('fetch(`${api}/api/salons/${salon.id}/customers`)');
  });

  it("guides public booking through categories and compact staff choices", () => {
    const booking = readFileSync(join(process.cwd(), "..", "pwa", "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(booking).toContain("const [category");
    expect(booking).toContain("Preferenza staff");
    expect(booking).toContain("firstName(member.displayName)");
    expect(booking).not.toContain('<select id="staff"');
  });

  it("uses operational detail patterns in the appointment curtain", () => {
    const appointment = readFileSync(join(dashboardRoot, "calendar", "_components", "AppointmentDetailPanel.tsx"), "utf8");
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(appointment).toContain("StatusBadge");
    expect(appointment).toContain("Composizione del conto");
    expect(appointment).toContain("Dividi pagamento");
    expect(appointment).toContain("completeCheckout");
    expect(appointment).toContain("Incassa");
    expect(appointment).toContain("Elimina appuntamento");
    expect(calendar).toContain("appointment-curtain");
    expect(calendar).toContain("AppointmentDetailPanel");
  });

  it("uses the shared page header on primary dashboard views", () => {
    for (const file of ["page.tsx", "calendar/page.tsx", "clients/page.tsx", "services/page.tsx", "staff/page.tsx"]) {
      const source = readFileSync(join(dashboardRoot, file), "utf8");
      expect(source, file).toContain("PageHeader");
      expect(source, file).toContain("AppPage");
    }
  });

  it("keeps salon module settings read-only and delegates activation to the central configurator", () => {
    const salonModules = readFileSync(join(dashboardRoot, "settings", "modules", "page.tsx"), "utf8");
    const platform = readFileSync(join(process.cwd(), "app", "platform", "page.tsx"), "utf8");
    expect(salonModules).not.toContain("method: \"PATCH\"");
    expect(salonModules).not.toContain("setModule(");
    expect(salonModules).toContain("aggiorna il piano del salone");
    expect(salonModules).toContain("Moduli inclusi");
    expect(platform).toContain("/api/platform/salons");
    expect(platform).toContain("modules/${featureKey}");
    expect(platform).toContain("Moduli abilitati");
  });

  it("does not auto-open a salon card before an explicit selection", () => {
    const platform = readFileSync(join(process.cwd(), "app", "platform", "page.tsx"), "utf8");
    expect(platform).toContain("const [selectedSalonId, setSelectedSalonId] = useState(\"\")");
    expect(platform).toContain("function closeSalonCard()");
    expect(platform).toContain("onClick={closeSalonCard}");
    expect(platform).toContain("panel !== \"new\" && !selectedSalon");
    expect(platform).not.toContain("?? salons[0]");
    expect(platform).not.toContain("setSelectedSalonId(rows[0]");
  });

  it("uses one persistent dashboard side navigation instead of separate rail and sidebar blocks", () => {
    const shell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");
    expect(shell).toContain("UnifiedSideNavigation");
    expect(shell).toContain("navigation_collapsed");
    expect(shell).toContain("/api/salons/${salon.id}/shell-preferences");
    expect(shell).toContain("md:pl-[var(--shell-nav-width)]");
    expect(shell).toContain("md:left-[var(--shell-nav-width)]");
    expect(shell).toContain("overflow-y-auto");
    expect(shell).toContain("SidebarToggleIcon");
    expect(shell).toContain("BellIcon");
    expect(shell).not.toContain('<span className="font-black">N</span>');
    expect(shell).not.toContain(">\\n              N\\n");
    expect(shell).not.toContain("onToggle");
    expect(shell).not.toContain("function RailLink");
    expect(shell).not.toContain("left-20");
    expect(shell).not.toContain("md:pl-[344px]");
  });

  it("uses the Connected Workspace contract across shell, pages, and settings", () => {
    const shell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");
    const settings = readFileSync(join(dashboardRoot, "settings", "layout.tsx"), "utf8");
    const dashboard = readFileSync(join(dashboardRoot, "page.tsx"), "utf8");
    const ui = readFileSync(join(process.cwd(), "..", "..", "packages", "ui", "index.tsx"), "utf8");
    const globals = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

    expect(ui).toContain("esse-workspace-page");
    expect(ui).toContain("esse-page-header");
    expect(ui).toContain("esse-panel");
    expect(globals).toContain(".esse-workspace");
    expect(shell).toContain("workspaceSections");
    expect(shell).toContain("currentSection");
    expect(shell).toContain("bg-[#35212e]");
    expect(settings).toContain("Impostazioni salone");
    expect(settings).toContain("rounded-2xl border");
    expect(dashboard).toContain("Da fare");
    expect(dashboard).toContain("/notifications");
    expect(dashboard).not.toContain("function StatCard");
    expect(dashboard).not.toContain("function ModuleCount");
  });

  it("keeps the staff PWA as a separate installable workspace, not a dashboard menu page", () => {
    const shell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");
    const staffPackage = readFileSync(join(process.cwd(), "..", "staff-pwa", "package.json"), "utf8");
    const staffApp = readFileSync(join(process.cwd(), "..", "staff-pwa", "app", "page.tsx"), "utf8");
    const staffManifest = readFileSync(join(process.cwd(), "..", "staff-pwa", "app", "manifest.ts"), "utf8");
    expect(shell).not.toContain("/staff-pwa");
    expect(staffPackage).toContain("@esse-beauty/staff-pwa");
    expect(staffPackage).toContain("next-pwa");
    expect(staffApp).toContain("/api/staff-app/me");
    expect(staffApp).toContain("/api/staff-app/appointments");
    expect(staffManifest).toContain("EsseBeauty Staff");
  });

  it("splits operational Staff and Services from core configuration pages", () => {
    const staff = readFileSync(join(dashboardRoot, "staff", "page.tsx"), "utf8");
    const services = readFileSync(join(dashboardRoot, "services", "page.tsx"), "utf8");
    const settingsStaff = readFileSync(join(dashboardRoot, "settings", "staff", "page.tsx"), "utf8");
    const settingsServices = readFileSync(join(dashboardRoot, "settings", "services", "page.tsx"), "utf8");
    const appointmentNew = readFileSync(join(dashboardRoot, "calendar", "appointments", "new", "page.tsx"), "utf8");
    expect(staff).toContain("/operations/staff");
    expect(staff).toContain("Assenza last-minute");
    expect(staff).not.toContain("/staff/new");
    expect(staff).not.toContain("method: \"DELETE\"");
    expect(services).toContain("/operations/services");
    expect(services).not.toContain("/services/new");
    expect(services).not.toContain("method: \"PATCH\"");
    expect(settingsStaff).toContain("/settings/staff/new");
    expect(settingsStaff).toContain("/api/salons/${salon.id}/staff");
    expect(settingsServices).toContain("/settings/services/new");
    expect(settingsServices).toContain("/api/salons/${salon.id}/services");
    expect(appointmentNew).toContain("/operations/services");
    expect(appointmentNew).toContain("/operations/staff");
  });

  it("does not expose fake settings panels without persisted behavior", () => {
    const settings = readFileSync(join(dashboardRoot, "settings", "page.tsx"), "utf8");
    expect(settings).not.toContain("Configurazione persistente disponibile via API centro controllo");
    expect(settings).not.toContain("Infrastruttura persistente gia pronta");
    expect(settings).not.toMatch(/prossimamente|coming soon|mock|demo/i);
  });

  it("uses persisted calendar rules in the professional calendar surface", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("/settings/control-center");
    expect(calendar).toContain("defaultView");
    expect(calendar).toContain("minSlotMinutes");
    expect(calendar).toContain("bufferMinutes");
    expect(calendar).toContain("staff_columns");
    expect(calendar).toContain("StatusBadge");
    expect(calendar).toContain("navigatorDays");
    expect(calendar).toContain("Cerca cliente, servizio o collaboratore");
  });

  it("supports staff PWA access, visible availability blocks, salon closures, and Italian weekdays", () => {
    const staffDetail = readFileSync(join(dashboardRoot, "settings", "staff", "[staffId]", "page.tsx"), "utf8");
    const settings = readFileSync(join(dashboardRoot, "settings", "page.tsx"), "utf8");
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const shared = readFileSync(join(process.cwd(), "..", "..", "packages", "shared", "index.ts"), "utf8");

    expect(staffDetail).toContain("Accesso App Staff");
    expect(staffDetail).toContain("/access");
    expect(staffDetail).toContain("ScheduleEditor");
    expect(staffDetail).not.toContain('["mon", "tue", "wed", "thu", "fri", "sat", "sun"]');

    expect(settings).toContain("Giorni di chiusura");
    expect(settings).toContain("/settings/closures");

    expect(calendar).toContain("availability_blocks");
    expect(calendar).toContain("salon_closures");
    expect(calendar).toContain("Non disponibile");
    expect(calendar).toContain("Chiusura salone");

    expect(shared).toContain("WEEK_DAYS_IT");
    expect(shared).toContain("formatWeekdayIt");
  });
});
