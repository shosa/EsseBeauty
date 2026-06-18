import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("staff request notification integration", () => {
  it("creates and repairs review notifications through one idempotent helper", () => {
    const helper = readFileSync(join(process.cwd(), "src", "jobs", "staff-request-notifications.ts"), "utf8");
    const staffAppRoute = readFileSync(join(process.cwd(), "src", "routes", "staff-app", "index.ts"), "utf8");
    const shellRoute = readFileSync(join(process.cwd(), "src", "routes", "shell", "index.ts"), "utf8");

    expect(helper).toContain('const REVIEW_ROLES = ["owner", "manager"] as const');
    expect(helper).toContain('eq(staffAvailabilityRequests.status, "pending")');
    expect(helper).toContain("existingRoles.has(role)");
    expect(helper).toContain('type: "staff_availability_request"');
    expect(staffAppRoute).toContain("ensureStaffRequestReviewNotifications(app, request.salonId, requestRow.id)");
    expect(shellRoute).toContain("ensureStaffRequestReviewNotifications(app, request.salonId)");
  });

  it("creates and repairs notifications for bookings received from the customer PWA", () => {
    const helper = readFileSync(join(process.cwd(), "src", "jobs", "staff-request-notifications.ts"), "utf8");
    const publicRoute = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");
    const shellRoute = readFileSync(join(process.cwd(), "src", "routes", "shell", "index.ts"), "utf8");

    expect(helper).toContain('eq(appointments.source, "online")');
    expect(helper).toContain('type: "online_booking_received"');
    expect(helper).toContain("ensureOnlineBookingNotifications");
    expect(publicRoute).toContain("ensureOnlineBookingNotifications(app, salon.id, appointment.id)");
    expect(shellRoute).toContain("ensureOnlineBookingNotifications(app, request.salonId)");
  });
});
