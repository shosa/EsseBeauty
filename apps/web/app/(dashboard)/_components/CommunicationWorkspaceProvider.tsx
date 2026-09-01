"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { useAuth } from "../../../lib/auth-context";

export interface CommunicationConversation {
  customer_id: string | null;
  customer_name: string | null;
  id: string;
  last_inbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  participant_phone: string;
  status: string;
  unread_count: number;
}

export interface CommunicationContact {
  customer_id: string;
  full_name: string;
  phone: string;
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
  conversation: { customer_id: string | null; id: string; last_inbound_at: string | null; participant_phone: string; service_window_open: boolean };
  items: CommunicationMessage[];
}

type CommunicationProviderStatus = "not_configured" | "pending_verification" | "ready" | "degraded" | "revoked" | "disabled";

interface CommunicationWorkspaceValue extends WorkspaceState {
  canReply: boolean;
  canView: boolean;
  close(): void;
  contacts: CommunicationContact[];
  contactsLoading: boolean;
  conversations: CommunicationConversation[];
  error: string;
  loading: boolean;
  messages: CommunicationMessage[];
  open: boolean;
  openChat(): void;
  openConversationForCustomer(customerId: string): Promise<boolean>;
  providerStatus: CommunicationProviderStatus | null;
  loadContacts(query: string): Promise<void>;
  deleteConversation(id: string): Promise<boolean>;
  markRead(id: string): Promise<boolean>;
  markUnread(id: string): Promise<boolean>;
  refresh(): Promise<CommunicationConversation[]>;
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

export function markConversationRead<T extends { id: string; unread_count: number }>(items: T[], conversationId: string): T[] {
  return items.map((item) => item.id === conversationId ? { ...item, unread_count: 0 } : item);
}

export function markConversationUnread<T extends { id: string; unread_count: number }>(items: T[], conversationId: string): T[] {
  return items.map((item) => item.id === conversationId ? { ...item, unread_count: Math.max(1, item.unread_count) } : item);
}

export function removeConversation<T extends { id: string }>(items: T[], conversationId: string): T[] {
  return items.filter((item) => item.id !== conversationId);
}

export function shouldNotifyIncomingConversation(_open: boolean, _selectedConversationId: string | null, incomingConversationId: string): boolean {
  return Boolean(incomingConversationId);
}

export function newlyUnreadConversations<T extends { id: string; last_message_at?: string | null; unread_count: number }>(previous: T[], incoming: T[], initialized: boolean): T[] {
  if (!initialized) return [];
  const previousMessages = new Map(previous.map((item) => [item.id, item.last_message_at ?? null]));
  return incoming.filter((item) => item.unread_count > 0 && (
    !previousMessages.has(item.id) || Boolean(item.last_message_at && item.last_message_at !== previousMessages.get(item.id))
  ));
}

export function reconcileConversationRefresh<T extends { id: string; unread_count: number }>(
  current: T[],
  incoming: T[],
  requestVersion: number,
  activeVersion: number,
  pendingReadIds: ReadonlySet<string> = new Set(),
): T[] {
  if (requestVersion !== activeVersion) return current;
  return incoming.map((item) => pendingReadIds.has(item.id) ? { ...item, unread_count: 0 } : item);
}

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
  const [contacts, setContacts] = useState<CommunicationContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [serviceWindowOpen, setServiceWindowOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providerStatus, setProviderStatus] = useState<CommunicationProviderStatus | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationSnapshotRef = useRef<CommunicationConversation[]>([]);
  const conversationSnapshotInitializedRef = useRef(false);
  const conversationRefreshVersionRef = useRef(0);
  const pendingReadVersionsRef = useRef(new Map<string, number>());
  const basePath = `${apiBaseUrl}/api/salons/${salonId}/communications`;
  const close = useCallback(() => setOpen(false), []);
  const loadProviderStatus = useCallback(async () => {
    const response = await fetch(`${basePath}/provider`, { credentials: "include" });
    if (!response.ok) throw new Error("Configurazione WhatsApp non disponibile.");
    const provider = await response.json() as { status: CommunicationProviderStatus };
    setProviderStatus(provider.status);
    return provider.status;
  }, [basePath]);
  const openChat = useCallback(() => {
    setOpen(true);
    void loadProviderStatus().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Configurazione WhatsApp non disponibile.");
    });
  }, [loadProviderStatus]);
  const commitConversations = useCallback((update: CommunicationConversation[] | ((current: CommunicationConversation[]) => CommunicationConversation[])) => {
    const next = typeof update === "function" ? update(conversationSnapshotRef.current) : update;
    conversationSnapshotRef.current = next;
    setConversations(next);
  }, []);

  const refresh = useCallback(async (options: { notifyIncoming?: boolean } = {}): Promise<CommunicationConversation[]> => {
    if (!canView) return [];
    const requestVersion = ++conversationRefreshVersionRef.current;
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    const response = await fetch(`${basePath}/conversations?${params}`, { credentials: "include" });
    if (!response.ok) throw new Error("Conversazioni WhatsApp non disponibili.");
    const data = await response.json() as { items?: CommunicationConversation[] };
    const items = data.items ?? [];
    if (requestVersion !== conversationRefreshVersionRef.current) return conversationSnapshotRef.current;
    const reconciled = reconcileConversationRefresh(
      conversationSnapshotRef.current,
      items,
      requestVersion,
      conversationRefreshVersionRef.current,
      new Set(pendingReadVersionsRef.current.keys()),
    );
    const newlyUnread = newlyUnreadConversations(conversationSnapshotRef.current, reconciled, conversationSnapshotInitializedRef.current && options.notifyIncoming === true);
    conversationSnapshotRef.current = reconciled;
    conversationSnapshotInitializedRef.current = true;
    commitConversations(reconciled);
    for (const conversation of newlyUnread) {
      window.dispatchEvent(new CustomEvent("esse:whatsapp-message", { detail: {
        body: conversation.last_message_preview ?? "Nuovo messaggio WhatsApp",
        conversationId: conversation.id,
        id: `${conversation.id}:${conversation.last_message_at ?? Date.now()}`,
        title: conversation.customer_name?.trim() || `+${conversation.participant_phone}`,
      } }));
    }
    return reconciled;
  }, [basePath, canView, commitConversations, search]);

  const loadThread = useCallback(async (conversationId: string) => {
    const readVersion = ++conversationRefreshVersionRef.current;
    pendingReadVersionsRef.current.set(conversationId, readVersion);
    commitConversations((current) => markConversationRead(current, conversationId));
    try {
      const response = await fetch(`${basePath}/conversations/${conversationId}/messages`, { credentials: "include" });
      if (!response.ok) throw new Error("Conversazione non disponibile.");
      const data = await response.json() as ThreadResponse;
      setMessages(data.items ?? []);
      setServiceWindowOpen(data.conversation.service_window_open);
      const lastMessage = data.items.at(-1);
      const readResponse = await fetch(`${basePath}/conversations/${conversationId}/read`, {
        body: JSON.stringify({ message_id: lastMessage?.id }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!readResponse.ok) throw new Error("Impossibile aggiornare lo stato di lettura.");
      commitConversations((current) => markConversationRead(current, conversationId));
    } finally {
      if (pendingReadVersionsRef.current.get(conversationId) === readVersion) {
        pendingReadVersionsRef.current.delete(conversationId);
      }
      conversationRefreshVersionRef.current += 1;
    }
  }, [basePath, commitConversations]);

  const loadContacts = useCallback(async (query: string) => {
    if (!canView) return;
    setContactsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`${basePath}/contacts?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Rubrica clienti non disponibile.");
      const data = await response.json() as { items?: CommunicationContact[] };
      setContacts(data.items ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rubrica clienti non disponibile.");
    } finally {
      setContactsLoading(false);
    }
  }, [basePath, canView]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    loadProviderStatus().then(async (status) => {
      if (cancelled) return;
      if (status === "not_configured") return;
      const [state] = await Promise.all([
        fetch(`${basePath}/workspace-state`, { credentials: "include" }).then(async (response) => response.ok ? response.json() as Promise<ServerWorkspaceState> : {}),
        refresh(),
      ]);
      if (!cancelled) setWorkspace((current) => mergeWorkspaceState(current, state));
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Chat WhatsApp non disponibile.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [basePath, canView, loadProviderStatus, refresh]);

  useEffect(() => {
    if (!canView || providerStatus === null || providerStatus === "not_configured" || !open || !workspace.selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadThread(workspace.selectedConversationId).then(() => refresh()).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Conversazione non disponibile.");
    });
  }, [canView, loadThread, open, providerStatus, refresh, workspace.selectedConversationId]);

  useEffect(() => {
    if (!canView || providerStatus === null || providerStatus === "not_configured") return;
    const stream = new EventSource(`${basePath}/events`, { withCredentials: true });
    let poll: number | undefined;
    const update = () => {
      const reconcile = async () => {
        const items = await refresh({ notifyIncoming: true });
        if (open && workspace.selectedConversationId) {
          await loadThread(workspace.selectedConversationId);
          await refresh();
        }
        return items;
      };
      void reconcile().catch(() => undefined);
    };
    stream.addEventListener("update", update);
    stream.addEventListener("degraded", () => {
      poll ??= window.setInterval(update, 10_000);
    });
    stream.onerror = () => {
      poll ??= window.setInterval(update, 10_000);
    };
    stream.onopen = () => {
      if (poll) window.clearInterval(poll);
      poll = undefined;
    };
    return () => {
      stream.close();
      if (poll) window.clearInterval(poll);
    };
  }, [basePath, canView, loadThread, open, providerStatus, refresh, workspace.selectedConversationId]);

  useEffect(() => {
    if (!canView || !search.trim()) return;
    const timer = setTimeout(() => void refresh().catch(() => undefined), 250);
    return () => clearTimeout(timer);
  }, [canView, refresh, search]);

  const selectConversation = useCallback((conversationId: string) => {
    setError("");
    conversationRefreshVersionRef.current += 1;
    commitConversations((current) => markConversationRead(current, conversationId));
    void fetch(`${basePath}/workspace-state`, {
      body: JSON.stringify({ conversation_id: conversationId, selected: true }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }).then(async (response) => {
      if (!response.ok) throw new Error("Stato chat non salvato.");
      const state = await response.json() as ServerWorkspaceState;
      setWorkspace((current) => mergeWorkspaceState(current, state));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Stato chat non salvato."));
  }, [basePath, commitConversations]);

  const markRead = useCallback(async (conversationId: string) => {
    const previous = conversationSnapshotRef.current;
    setError("");
    const readVersion = ++conversationRefreshVersionRef.current;
    pendingReadVersionsRef.current.set(conversationId, readVersion);
    commitConversations((current) => markConversationRead(current, conversationId));
    try {
      const response = await fetch(`${basePath}/conversations/${conversationId}/read`, {
        body: JSON.stringify({}),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (response.ok) return true;
      commitConversations(previous);
      setError("Impossibile segnare la conversazione come letta.");
      return false;
    } finally {
      if (pendingReadVersionsRef.current.get(conversationId) === readVersion) {
        pendingReadVersionsRef.current.delete(conversationId);
      }
      conversationRefreshVersionRef.current += 1;
    }
  }, [basePath, commitConversations]);

  const markUnread = useCallback(async (conversationId: string) => {
    const previous = conversationSnapshotRef.current;
    setError("");
    conversationRefreshVersionRef.current += 1;
    commitConversations((current) => markConversationUnread(current, conversationId));
    const response = await fetch(`${basePath}/conversations/${conversationId}/unread`, {
      credentials: "include",
      method: "PATCH",
    });
    if (response.ok) {
      const data = await response.json() as { unread_count?: number };
      commitConversations((current) => current.map((item) => item.id === conversationId
        ? { ...item, unread_count: data.unread_count ?? 1 }
        : item));
      return true;
    }
    commitConversations(previous);
    setError("Impossibile segnare la conversazione da leggere.");
    return false;
  }, [basePath, commitConversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    const previous = conversationSnapshotRef.current;
    const wasSelected = workspace.selectedConversationId === conversationId;
    setError("");
    conversationRefreshVersionRef.current += 1;
    commitConversations((current) => removeConversation(current, conversationId));
    if (wasSelected) {
      setWorkspace((current) => ({ ...current, draft: "", selectedConversationId: null }));
      setMessages([]);
    }
    const response = await fetch(`${basePath}/conversations/${conversationId}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (response.ok) return true;
    commitConversations(previous);
    if (wasSelected) setWorkspace((current) => ({ ...current, selectedConversationId: conversationId }));
    setError("Impossibile cancellare la conversazione dalla lista.");
    return false;
  }, [basePath, commitConversations, workspace.selectedConversationId]);

  const openConversationForCustomer = useCallback(async (customerId: string) => {
    if (!canReply) return false;
    setError("");
    const response = await fetch(`${basePath}/conversations`, {
      body: JSON.stringify({ customer_id: customerId }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setError(data.error === "CUSTOMER_PHONE_REQUIRED" ? "Il cliente non ha un numero WhatsApp valido." : "Conversazione WhatsApp non disponibile.");
      return false;
    }
    const conversation = await response.json() as { id: string };
    setWorkspace((current) => ({ ...current, selectedConversationId: conversation.id }));
    await fetch(`${basePath}/workspace-state`, {
      body: JSON.stringify({ conversation_id: conversation.id, selected: true }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }).catch(() => undefined);
    await Promise.all([refresh(), loadThread(conversation.id)]);
    return true;
  }, [basePath, canReply, loadThread, refresh]);

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
    close,
    contacts,
    contactsLoading,
    conversations,
    deleteConversation,
    error,
    loading,
    messages,
    open,
    openChat,
    openConversationForCustomer,
    providerStatus,
    loadContacts,
    markRead,
    markUnread,
    refresh,
    search,
    selectConversation,
    selectedConversation,
    sendMessage,
    serviceWindowOpen,
    setDraft,
    setSearch,
    unreadCount: conversations.reduce((total, conversation) => total + conversation.unread_count, 0),
  }), [workspace, canReply, canView, close, contacts, contactsLoading, conversations, deleteConversation, error, loadContacts, loading, markRead, markUnread, messages, open, openChat, openConversationForCustomer, providerStatus, refresh, search, selectConversation, selectedConversation, sendMessage, serviceWindowOpen, setDraft]);

  return <CommunicationWorkspaceContext.Provider value={value}>{children}</CommunicationWorkspaceContext.Provider>;
}

export function useCommunicationWorkspace(): CommunicationWorkspaceValue {
  const value = useContext(CommunicationWorkspaceContext);
  if (!value) throw new Error("useCommunicationWorkspace must be used within CommunicationWorkspaceProvider");
  return value;
}
