"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { useAuth } from "../../../lib/auth-context";

export interface CommunicationConversation {
  customer_name: string | null;
  id: string;
  last_inbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  participant_phone: string;
  status: string;
  unread_count: number;
}

export interface CommunicationMessage {
  body: string | null;
  created_at: string;
  direction: "inbound" | "outbound";
  failure_code: string | null;
  id: string;
  kind: "media" | "system" | "template" | "text";
  status: string;
  template_name: string | null;
}

export interface WorkspaceState {
  draft: string;
  selectedConversationId: string | null;
}

interface ServerWorkspaceState {
  draft?: string;
  selected_conversation_id?: string | null;
}

interface ThreadResponse {
  conversation: { id: string; last_inbound_at: string | null; participant_phone: string; service_window_open: boolean };
  items: CommunicationMessage[];
}

interface CommunicationWorkspaceValue extends WorkspaceState {
  canReply: boolean;
  canView: boolean;
  close(): void;
  conversations: CommunicationConversation[];
  error: string;
  loading: boolean;
  messages: CommunicationMessage[];
  open: boolean;
  openChat(): void;
  refresh(): Promise<void>;
  search: string;
  selectConversation(id: string): void;
  selectedConversation: CommunicationConversation | undefined;
  sendMessage(input: { template?: { locale: string; name: string; parameters: string[] }; text?: string }): Promise<boolean>;
  serviceWindowOpen: boolean;
  setDraft(value: string): void;
  setSearch(value: string): void;
  unreadCount: number;
}

export const initialWorkspaceState: WorkspaceState = { draft: "", selectedConversationId: null };

export function mergeWorkspaceState(current: WorkspaceState, server: ServerWorkspaceState): WorkspaceState {
  return {
    draft: server.draft ?? current.draft,
    selectedConversationId: server.selected_conversation_id ?? current.selectedConversationId,
  };
}

const CommunicationWorkspaceContext = createContext<CommunicationWorkspaceValue | null>(null);

