import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)");
const sharedUi = join(process.cwd(), "..", "..", "packages", "ui", "index.tsx");

function dashboardPages(directory = dashboardRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return dashboardPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function dashboardLayoutSource(page: string): string {
  const source = readFileSync(page, "utf8");
  const reExport = source.match(/export \{ default \} from ["'](.+)["']/);
  if (reExport?.[1]) return dashboardLayoutSource(join(dirname(page), `${reExport[1]}.tsx`));
  if (source.includes("<WarehouseWorkspace")) return readFileSync(join(dirname(page), "warehouse-workspace.tsx"), "utf8");
  return source;
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
  it("uses an X instead of the Chiudi text in standard dialogs", () => {
    const ui = readFileSync(sharedUi, "utf8");
    const dialog = ui.slice(ui.indexOf("export function Dialog"), ui.indexOf("export function Drawer"));
    expect(dialog).toContain('aria-label="Chiudi"');
    expect(dialog).toContain('<X aria-hidden="true"');
    expect(dialog).not.toMatch(/>\s*Chiudi\s*</);
  });

  it("keeps every dashboard page aligned to the cash-register workspace and dashboard radii", () => {
    for (const page of dashboardPages()) {
      const layoutSource = dashboardLayoutSource(page);
      if (layoutSource.includes("redirect(") && !layoutSource.includes("return (")) continue;
      expect(layoutSource, page).not.toContain("<main className=");
      expect(layoutSource, page).not.toContain("rounded-3xl");
      expect(layoutSource, page).not.toMatch(/rounded-\[(?!2rem)[^\]]+\]/);
      expect(layoutSource, page).toContain('maxWidth="max-w-[1600px]"');
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
    expect(appointment).toContain('aria-label="Annulla modifica appuntamento"');
    expect(appointment).not.toContain('editingAppointment ? "Chiudi modifica"');
    expect(appointment).not.toContain('title="Chiudi modifica"');
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

  it("keeps module activation in the central configurator", () => {
    const settingsLayout = readFileSync(join(dashboardRoot, "settings", "layout.tsx"), "utf8");
    const dashboardShell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");
    const platform = readFileSync(join(process.cwd(), "..", "platform", "app", "page.tsx"), "utf8");
    expect(existsSync(join(dashboardRoot, "settings", "modules", "page.tsx"))).toBe(false);
    expect(settingsLayout).not.toContain("/settings/modules");
    expect(dashboardShell).not.toContain("/settings/modules");
    expect(platform).toContain("/api/platform/salons");
    expect(platform).toContain("modules/${key}");
    expect(platform).toContain("Moduli");
  });

  it("does not auto-open a salon card before an explicit selection", () => {
    const platform = readFileSync(join(process.cwd(), "..", "platform", "app", "page.tsx"), "utf8");
    expect(platform).toContain("const [selected, setSelected] = useState<PlatformSalon | null>(null)");
    expect(platform).toContain("onClick={() => onOpen(salon)}");
    expect(platform).toContain("{selected && <TenantDrawer");
    expect(platform).not.toContain("?? salons[0]");
  });

  it("uses the app rail, directory page, and contextual workspace shell", () => {
    const shell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");
    expect(shell).toContain("<AppRail");
    expect(shell).not.toContain("<AppLauncher");
    expect(existsSync(join(dashboardRoot, "apps", "page.tsx"))).toBe(true);
    expect(shell).toContain("<WorkspaceTopbar");
    expect(shell).toContain("<MobileAppNavigation");
    expect(shell).toContain("md:pl-[76px]");
    expect(shell).not.toContain("<UnifiedSideNavigation");
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
    expect(shell).toContain("visibleApps");
    expect(shell).toContain("currentApp");
    expect(shell).toContain("WorkspaceTopbar");
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
    expect(settingsServices).toContain("/services/new");
    expect(settingsServices).toContain("/api/salons/${salon.id}/services");
    expect(appointmentNew).toContain("/operations/services");
    expect(appointmentNew).toContain("/operations/staff");
  });

  it("uses the consolidated icon CTA pattern in the collaborators workspace", () => {
    const collaborators = readFileSync(join(dashboardRoot, "settings", "staff", "page.tsx"), "utf8");
    expect(collaborators).toContain("PageHeader");
    expect(collaborators).toContain("ExpandableAction");
    expect(collaborators).toContain('label="Nuovo collaboratore"');
    expect(collaborators).toContain('label={`Configura ${member.displayName}`}');
    expect(collaborators).toContain("staffStatusAction(member.active).label");
    expect(collaborators).not.toContain("size-[52px]");
  });

  it("uses the consolidated header and icon CTA pattern in service management", () => {
    const services = readFileSync(join(dashboardRoot, "settings", "services", "page.tsx"), "utf8");
    const ui = readFileSync(sharedUi, "utf8");
    expect(services).toContain("PageHeader");
    expect(services).toContain("ExpandableAction");
    expect(services).toContain('label="Nuova categoria"');
    expect(services).toContain('label="Nuovo servizio"');
    expect(services).toContain('label="Modifica categoria"');
    expect(services).toContain('label={`Apri servizio ${item.name}`}');
    expect(services).toContain('label={`Archivia servizio ${item.name}`}');
    expect(services).not.toMatch(/>\s*Modifica categoria\s*<\/button>/);
    expect(services).not.toMatch(/>\s*Apri\s*<\/Link>/);
    expect(ui).toContain("const activeHref = items");
    expect(ui).toContain("right.href.length - left.href.length");
  });

  it("does not expose fake settings panels without persisted behavior", () => {
    const settings = readFileSync(join(dashboardRoot, "settings", "page.tsx"), "utf8");
    expect(settings).not.toContain("Configurazione persistente disponibile via API centro controllo");
    expect(settings).not.toContain("Infrastruttura persistente gia pronta");
    expect(settings).not.toMatch(/prossimamente|coming soon|mock|demo/i);
  });

  it("uses persisted calendar rules in the professional calendar surface", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const settings = readFileSync(join(dashboardRoot, "settings", "page.tsx"), "utf8");
    expect(calendar).toContain("/settings/control-center");
    expect(calendar).toContain("defaultView");
    expect(calendar).toContain("minSlotMinutes");
    expect(calendar).toContain("bufferMinutes");
    expect(calendar).toContain("staff_columns");
    expect(calendar).toContain("StatusBadge");
    expect(calendar).toContain("navigatorDays");
    expect(calendar).toContain("Cerca cliente, servizio o collaboratore");
    expect(calendar).toContain('useState<CalendarView>("day")');
    expect(calendar).toContain('calendar.defaultView ?? "day"');
    expect(settings).toContain('control.calendar?.defaultView ?? "day"');
  });

  it("uses scalable appointment choices and lays overlapping events side by side", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const appointmentForm = readFileSync(join(dashboardRoot, "calendar", "appointments", "new", "page.tsx"), "utf8");
    expect(appointmentForm).toContain("service-categories?active=true");
    expect(appointmentForm).toContain("ServiceCategoryIcon");
    expect(appointmentForm).toContain("Cerca servizio");
    expect(appointmentForm).toContain("Cerca collaboratore");
    expect(appointmentForm).not.toContain("<select");
    expect(calendar).toContain("collisionLayout");
    expect(calendar).toContain("columnCount");
    expect(calendar).toContain("...horizontal");
    expect(calendar).toContain('{ key: "resources", label: "Cabine" }');
    expect(calendar).toContain("resource_name");
    expect(calendar).toContain("resourceColumns");
    expect(calendar).toContain("formatResourceLabel");
    expect(calendar).not.toContain('borderLeft: `4px solid');
    expect(calendar).toContain("confirmedAppointment");
    expect(calendar).toContain("linear-gradient(135deg");
    expect(calendar).toContain("palette?.background");
    expect(calendar).toContain("appointmentStatusInitial");
    expect(calendar).toContain('confirmed: "C"');
    expect(calendar).toContain('pending: "A"');
    expect(calendar).toContain('no_show: "N"');
    expect(calendar).toContain('cancelled: "X"');
    expect(calendar).not.toContain("{appointmentStatusLabel(item.status ?? \"confirmed\")}</span>");
    expect(calendar).toContain("const hourHeight = 112");
    expect(calendar).toContain("min-h-14");
  });

  it("guides POS service sales through categories before services", () => {
    const sales = readFileSync(join(dashboardRoot, "sales", "page.tsx"), "utf8");
    expect(sales).toContain("ServiceCategoryIcon");
    expect(sales).toContain("selectedServiceCategoryId");
    expect(sales).toContain("serviceCategories");
    expect(sales).toContain("Scegli una categoria");
    expect(sales).toContain("Cambia categoria");
    expect(sales).toContain("resetServiceCatalogStep");
    expect(sales).toContain("category_icon");
    expect(sales).toContain("category_id");
  });

  it("lets POS recall today's agenda appointments into checkout", () => {
    const sales = readFileSync(join(dashboardRoot, "sales", "page.tsx"), "utf8");
    expect(sales).toContain("Agenda di oggi");
    expect(sales).toContain("todayAppointments");
    expect(sales).toContain("agendaExpanded");
    expect(sales).toContain("appointmentsByStaff");
    expect(sales).toContain("setAgendaExpanded(false)");
    expect(sales).toContain("appointment.color");
    expect(sales).toContain("overflow-x-auto");
    expect(sales).toContain("min-w-[210px]");
    expect(sales).toContain("min-h-[74px]");
    expect(sales).toContain("loadTodayAppointments");
    expect(sales).toContain("Array.isArray(result)");
    expect(sales).toContain("loadAppointmentCheckout");
    expect(sales).toContain("selectedAppointmentId");
    expect(sales).toContain('/appointments/${selectedAppointmentId}/checkout');
    expect(sales).toContain('/appointments/${appointmentId}/checkout');
  });

  it("keeps POS cash register separate from accounting registers and stats", () => {
    const sales = readFileSync(join(dashboardRoot, "sales", "page.tsx"), "utf8");
    const accounting = readFileSync(join(dashboardRoot, "accounting", "page.tsx"), "utf8");
    const shell = readFileSync(join(dashboardRoot, "_components", "DashboardShell.tsx"), "utf8");

    expect(sales).not.toContain('["sales", "Registro vendite"]');
    expect(sales).not.toContain('["stats", "Statistiche"]');
    expect(sales).not.toContain('tab === "sales"');
    expect(sales).not.toContain('tab === "stats"');
    expect(accounting).toContain("Registro vendite");
    expect(accounting).toContain("Metodi di pagamento");
    expect(accounting).toContain("Spese per categoria");
    expect(accounting).toContain("Registro spese");
    expect(accounting).toContain("gross_margin_cents");
    expect(accounting).toContain("accounting/report.pdf");
    expect(accounting).toContain("exportPdf");
    expect(accounting).toContain("exportRegister");
    expect(accounting).toContain("preset");
    expect(accounting).toContain("openSale");
    expect(shell).toContain('href: "/accounting"');
    expect(shell).toContain('label: "Contabilita"');
  });

  it("compresses global non-working calendar gaps and keeps POS catalog actions iconized", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const sales = readFileSync(join(dashboardRoot, "sales", "page.tsx"), "utf8");
    expect(calendar).toContain("buildTimelineCompression");
    expect(calendar).toContain("timelineCompressedGapMarkers");
    expect(calendar).toContain("timelineCompression.minutesAtY");
    expect(calendar).toContain("timelineHeight");
    expect(sales).toContain("Scissors");
    expect(sales).toContain("ShoppingBag");
    expect(sales).toContain("Package");
    expect(sales).toContain("Gift");
  });

  it("requires confirmation for drag moves and exposes contextual agenda actions", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("DndContext");
    expect(calendar).toContain("pendingMove");
    expect(calendar).toContain("Conferma spostamento");
    expect(calendar).toContain("Nuovo appuntamento qui");
    expect(calendar).toContain("Duplica");
    expect(calendar).toContain("Cambia stato");
    expect(calendar).toContain("Elimina");
  });

  it("opens a dedicated move editor from the appointment context menu", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("moveDraft");
    expect(calendar).toContain('title="Sposta appuntamento"');
    expect(calendar).toContain('aria-label="Nuova data"');
    expect(calendar).toContain('aria-label="Nuovo orario"');
    expect(calendar).toContain('aria-label="Nuovo collaboratore"');
    expect(calendar).toContain('aria-label="Nuova cabina"');
    expect(calendar).toContain("prepareMoveConfirmation");
    expect(calendar).toMatch(/>\s*Continua\s*</);
  });

  it("shows the dragged appointment, resolves the real drop position, and isolates context menus", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("translate3d");
    expect(calendar).toContain("event.active.rect.current.translated");
    expect(calendar).toContain("event.over.rect.top");
    expect(calendar).toContain("event.stopPropagation()");
    expect(calendar).toContain('onContextMenu={(event) => event.preventDefault()}');
  });

  it("closes contextual menus after actions and when the pointer leaves", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("onMouseLeave={() => setContextMenu(undefined)}");
    expect(calendar).toContain("closeContextMenuAnd");
  });

  it("suppresses the synthetic click emitted after dragging an appointment", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("suppressClickUntilRef");
    expect(calendar).toContain("onDragStart");
    expect(calendar).toContain("onClickCapture");
    expect(calendar).toContain("Date.now() < suppressClickUntilRef.current");
    expect(calendar).toContain("event.preventDefault()");
  });

  it("keeps drag movement immediate while animating lift and shadow", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    expect(calendar).toContain("translate3d");
    expect(calendar).toContain("scale(1.025)");
    expect(calendar).toContain('transition: draggable.isDragging ? "box-shadow 140ms ease, opacity 140ms ease"');
    expect(calendar).toContain('willChange: "transform"');
  });

  it("shares status workflow rules and disables dragging final appointments", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const detail = readFileSync(join(dashboardRoot, "calendar", "_components", "AppointmentDetailPanel.tsx"), "utf8");
    expect(calendar).toContain("nextAppointmentStatuses");
    expect(calendar).toContain("manualContextStatusActions");
    expect(calendar).toContain('const manualContextStatuses = new Set(["pending", "confirmed", "no_show", "cancelled"])');
    expect(calendar).toContain('status !== "completed"');
    expect(calendar).toContain("manualContextStatuses.has(status)");
    expect(calendar).toContain("clampedContextMenuPosition");
    expect(calendar).toContain("isAppointmentDragDisabled");
    expect(calendar).toContain("disabled: isAppointmentDragDisabled(item.status)");
    expect(detail).toContain("nextAppointmentStatuses");
    expect(detail).not.toContain('"completed", "no_show", "cancelled"');
    expect(detail).not.toContain('["pending", "confirmed", "completed"');
  });

  it("closes appointment delete confirmations after successful delete", () => {
    const calendar = readFileSync(join(dashboardRoot, "calendar", "page.tsx"), "utf8");
    const detail = readFileSync(join(dashboardRoot, "calendar", "_components", "AppointmentDetailPanel.tsx"), "utf8");
    expect(calendar).toContain("setDeleteTarget(undefined)");
    expect(detail.replaceAll("\r\n", "\n")).toContain("setConfirmDelete(false);\n    onChanged?.();");
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

  it("mirrors the client detail hero and tab pattern in the staff detail page", () => {
    const staffDetail = readFileSync(join(dashboardRoot, "settings", "staff", "[staffId]", "page.tsx"), "utf8");
    expect(staffDetail).not.toContain("SectionCard");
    expect(staffDetail).not.toContain("PageHeader");
    expect(staffDetail).toContain("PageTransition");
    expect(staffDetail).toContain('Breadcrumbs items={[{ href: "/staff", label: "Staff" }');
    expect(staffDetail).toContain('useState<TabKey>("profile")');
    expect(staffDetail).toContain("staffStatusAction(member.active)");
    expect(staffDetail).toContain("ConfirmDialog");
    expect(staffDetail).toContain("Servizi abilitati");
    expect(staffDetail).toContain("Giorni lavorativi");
    expect(staffDetail).toContain("WEEK_DAYS_IT");
  });
});
