import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { initialWorkspaceState, mergeWorkspaceState } from "./app/(dashboard)/_components/CommunicationWorkspaceProvider";

describe("global WhatsApp workspace", () => {
  it("restores a stable selected conversation and draft from server state", () => {
    expect(mergeWorkspaceState(initialWorkspaceState, {
      draft: "Richiamo domani",
      selected_conversation_id: "conversation-1",
    })).toMatchObject({
      draft: "Richiamo domani",
      selectedConversationId: "conversation-1",
    });
  });

  it("mounts the drawer globally and exposes an accessible topbar control", () => {
    const shell = readFileSync(resolve("app/(dashboard)/_components/DashboardShell.tsx"), "utf8");
    const topbar = readFileSync(resolve("app/(dashboard)/_components/WorkspaceTopbar.tsx"), "utf8");
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(shell).toContain("CommunicationWorkspaceProvider");
    expect(shell).toContain("WhatsAppChatDrawer");
    expect(topbar).toContain('aria-label="Apri chat WhatsApp"');
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('aria-modal="true"');
  });

  it("labels WhatsApp Web as external and non-authoritative", () => {
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(drawer).toContain("esterno, non sincronizzato con EsseBeauty");
    expect(drawer).toContain("wa.me");
  });
});