export function CommunicationWorkspaceProvider({ apiBaseUrl, children, salonId }: { apiBaseUrl: string; children: ReactNode; salonId: string }) {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSION_KEYS.COMMUNICATIONS_VIEW);
  const canReply = hasPermission(PERMISSION_KEYS.COMMUNICATIONS_REPLY);
  const [workspace, setWorkspace] = useState(initialWorkspaceState);
  const [conversations, setConversations] = useState<CommunicationConversation[]>([]);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [serviceWindowOpen, setServiceWindowOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const basePath = `${apiBaseUrl}/api/salons/${salonId}/communications`;

  const refresh = useCallback(async () => {
    if (!canView) return;
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    const response = await fetch(`${basePath}/conversations?${params}`, { credentials: "include" });
    if (!response.ok) throw new Error("Conversazioni WhatsApp non disponibili.");
    const data = await response.json() as { items?: CommunicationConversation[] };
    setConversations(data.items ?? []);
  }, [basePath, canView, search]);

  const loadThread = useCallback(async (conversationId: string) => {
    const response = await fetch(`${basePath}/conversations/${conversationId}/messages`, { credentials: "include" });
    if (!response.ok) throw new Error("Conversazione non disponibile.");
    const data = await response.json() as ThreadResponse;
    setMessages(data.items ?? []);
    setServiceWindowOpen(data.conversation.service_window_open);
    const lastMessage = data.items.at(-1);
    await fetch(`${basePath}/conversations/${conversationId}/read`, {
      body: JSON.stringify({ message_id: lastMessage?.id }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
  }, [basePath]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${basePath}/workspace-state`, { credentials: "include" }).then(async (response) => response.ok ? response.json() as Promise<ServerWorkspaceState> : {}),
      refresh(),
    ]).then(([state]) => {
      if (!cancelled) setWorkspace((current) => mergeWorkspaceState(current, state));
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Chat WhatsApp non disponibile.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [basePath, canView, refresh]);

  useEffect(() => {
    if (!canView || !workspace.selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadThread(workspace.selectedConversationId).then(refresh).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Conversazione non disponibile.");
    });
  }, [canView, loadThread, refresh, workspace.selectedConversationId]);

  useEffect(() => {
    if (!canView) return;
    const stream = new EventSource(`${basePath}/events`, { withCredentials: true });
    let poll: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      void refresh().catch(() => undefined);
      if (workspace.selectedConversationId) void loadThread(workspace.selectedConversationId).catch(() => undefined);
    };
    stream.addEventListener("update", update);
    stream.addEventListener("degraded", () => {
      poll ??= setInterval(update, 10_000);
    });
    stream.onerror = () => {
      poll ??= setInterval(update, 10_000);
    };
    stream.onopen = () => {
      if (poll) clearInterval(poll);
      poll = undefined;
    };
    return () => {
      stream.close();
      if (poll) clearInterval(poll);
    };
  }, [basePath, canView, loadThread, refresh, workspace.selectedConversationId]);

  useEffect(() => {
    if (!canView || !search.trim()) return;
    const timer = setTimeout(() => void refresh().catch(() => undefined), 250);
    return () => clearTimeout(timer);
  }, [canView, refresh, search]);

  const selectConversation = useCallback((conversationId: string) => {
    const selected = conversations.find((conversation) => conversation.id === conversationId);
    setError("");
    void fetch(`${basePath}/workspace-state`, {
      body: JSON.stringify({ conversation_id: conversationId, selected: true }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }).then(async (response) => {
      if (!response.ok) throw new Error("Stato chat non salvato.");
      const state = await response.json() as ServerWorkspaceState;
      setWorkspace((current) => mergeWorkspaceState(current, state));
      if (selected?.unread_count) await refresh();
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Stato chat non salvato."));
  }, [basePath, conversations, refresh]);

  const setDraft = useCallback((draft: string) => {
    setWorkspace((current) => ({ ...current, draft }));
    if (!workspace.selectedConversationId) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      void fetch(`${basePath}/workspace-state`, {
        body: JSON.stringify({ conversation_id: workspace.selectedConversationId, draft, selected: true }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }).catch(() => undefined);
    }, 350);
  }, [basePath, workspace.selectedConversationId]);

  const sendMessage = useCallback(async (input: { template?: { locale: string; name: string; parameters: string[] }; text?: string }) => {
    if (!workspace.selectedConversationId || !canReply) return false;
    setError("");
    const response = await fetch(`${basePath}/conversations/${workspace.selectedConversationId}/messages`, {
      body: JSON.stringify({ client_idempotency_key: crypto.randomUUID(), ...input }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setError(data.error === "TEMPLATE_REQUIRED" ? "Fuori dalla finestra di 24 ore serve un modello Meta approvato." : "Invio WhatsApp non riuscito.");
      return false;
    }
    setDraft("");
    await Promise.all([refresh(), loadThread(workspace.selectedConversationId)]);
    return true;
  }, [basePath, canReply, loadThread, refresh, setDraft, workspace.selectedConversationId]);

  const selectedConversation = conversations.find((conversation) => conversation.id === workspace.selectedConversationId);
  const value = useMemo<CommunicationWorkspaceValue>(() => ({
    ...workspace,
    canReply,
    canView,
    close: () => setOpen(false),
    conversations,
    error,
    loading,
    messages,
    open,
    openChat: () => setOpen(true),
    refresh,
    search,
    selectConversation,
    selectedConversation,
    sendMessage,
    serviceWindowOpen,
    setDraft,
    setSearch,
    unreadCount: conversations.reduce((total, conversation) => total + conversation.unread_count, 0),
  }), [workspace, canReply, canView, conversations, error, loading, messages, open, refresh, search, selectConversation, selectedConversation, sendMessage, serviceWindowOpen, setDraft]);

  return <CommunicationWorkspaceContext.Provider value={value}>{children}</CommunicationWorkspaceContext.Provider>;
}

export function useCommunicationWorkspace(): CommunicationWorkspaceValue {
  const value = useContext(CommunicationWorkspaceContext);
  if (!value) throw new Error("useCommunicationWorkspace must be used within CommunicationWorkspaceProvider");
  return value;
}
