import { describe, expect, it } from "vitest";

import { MODULE_GROUPS } from "./app/moduli/module-catalog";

describe("complete EsseBeauty module catalog", () => {
  it("covers every approved operational area with concrete modules", () => {
    expect(MODULE_GROUPS.map((group) => group.title)).toEqual([
      "Agenda e operatività",
      "Clienti e fidelizzazione",
      "Team e risorse",
      "Cassa e vendite",
      "Magazzino e acquisti",
      "Marketing e WhatsApp",
      "Recensioni e documenti",
      "Report e amministrazione",
    ]);
    expect(MODULE_GROUPS.every((group) => group.modules.length >= 3)).toBe(true);
    expect(new Set(MODULE_GROUPS.map((group) => group.id)).size).toBe(8);
  });

  it("keeps every module explanation and capability list useful", () => {
    for (const group of MODULE_GROUPS) {
      expect(group.description.length).toBeGreaterThan(55);
      for (const module of group.modules) {
        expect(module.description.length).toBeGreaterThan(45);
        expect(module.capabilities.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
