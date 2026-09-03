import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  initialWorkspaceState,
  markConversationRead,
  markConversationUnread,
  mergeWorkspaceState,
  newlyUnreadConversations,
  reconcileConversationRefresh,
  removeConversation,
  shouldNotifyIncomingConversation,
} from "./app/(dashboard)/_components/CommunicationWorkspaceProvider";

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

  it("guides salons without a configured WhatsApp provider to communications settings", () => {
    const provider = readFileSync(resolve("app/(dashboard)/_components/CommunicationWorkspaceProvider.tsx"), "utf8");
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(provider).toContain("providerStatus");
    expect(provider).toContain('fetch(`${basePath}/provider`');
    expect(provider).toContain("void loadProviderStatus()");
    expect(drawer).toContain('workspace.providerStatus === "not_configured"');
    expect(drawer).toContain("Configura WhatsApp Business");
    expect(drawer).toContain("Vai alle impostazioni");
    expect(drawer).toContain('router.push("/settings/communications")');
  });

  it("labels WhatsApp Web as external and non-authoritative", () => {
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(drawer).toContain("esterno, non sincronizzato con EsseBeauty");
    expect(drawer).toContain("wa.me");
  });

  it("keeps drawer actions stable while text fields update workspace state", () => {
    const provider = readFileSync(resolve("app/(dashboard)/_components/CommunicationWorkspaceProvider.tsx"), "utf8");
    expect(provider).toContain("const close = useCallback(() => setOpen(false), []);");
    expect(provider).toContain("close,");
    expect(provider).toContain("openChat,");
    expect(provider).not.toContain("close: () => setOpen(false)");
    expect(provider).not.toContain("openChat: () => setOpen(true)");
  });

  it("offers a customer address book and links associated chat headers to the customer profile", () => {
    const provider = readFileSync(resolve("app/(dashboard)/_components/CommunicationWorkspaceProvider.tsx"), "utf8");
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(provider).toContain("customer_id");
    expect(provider).toContain("openConversationForCustomer");
    expect(drawer).toContain('aria-label="Apri rubrica clienti"');
    expect(drawer).toContain("/clients/${selected.customer_id}");
    expect(drawer).toContain("Rubrica clienti");
  });

  it("confirms destructive conversation removal and explains its scope", () => {
    const drawer = readFileSync(resolve("app/(dashboard)/_components/WhatsAppChatDrawer.tsx"), "utf8");
    expect(drawer).toContain("Elimina conversazione");
    expect(drawer).toContain("Rimuove la conversazione dalla tua lista");
    expect(drawer).toContain("deleteConversationId");
    expect(drawer).toContain("ConfirmDialog");
  });

  it("updates unread badges immediately when a conversation action succeeds", () => {
    const conversations = [{ id: "one", unread_count: 3 }, { id: "two", unread_count: 0 }];
    expect(markConversationRead(conversations, "one")).toEqual([
      { id: "one", unread_count: 0 },
      { id: "two", unread_count: 0 },
    ]);
    expect(markConversationUnread(conversations, "two")).toEqual([
      { id: "one", unread_count: 3 },
      { id: "two", unread_count: 1 },
    ]);
    expect(removeConversation(conversations, "one")).toEqual([{ id: "two", unread_count: 0 }]);
  });

  it("shows an incoming message preview even when its conversation is already open", () => {
    expect(shouldNotifyIncomingConversation(false, "one", "one")).toBe(true);
    expect(shouldNotifyIncomingConversation(true, "one", "two")).toBe(true);
    expect(shouldNotifyIncomingConversation(true, "one", "one")).toBe(true);
  });

  it("does not show historical unread chats as new previews on initial load", () => {
    expect(newlyUnreadConversations([], [{ id: "one", unread_count: 2 }], false)).toEqual([]);
  });

  it("detects a new unread message when fallback polling refreshes the list", () => {
    const previous = [{ id: "one", last_message_at: "2026-08-25T08:00:00.000Z", unread_count: 0 }];
    const incoming = [{ id: "one", last_message_at: "2026-08-25T08:01:00.000Z", unread_count: 1 }];
    expect(newlyUnreadConversations(previous, incoming, true)).toEqual(incoming);
  });

  it("does not repeat a preview when polling restores the unread count for the same message", () => {
    const previous = [{ id: "one", last_message_at: "2026-08-25T08:01:00.000Z", unread_count: 0 }];
    const staleServerResponse = [{ id: "one", last_message_at: "2026-08-25T08:01:00.000Z", unread_count: 1 }];
    expect(newlyUnreadConversations(previous, staleServerResponse, true)).toEqual([]);
  });

  it("clips the WhatsApp preview progress bar inside the speech bubble", () => {
    const shell = readFileSync(resolve("app/(dashboard)/_components/DashboardShell.tsx"), "utf8");
    expect(shell).toContain("animate-[notification-life_6s_linear_forwards] bg-[#25D366]");
  });

  it("ignores a stale refresh response after a conversation was marked read", () => {
    const optimistic = [{ id: "one", unread_count: 0 }];
    const staleServerResponse = [{ id: "one", unread_count: 3 }];
    expect(reconcileConversationRefresh(optimistic, staleServerResponse, 4, 5)).toEqual(optimistic);
    expect(reconcileConversationRefresh(optimistic, staleServerResponse, 5, 5)).toEqual(staleServerResponse);
  });

  it("keeps a conversation read while its server mutation is still pending", () => {
    const reconcileWithPendingReads = reconcileConversationRefresh as unknown as (
      current: Array<{ id: string; unread_count: number }>,
      incoming: Array<{ id: string; unread_count: number }>,
      requestVersion: number,
      activeVersion: number,
      pendingReadIds: ReadonlySet<string>,
    ) => Array<{ id: string; unread_count: number }>;
    expect(reconcileWithPendingReads(
      [{ id: "one", unread_count: 0 }],
      [{ id: "one", unread_count: 3 }],
      5,
      5,
      new Set(["one"]),
    )).toEqual([{ id: "one", unread_count: 0 }]);
  });

  it("manages WhatsApp marketing consent from the customer profile", () => {
    const customer = readFileSync(resolve("app/(dashboard)/clients/[customerId]/page.tsx"), "utf8");
    const panel = readFileSync(resolve("app/(dashboard)/clients/_components/WhatsAppMarketingConsentPanel.tsx"), "utf8");
    expect(customer).toContain("WhatsAppMarketingConsentPanel");
    expect(customer).toContain("PERMISSION_KEYS.CLIENTS_EDIT");
    expect(panel).toContain("Concedi consenso");
    expect(panel).toContain("Revoca consenso");
    expect(panel).toContain("Storico revoche");
    expect(panel).toContain("evidence_note");
  });
});
