import { describe, expect, it } from "vitest";

import {
  applyNotificationSnapshot,
  markNotificationRead,
  type ShellNotification,
} from "./app/(dashboard)/_components/notification-state";
import * as notificationState from "./app/(dashboard)/_components/notification-state";

const first: ShellNotification = {
  body: "Caterina: posso spostare l'appuntamento?",
  created_at: "2026-08-25T08:00:00.000Z",
  id: "first",
  read_at: null,
  title: "Nuovo messaggio",
  type: "communication_received",
};

describe("shell notification state", () => {
  it("schedules an audible chime for an incoming message", () => {
    const calls: string[] = [];
    const oscillator = {
      connect: () => calls.push("oscillator:connect"),
      frequency: {
        exponentialRampToValueAtTime: (value: number) => calls.push(`frequency:ramp:${value}`),
        setValueAtTime: (value: number) => calls.push(`frequency:set:${value}`),
      },
      onended: null as (() => void) | null,
      start: () => calls.push("oscillator:start"),
      stop: () => calls.push("oscillator:stop"),
      type: "sine",
    };
    const context = {
      close: () => Promise.resolve(),
      createGain: () => ({
        connect: () => calls.push("gain:connect"),
        gain: {
          exponentialRampToValueAtTime: (value: number) => calls.push(`gain:ramp:${value}`),
          setValueAtTime: (value: number) => calls.push(`gain:set:${value}`),
        },
      }),
      createOscillator: () => oscillator,
      currentTime: 4,
      destination: {},
      state: "running",
    };
    class AudioContextStub {
      constructor() {
        return context;
      }
    }
    const play = (notificationState as unknown as {
      playIncomingMessageSound?: (scope: unknown) => boolean;
    }).playIncomingMessageSound;

    expect(play).toBeTypeOf("function");
    if (!play) return;
    expect(play({ AudioContext: AudioContextStub })).toBe(true);
    expect(calls).toEqual([
      "frequency:set:660",
      "frequency:ramp:880",
      "gain:set:0.0001",
      "gain:ramp:0.12",
      "gain:ramp:0.0001",
      "oscillator:connect",
      "gain:connect",
      "oscillator:start",
      "oscillator:stop",
    ]);
  });

  it("does not toast existing notifications during the initial load", () => {
    expect(applyNotificationSnapshot([], [first], false)).toEqual({
      items: [first],
      previews: [],
      unreadCount: 1,
    });
  });

  it("queues a preview only for newly received unread notifications", () => {
    const next = { ...first, id: "second", title: "Nuova recensione" };
    expect(applyNotificationSnapshot([first], [next, first], true)).toEqual({
      items: [next, first],
      previews: [next],
      unreadCount: 2,
    });
  });

  it("removes the badge count immediately when a notification is read", () => {
    const result = markNotificationRead([first], "first", "2026-08-25T08:01:00.000Z");
    expect(result[0]?.read_at).toBe("2026-08-25T08:01:00.000Z");
    expect(applyNotificationSnapshot(result, result, true).unreadCount).toBe(0);
  });
});
