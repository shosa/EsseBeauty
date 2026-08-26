import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Drawer } from "@esse-beauty/ui";

import { CabinList, CabinSummary, CabinToolbarActions, filterCabins, toggleServiceAssignment } from "./app/(dashboard)/cabins/cabins-workspace";

const cabins = [
  { active: true, capacity: 2, id: "cabin-a", locationId: "location-a", name: "Cabina Viso", type: "cabin" },
  { active: false, capacity: 1, id: "cabin-b", locationId: "location-a", name: "Stanza Corpo", type: "room" },
  { active: true, capacity: 1, id: "cabin-c", locationId: "location-b", name: "Cabina Laser", type: "cabin" },
];

describe("cabins operational workspace", () => {
  it("combines location, status, and normalized search filters", () => {
    expect(filterCabins(cabins, { locationId: "location-a", query: "  VISo ", status: "active" }))
      .toEqual([cabins[0]]);

    expect(filterCabins(cabins, { locationId: "location-a", query: "stanza", status: "inactive" }))
      .toEqual([cabins[1]]);
  });

  it("adds and removes service assignments without duplicates", () => {
    expect(toggleServiceAssignment(["service-a"], "service-b")).toEqual(["service-a", "service-b"]);
    expect(toggleServiceAssignment(["service-a", "service-b"], "service-a")).toEqual(["service-b"]);
  });

  it("renders large operational cards with direct edit actions", () => {
    const html = renderToStaticMarkup(createElement(CabinList, {
      assignmentCounts: { "cabin-a": 3, "cabin-b": 0 },
      cabins: cabins.slice(0, 2),
      locationName: "Milano Centro",
      onSelect: () => undefined,
      onToggleActive: () => undefined,
      selectedCabinId: "",
    }));

    expect(html).toContain("Cabina Viso");
    expect(html).toContain("3 servizi");
    expect(html).toContain("Da configurare");
    expect(html).toContain("<article");
    expect(html).toContain('aria-label="Modifica Cabina Viso"');
    expect(html).toContain('aria-label="Disattiva Cabina Viso"');
    expect(html).toContain('aria-label="Configura Cabina Viso"');
    expect(html).toContain("lucide-power");
    expect(html).toContain("lucide-settings-2");
  });

  it("supports a wide drawer for service-heavy operational editors", () => {
    const html = renderToStaticMarkup(createElement(Drawer, {
      footer: createElement("button", null, "Salva modifiche"),
      onClose: () => undefined,
      open: true,
      size: "xl",
      title: "Configura cabina",
    }, createElement("div", null, "Servizi compatibili")));

    expect(html).toContain("max-w-3xl");
    expect(html).toContain("Servizi compatibili");
    expect(html).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(html).toContain("Salva modifiche");
    expect(html).toContain('aria-label="Chiudi"');
    expect(html).not.toMatch(/>\s*Chiudi\s*</);
  });

  it("uses a compact light summary instead of a second dark hero", () => {
    const html = renderToStaticMarkup(createElement(CabinSummary, {
      cabin: cabins[0],
      locationName: "Milano Centro",
      serviceCount: 3,
    }));

    expect(html).toContain("Milano Centro");
    expect(html).toContain('aria-label="3 servizi"');
    expect(html).toContain("Operativa");
    expect(html).not.toContain("bg-[#2d1d27]");
  });

  it("keeps the primary create action beside the visible result count", () => {
    const html = renderToStaticMarkup(createElement(CabinToolbarActions, {
      count: 4,
      onCreate: () => undefined,
    }));

    expect(html).toContain("4 ambienti");
    expect(html).toContain('aria-label="Nuova cabina"');
    expect(html).toContain("lucide-plus");
  });
});
