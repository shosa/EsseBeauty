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
});
