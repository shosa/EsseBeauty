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
});
