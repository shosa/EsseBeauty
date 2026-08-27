import { describe, expect, it } from "vitest";

import { staffStatusAction } from "./app/(dashboard)/settings/staff/staff-status-action";

describe("staff directory status action", () => {
  it("offers one reversible action for active and inactive collaborators", () => {
    expect(staffStatusAction(true)).toEqual({
      confirmationRequired: true,
      label: "Disattiva",
      nextActive: false,
    });
    expect(staffStatusAction(false)).toEqual({
      confirmationRequired: false,
      label: "Riattiva",
      nextActive: true,
    });
  });
});
