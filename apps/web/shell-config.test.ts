import { describe, expect, it } from "vitest";

import {
  notificationTypeLabels,
  quickCreateActions,
  searchGroups,
} from "./app/(dashboard)/_components/shell-config.js";

describe("dashboard shell infrastructure config", () => {
  it("defines shell-first quick actions and grouped search targets", () => {
    expect(quickCreateActions.map((action) => action.href)).toEqual([
      "/calendar/appointments/new",
      "/clients/new",
      "/settings/services/new",
    ]);
    expect(searchGroups.map((group) => group.key)).toEqual([
      "customers",
      "appointments",
      "services",
      "staff",
      "campaigns",
      "products",
    ]);
  });

  it("names notification types that module integrations will publish later", () => {
    expect(notificationTypeLabels.inventory_low_stock).toBe("Scorta bassa");
    expect(notificationTypeLabels.review_pending).toBe("Recensione da gestire");
    expect(notificationTypeLabels.waitlist_match).toBe("Slot per lista d'attesa");
    expect(notificationTypeLabels.reminder_failed).toBe("Promemoria fallito");
  });
});
