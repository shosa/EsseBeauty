import { describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";

import { MODULE_KEYS } from "./keys.js";
import {
  clearModuleCache,
  isModuleEnabled,
  requireModule,
} from "./server.js";

describe("isModuleEnabled", () => {
  it("caches a module result for a salon", async () => {
    clearModuleCache();
    const query = vi.fn().mockResolvedValue([{ enabled: true }]);
    const db = {
      select: () => ({
        from: () => ({
          where: query,
        }),
      }),
    };

    const first = await isModuleEnabled(
      "55ffce6d-a01a-478f-9369-325017768034",
      MODULE_KEYS.REMINDERS,
      db as unknown as DrizzleDB,
    );
    const second = await isModuleEnabled(
      "55ffce6d-a01a-478f-9369-325017768034",
      MODULE_KEYS.REMINDERS,
      db as unknown as DrizzleDB,
    );

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("returns false when no module row exists", async () => {
    clearModuleCache();
    const db = {
      select: () => ({
        from: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    await expect(
      isModuleEnabled(
        "55ffce6d-a01a-478f-9369-325017768034",
        MODULE_KEYS.REVIEWS,
        db as unknown as DrizzleDB,
      ),
    ).resolves.toBe(false);
  });
});

describe("requireModule", () => {
  it("returns a typed 403 response when the module is disabled", async () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const request = {
      salonId: "55ffce6d-a01a-478f-9369-325017768034",
      server: {
        db: {
          select: () => ({
            from: () => ({
              where: vi.fn().mockResolvedValue([{ enabled: false }]),
            }),
          }),
        },
      },
    };
    clearModuleCache();

    await requireModule(MODULE_KEYS.INVENTORY).call(
      request.server as never,
      request as never,
      reply as never,
      () => undefined,
    );

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: "MODULE_DISABLED",
      module: MODULE_KEYS.INVENTORY,
    });
  });
});
