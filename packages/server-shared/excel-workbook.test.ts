import { describe, expect, it } from "vitest";

import { createWorkbook, excelContentType, styleWorksheet, workbookBuffer } from "./excel-workbook.js";

describe("Excel exports", () => {
  it("creates a real formatted xlsx workbook", async () => {
    const workbook = createWorkbook("Test");
    const sheet = workbook.addWorksheet("Dati");
    sheet.addRow(["Voce", "Importo"]);
    sheet.addRow(["Servizio", 42.5]);
    styleWorksheet(sheet, [2]);

    const buffer = await workbookBuffer(workbook);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.length).toBeGreaterThan(1_000);
    expect(excelContentType).toContain("spreadsheetml.sheet");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });
});
