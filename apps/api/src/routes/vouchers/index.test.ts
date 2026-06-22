import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("purchase vouchers", () => {
  const routeSource = readFileSync(join(process.cwd(), "src", "routes", "vouchers", "index.ts"), "utf8");
  const salesSource = readFileSync(join(process.cwd(), "src", "routes", "sales", "index.ts"), "utf8");
  const helperSource = readFileSync(join(process.cwd(), "src", "lib", "purchase-vouchers.ts"), "utf8");

  it("supports customer-linked issue, partial redemption and movement history", () => {
    expect(routeSource).toContain('"/api/salons/:id/vouchers"');
    expect(routeSource).toContain("purchaseVoucherMovements");
    expect(salesSource).toContain("issued_vouchers");
    expect(salesSource).toContain("redeemPurchaseVoucher");
    expect(helperSource).toContain('status: balanceAfter === 0 ? "exhausted" : "active"');
    expect(helperSource).toContain("VOUCHER_INSUFFICIENT_BALANCE");
    expect(helperSource).toContain("VOUCHER_CUSTOMER_MISMATCH");
  });
});
