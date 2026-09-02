import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "app", "(dashboard)");

const requiredRoutes = [
  "calendar/appointments/new/page.tsx",
  "calendar/appointments/[appointmentId]/page.tsx",
  "inventory/new/page.tsx",
  "inventory/[productId]/page.tsx",
  "marketing/[campaignId]/page.tsx",
  "sales/page.tsx",
  "cabins/page.tsx",
  "services/manage/page.tsx",
  "services/new/page.tsx",
  "staff/manage/page.tsx",
  "packages/page.tsx",
  "loyalty/page.tsx",
  "loyalty/rewards/new/page.tsx",
];

describe("critical CRUD route contracts", () => {
  it("exposes direct page routes for critical CRUD entities", () => {
    for (const route of requiredRoutes) {
      expect(existsSync(join(appRoot, route)), route).toBe(true);
    }
  });

  it("does not auto-send a campaign from the new campaign page", () => {
    const source = readFileSync(join(appRoot, "marketing/new/page.tsx"), "utf8");
    expect(source).not.toContain("/send");
    expect(source).toContain("router.push(`/marketing/${campaign.id}`)");
  });

  it("confirms permitted appointment overlaps with a visual side-by-side preview", () => {
    const source = readFileSync(join(appRoot, "calendar/appointments/new/page.tsx"), "utf8");
    expect(source).toContain("confirm_overlap");
    expect(source).toContain("Conferma affiancamento");
    expect(source).toContain("Anteprima agenda");
    expect(source).toContain("Dialog");
    expect(source).toContain("strictAssignments=true");
    expect(source).toContain("Nessun collaboratore assegnato a questo servizio");
  });

  it("lets the wizard choose a compatible cabin and consume agenda prefill", () => {
    const source = readFileSync(join(appRoot, "calendar/appointments/new/page.tsx"), "utf8");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("resourceId");
    expect(source).toContain("Cabina");
    expect(source).toContain("settings/resources");
    expect(source).toContain("resource_id");
  });

  it("separates standalone cabin management from location settings", () => {
    const source = readFileSync(join(appRoot, "cabins/page.tsx"), "utf8");
    const locationsSource = readFileSync(join(appRoot, "settings/locations/page.tsx"), "utf8");

    expect(source).toContain("settings/resources");
    expect(source).toContain("Servizi compatibili");
    expect(source).toContain('method: "PUT"');
    expect(source).not.toContain("createLocation");
    expect(locationsSource).toContain("createLocation");
    expect(locationsSource).not.toContain("saveAssignments");
  });

  it("exposes catalog, team, packages and loyalty outside settings", () => {
    const registry = readFileSync(join(appRoot, "_components/app-registry.ts"), "utf8");
    const settings = readFileSync(join(appRoot, "settings/layout.tsx"), "utf8");

    expect(registry).toContain('href: "/services/manage"');
    expect(registry).toContain('href: "/staff/manage"');
    expect(registry).toContain('href: "/packages"');
    expect(registry).toContain('href: "/loyalty"');
    expect(settings).not.toContain('label: "Servizi"');
    expect(settings).not.toContain('label: "Pacchetti"');
    expect(settings).not.toContain('label: "Staff"');
    expect(settings).not.toContain('label: "Fedeltà"');
  });
});
