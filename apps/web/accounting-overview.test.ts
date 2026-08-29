import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const accountingPage = readFileSync(join(process.cwd(), "app", "(dashboard)", "accounting", "page.tsx"), "utf8");

describe("accounting overview", () => {
  it("shows expenses, gross margin and period PDF export next to sales accounting", () => {
    expect(accountingPage).toContain("AccountingOverview");
    expect(accountingPage).toContain("/accounting/overview");
    expect(accountingPage).toContain("/accounting/report.pdf");
    expect(accountingPage).toContain("Spese per categoria");
    expect(accountingPage).toContain("Registro spese");
    expect(accountingPage).toContain("gross_margin_cents");
    expect(accountingPage).toContain("exportPdf");
  });
});
