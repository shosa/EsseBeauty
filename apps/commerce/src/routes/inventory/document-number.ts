import { and, eq, like, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { inventoryDocuments } from "@esse-beauty/db/schema";

import type { WarehouseDocumentKind } from "./warehouse-types.js";

const prefixes: Record<WarehouseDocumentKind, string> = {
  adjustment: "RET",
  count: "INV",
  credit_note: "NDC",
  equipment_purchase: "ATT",
  expense: "SPE",
  internal_use: "CON",
  opening: "INI",
  purchase: "CAR",
  supplier_invoice: "FAT",
  supplier_return: "RES",
  waste: "SCA",
};

export async function nextInventoryDocumentNumber(
  executor: DrizzleDB,
  input: { date: Date; kind: WarehouseDocumentKind; salonId: string },
) {
  const year = input.date.getUTCFullYear();
  const base = `${prefixes[input.kind]}-${year}-`;
  await executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${input.salonId}:${base}`}, 0))`);
  const rows = await executor
    .select({ internalNumber: inventoryDocuments.internalNumber })
    .from(inventoryDocuments)
    .where(and(
      eq(inventoryDocuments.salonId, input.salonId),
      like(inventoryDocuments.internalNumber, `${base}%`),
    ));
  const lastSequence = rows.reduce((maximum, row) => {
    const match = row.internalNumber.match(new RegExp(`^${base}(\\d+)$`));
    return match ? Math.max(maximum, Number.parseInt(match[1]!, 10)) : maximum;
  }, 0);
  return `${base}${String(lastSequence + 1).padStart(4, "0")}`;
}
