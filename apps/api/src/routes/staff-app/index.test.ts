import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("staff app route contract", () => {
  it("derives the staff scope from the authenticated user", () => {
    const source = readFileSync(join(process.cwd(), "src", "routes", "staff-app", "index.ts"), "utf8");
    expect(source).toContain("eq(staff.userId, request.user.id)");
    expect(source).toContain("eq(staff.salonId, request.salonId)");
    expect(source).toContain("/api/staff-app/appointments");
    expect(source).toContain("/api/staff-app/availability-requests");
    expect(source).toContain("PERMISSION_KEYS.CALENDAR_VIEW_OWN");
    expect(source).toContain("PERMISSION_KEYS.CALENDAR_MANAGE_OWN");
    expect(source).toContain("PERMISSION_KEYS.REPORTS_VIEW_OWN");
    expect(source).not.toContain("Querystring: { staffId");
  });
});
