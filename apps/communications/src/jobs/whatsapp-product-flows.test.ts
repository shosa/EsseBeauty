import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migratedFlows = [
  "reminders.ts",
  "reviews.ts",
];

describe("WhatsApp product flows", () => {
  it("uses the durable WhatsApp enqueue boundary rather than SMS delivery", async () => {
    const sources = await Promise.all(migratedFlows.map((file) =>
      readFile(resolve(import.meta.dirname, file), "utf8"),
    ));

    expect(sources.join("\n")).toContain("enqueueCommunication");
    expect(sources.join("\n")).not.toMatch(/sendSms|channel:\s*["']sms["']/);
  });

  it("keeps app review push links inside the PWA while email reviews use absolute URLs", async () => {
    const source = await readFile(resolve(import.meta.dirname, "reviews.ts"), "utf8");

    expect(source).toContain("export function buildReviewInvitePath");
    expect(source).toContain("href: buildReviewInvitePath(delivery.salonSlug, delivery.rawToken)");
    expect(source).toContain("reviewInvitationEmailHtml({ customerName: delivery.customerName, reviewUrl: buildReviewInviteUrl(pwaUrl, delivery.rawToken)");
  });
});
