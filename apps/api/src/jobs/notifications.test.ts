import { describe, expect, it } from "vitest";

import type { FastifyInstance } from "fastify";

import { createNotification } from "./notifications.js";

function notificationApp() {
  const inserted: unknown[] = [];
  const app = {
    db: {
      insert: () => ({
        values: async (value: unknown) => {
          inserted.push(value);
        },
      }),
    },
  } as unknown as FastifyInstance;
  return { app, inserted };
}

const input = {
  category: "inventory",
  salonId: "salon-id",
  title: "Scorta bassa",
  type: "inventory_low_stock",
};

describe("notification internal hrefs", () => {
  it("refuses an unrecognized internal href before persisting a notification", async () => {
    const { app, inserted } = notificationApp();

    await expect(
      createNotification(app, { ...input, href: "/not-a-dashboard-route" }),
    ).rejects.toThrow("Invalid internal dashboard href");

    expect(inserted).toEqual([]);
  });

  it("persists a notification href that matches the dashboard route contract", async () => {
    const { app, inserted } = notificationApp();

    await createNotification(app, { ...input, href: "/inventory/product-id" });

    expect(inserted).toHaveLength(1);
  });
});
