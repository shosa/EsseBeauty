import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "app", "(dashboard)");

const requiredRoutes = [
  "settings/services/new/page.tsx",
  "settings/services/[serviceId]/page.tsx",
  "settings/staff/new/page.tsx",
  "settings/users/invite/page.tsx",
  "settings/loyalty/rewards/new/page.tsx",
  "settings/loyalty/rewards/[rewardId]/page.tsx",
];

describe("remaining CRUD route contracts", () => {
  it("exposes direct page routes for the remaining converted entities", () => {
    for (const route of requiredRoutes) {
      expect(existsSync(join(appRoot, route)), route).toBe(true);
    }
  });
});
