import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const activeViews = [
  "app/(dashboard)/settings/reminders/page.tsx",
  "app/(dashboard)/marketing/new/page.tsx",
  "app/(dashboard)/marketing/[campaignId]/page.tsx",
  "app/(dashboard)/marketing/templates/page.tsx",
  "app/(dashboard)/settings/documents/_components/ConsentRecordsPanel.tsx",
];

describe("active product communication UI", () => {
  it("labels active product delivery as WhatsApp instead of SMS", async () => {
    const sources = await Promise.all(activeViews.map((file) =>
      readFile(resolve(import.meta.dirname, file), "utf8"),
    ));

    expect(sources.join("\n")).toContain("WhatsApp");
    expect(sources.join("\n")).not.toContain("SMS");
  });
});
