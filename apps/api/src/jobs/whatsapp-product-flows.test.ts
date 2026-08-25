import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migratedFlows = [
  "reminders.ts",
  "reviews.ts",
  "appointment-events.ts",
  "marketing.ts",
];

describe("WhatsApp product flows", () => {
  it("uses the durable WhatsApp enqueue boundary rather than SMS delivery", async () => {
    const sources = await Promise.all(migratedFlows.map((file) =>
      readFile(resolve(import.meta.dirname, file), "utf8"),
    ));

    expect(sources.join("\n")).toContain("enqueueCommunication");
    expect(sources.join("\n")).not.toMatch(/sendSms|channel:\s*["']sms["']/);
  });
});
