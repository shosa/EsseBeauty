import { describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import {
  authenticate,
  requirePermission,
  requireRole,
} from "./auth.js";

function createReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
}

describe("authenticate", () => {
  it("loads role and salon from a valid local session", async () => {
    const where = vi.fn().mockResolvedValue([
      {
        active: true,
        id: "user-1",
        role: "employee",
        salonId: "salon-1",
        sessionId: "session-1",
      },
    ]);
    const request = {
      cookies: { "esse-session": "opaque-token" },
      server: {
        db: {
          select: () => ({
            from: () => ({
              innerJoin: () => ({ where }),
            }),
          }),
          update: () => ({
            set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
        } as unknown as DrizzleDB,
      },
      user: undefined,
    };
    const reply = createReply();

    await authenticate.call(
      request.server as never,
      request as never,
      reply as never,
      () => undefined,
    );

    expect(request.user).toEqual({
      id: "user-1",
      role: "employee",
      salon_id: "salon-1",
      sub: "user-1",
    });
  });

  it("rejects inactive application users", async () => {
    const request = {
      cookies: { "esse-session": "opaque-token" },
      server: {
        db: {
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                where: vi.fn().mockResolvedValue([
                  {
                    active: false,
                    id: "user-1",
                    role: "employee",
                    salonId: "salon-1",
                    sessionId: "session-1",
                  },
                ]),
              }),
            }),
          }),
        } as unknown as DrizzleDB,
      },
      user: undefined,
    };
    const reply = createReply();

    await authenticate.call(
      request.server as never,
      request as never,
      reply as never,
      () => undefined,
    );

    expect(reply.code).toHaveBeenCalledWith(401);
  });
});

describe("authorization guards", () => {
  it("rejects roles outside the allowed list", async () => {
    const request = { user: { role: "employee" } };
    const reply = createReply();

    await requireRole("owner").call(
      {} as never,
      request as never,
      reply as never,
      () => undefined,
    );

    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it("returns the required permission when access is denied", async () => {
    const request = {
      server: {
        db: {
          select: () => ({
            from: () => ({
              where: vi
                .fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ role: "employee" }]),
            }),
          }),
        } as unknown as DrizzleDB,
      },
      user: { id: "user-1", role: "employee" },
    };
    const reply = createReply();

    await requirePermission(PERMISSION_KEYS.SETTINGS_USERS).call(
      request.server as never,
      request as never,
      reply as never,
      () => undefined,
    );

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: "PERMISSION_DENIED",
      required: PERMISSION_KEYS.SETTINGS_USERS,
    });
  });
});
