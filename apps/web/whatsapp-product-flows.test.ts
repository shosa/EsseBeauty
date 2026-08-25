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

  it("submits WhatsApp campaigns by selected approved template ID rather than editable Meta identifiers", async () => {
    const source = await readFile(resolve(import.meta.dirname, "app/(dashboard)/marketing/new/page.tsx"), "utf8");
    expect(source).toContain("selectedTemplateId");
    expect(source).toContain("template_id: selectedTemplateId");
    expect(source).not.toContain("whatsapp_template_name: templateName");
    expect(source).not.toContain("whatsapp_template_locale: templateLocale");
  });
});
