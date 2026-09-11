import { describe, expect, it } from "vitest";

import { disposeAsset, registerAssetPurchase, type AssetCommandRepository, type AssetCommandTransaction } from "./asset-service.js";

function repo(): AssetCommandRepository & { state: { assets: Array<Record<string, unknown>>; cashMovements: unknown[]; documents: unknown[]; movements: unknown[]; products: unknown[] } } {
  const state = {
    assets: [{ id: "asset-1", salonId: "salon-1", status: "active" }] as Array<Record<string, unknown>>,
    cashMovements: [] as unknown[],
    documents: [] as unknown[],
    movements: [] as unknown[],
    products: [] as unknown[],
  };
  let nextId = 1;
  return {
    state,
    async transaction<T>(work: (tx: AssetCommandTransaction) => Promise<T>) {
      return work({
        async actorBelongsToSalon() { return true; },
        async createAsset(input) {
          const row = { ...input, id: `asset-${++nextId}` };
          state.assets.push(row);
          return row;
        },
        async createCashMovement(input) {
          const row = { ...input, id: `cash-${nextId++}` };
          state.cashMovements.push(row);
          return row;
        },
        async createDocument(input) {
          const row = { ...input, id: `doc-${nextId++}` };
          state.documents.push(row);
          return row;
        },
        async createDocumentLine(input) {
          return { ...input, id: `line-${nextId++}` };
        },
        async disposeAsset(input) {
          const asset = state.assets.find((item) => item.id === input.assetId && item.salonId === input.salonId);
          if (!asset) throw new Error("ASSET_NOT_FOUND");
          if (asset.status === "disposed") throw new Error("ASSET_ALREADY_DISPOSED");
          Object.assign(asset, { disposalNotes: input.reason, disposedAt: input.disposedAt, disposedByUserId: input.actorUserId, status: "disposed" });
          return { id: String(asset.id), status: "disposed" };
        },
        async findAssetByIdempotency(_salonId, idempotencyKey) {
          const asset = state.assets.find((item) => item.idempotencyKey === idempotencyKey);
          return asset ? { assetId: String(asset.id), cashMovementId: String(asset.cashMovementId), documentId: String(asset.documentId) } : undefined;
        },
        async markDocumentPosted() {},
        async nextDocumentNumber() { return `EQ-${nextId}`; },
      });
    },
  };
}

describe("asset lifecycle", () => {
  it("registers equipment without product or stock movement", async () => {
    const repository = repo();
    const result = await registerAssetPurchase(repository, {
      actorUserId: "user-1",
      description: "Lampada",
      idempotencyKey: "asset-idem",
      paymentMethod: "cash",
      purchaseCostCents: 12000,
      purchaseDate: new Date("2026-08-28"),
      salonId: "salon-1",
    });

    expect(result.assetId).toBeTruthy();
    expect(repository.state.products).toHaveLength(0);
    expect(repository.state.movements).toHaveLength(0);
    expect(repository.state.assets.at(-1)).toMatchObject({ description: "Lampada", status: "active" });
  });

  it("dismisses an asset while preserving its purchase", async () => {
    const repository = repo();

    await disposeAsset(repository, { actorUserId: "user-1", salonId: "salon-1", assetId: "asset-1", disposedAt: new Date("2026-08-28"), reason: "Usura" });

    expect(repository.state.assets[0]).toMatchObject({ status: "disposed", disposalNotes: "Usura" });
  });
});
