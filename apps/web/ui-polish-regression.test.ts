import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)");

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
      "services/new/page.tsx",
      "services/[serviceId]/page.tsx",
      "staff/new/page.tsx",
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

  it("keeps public booking searchable instead of dumping long lists", () => {
    const booking = readFileSync(join(process.cwd(), "..", "pwa", "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(booking).toContain("serviceQuery");
    expect(booking).toContain("Cerca servizio");
    expect(booking).toContain("Collaboratore preferito");
  });

  it("uses operational detail patterns on appointment pages", () => {
    const appointment = readFileSync(join(dashboardRoot, "calendar", "appointments", "[appointmentId]", "page.tsx"), "utf8");
    expect(appointment).toContain("PageHeader");
    expect(appointment).toContain("StatusBadge");
    expect(appointment).toContain("StatGrid");
    expect(appointment).toContain("ActionBar");
    expect(appointment).toContain("active={item.status === status}");
    expect(appointment).toContain("Elimina appuntamento");
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
    expect(platform).toContain("Gestisci moduli");
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
});
