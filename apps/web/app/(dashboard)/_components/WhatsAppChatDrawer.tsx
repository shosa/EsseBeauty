"use client";

import { type FormEvent, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, ContactRound, EllipsisVertical, ExternalLink, Eye, EyeOff, LoaderCircle, MessageCircle, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ConfirmDialog } from "@esse-beauty/ui";

import { useCommunicationWorkspace } from "./CommunicationWorkspaceProvider";

function displayName(name: string | null, phone: string): string {
  return name?.trim() || `+${phone}`;
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function WhatsAppChatDrawer() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const workspace = useCommunicationWorkspace();
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLocale, setTemplateLocale] = useState("it");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const requestClose = useCallback(() => {
    if (workspace.draft.trim() || templateName.trim()) {
      setPendingNavigation(null);
      setDiscardConfirmOpen(true);
      return;
    }
    workspace.close();
  }, [templateName, workspace.close, workspace.draft]);

  useEffect(() => {
    if (!workspace.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    function keydown(event: KeyboardEvent) {
      if (discardConfirmOpen || deleteConversationId) return;
      if (event.key === "Escape") {
        if (menuConversationId) { setMenuConversationId(null); return; }
        if (addressBookOpen) { setAddressBookOpen(false); return; }
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [addressBookOpen, deleteConversationId, discardConfirmOpen, menuConversationId, requestClose, workspace.open]);

  useEffect(() => {
    if (!workspace.open || !addressBookOpen) return;
    const timer = setTimeout(() => void workspace.loadContacts(contactQuery), 200);
    return () => clearTimeout(timer);
  }, [addressBookOpen, contactQuery, workspace.loadContacts, workspace.open]);

  useEffect(() => {
    if (!menuConversationId) return;
    const frame = window.requestAnimationFrame(() => conversationMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [menuConversationId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (workspace.serviceWindowOpen) {
      if (!workspace.draft.trim()) return;
      await workspace.sendMessage({ text: workspace.draft.trim() });
    } else {
      if (!templateName.trim() || !templateLocale.trim()) return;
      await workspace.sendMessage({ template: { locale: templateLocale.trim(), name: templateName.trim(), parameters: [] } });
      setTemplateName("");
    }
    composerRef.current?.focus();
  }

  async function confirmConversationDelete() {
    if (!deleteConversationId) return;
    const conversationId = deleteConversationId;
    setDeleteConversationId(null);
    await workspace.deleteConversation(conversationId);
  }

  function discardAndClose() {
    const destination = pendingNavigation;
    workspace.setDraft("");
    setTemplateName("");
    setDiscardConfirmOpen(false);
    setPendingNavigation(null);
    workspace.close();
    if (destination) router.push(destination);
  }

  function handleCustomerNavigation(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (workspace.draft.trim() || templateName.trim()) {
      event.preventDefault();
      setPendingNavigation(href);
      setDiscardConfirmOpen(true);
      return;
    }
    workspace.close();
  }

  function openCommunicationSettings() {
    workspace.close();
    router.push("/settings/communications");
  }

  if (!workspace.canView) return null;
  const selected = workspace.selectedConversation;

  return (
    <AnimatePresence>
      {workspace.open && <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[45] bg-stone-950/35 backdrop-blur-[2px]"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onMouseDown={(event) => { if (event.currentTarget === event.target) requestClose(); }}
        transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
      >
      <motion.aside
        animate={{ opacity: 1, x: 0 }}
        aria-labelledby="whatsapp-drawer-title"
        aria-modal="true"
        className="whatsapp-drawer absolute inset-y-0 right-0 flex w-full max-w-[900px] overflow-hidden border-l border-[var(--wa-border)] bg-[#f5f7f5] shadow-[-20px_0_64px_rgb(18_74_49_/_0.22)] outline-none"
        exit={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
        initial={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.22, 0.9, 0.28, 1] }}
      >
        <h2 className="sr-only" id="whatsapp-drawer-title">WhatsApp Business</h2>
        {workspace.providerStatus === "not_configured" ? (
          <section aria-labelledby="whatsapp-setup-title" className="flex min-w-0 flex-1 flex-col bg-white">
            <header className="flex min-h-16 items-center justify-between border-b border-[var(--wa-border)] px-4 sm:px-6">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--wa-primary)]">Business Cloud</p><p className="text-lg font-black text-stone-950">WhatsApp</p></div>
              <button aria-label="Chiudi chat WhatsApp" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-[var(--wa-tint)]" onClick={requestClose} type="button"><X aria-hidden="true" className="size-5" /></button>
            </header>
            <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 sm:p-10">
              <div className="w-full max-w-md text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--wa-tint)] text-[var(--wa-primary)]"><MessageCircle aria-hidden="true" className="size-8" /></span>
                <h3 className="mt-6 text-2xl font-black tracking-[-.02em] text-stone-950" id="whatsapp-setup-title">Configura WhatsApp Business</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">Per usare chat e messaggi devi collegare il numero aziendale alla WhatsApp Business Cloud API di Meta.</p>
                <button className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--wa-primary)] px-5 text-sm font-bold text-white transition-colors hover:bg-[var(--wa-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--wa-ring)]" onClick={openCommunicationSettings} type="button">Vai alle impostazioni</button>
              </div>
            </div>
          </section>
        ) : <>
        <section aria-label="Conversazioni WhatsApp" className={`${selected && !mobileListOpen ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-[var(--wa-border)] bg-white sm:w-[320px] sm:shrink-0`}>
          <div className="border-b border-[var(--wa-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--wa-primary)]">Business Cloud</p><p className="text-xl font-black text-stone-950">WhatsApp</p></div>
              <button aria-label="Chiudi chat WhatsApp" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-[var(--wa-tint)] sm:hidden" onClick={requestClose} type="button"><X aria-hidden="true" className="size-5" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-500 transition focus-within:border-[var(--wa-primary)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--wa-ring)]"><Search aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Cerca conversazione</span><input className="!min-h-0 min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm !shadow-none outline-none hover:!border-0 focus:!border-0 focus:!shadow-none" onChange={(event) => workspace.setSearch(event.target.value)} placeholder="Cerca chat…" value={workspace.search} /></label>
              <button aria-label="Apri rubrica clienti" aria-pressed={addressBookOpen} className={`grid size-11 shrink-0 place-items-center rounded-xl border transition-colors ${addressBookOpen ? "border-[var(--wa-primary)] bg-[var(--wa-primary)] text-white" : "border-stone-200 bg-white text-[var(--wa-primary)] hover:bg-[var(--wa-tint)]"}`} onClick={() => { setAddressBookOpen((value) => !value); workspace.setSearch(""); }} title="Rubrica clienti" type="button"><ContactRound aria-hidden="true" className="size-5" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {addressBookOpen && <div>
              <div className="mb-2 flex items-center gap-2 px-1"><button aria-label="Torna alle conversazioni" className="grid size-11 place-items-center rounded-xl text-stone-600 hover:bg-[var(--wa-tint)]" onClick={() => setAddressBookOpen(false)} type="button"><ArrowLeft aria-hidden="true" className="size-4" /></button><div><b className="block text-sm text-stone-900">Rubrica clienti</b><span className="text-[11px] text-stone-600">Scegli chi contattare</span></div></div>
              <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-stone-500 focus-within:border-[var(--wa-primary)] focus-within:ring-4 focus-within:ring-[var(--wa-ring)]"><Search aria-hidden="true" className="size-4" /><span className="sr-only">Cerca nella rubrica clienti</span><input className="!min-h-0 min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm !shadow-none outline-none hover:!border-0 focus:!border-0 focus:!shadow-none" onChange={(event) => setContactQuery(event.target.value)} placeholder="Nome o telefono" value={contactQuery} /></label>
              {workspace.contactsLoading && <p className="flex items-center gap-2 p-4 text-sm text-stone-600" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Caricamento rubrica…</p>}
              {!workspace.contactsLoading && workspace.contacts.length === 0 && <p className="p-5 text-center text-xs leading-5 text-stone-500">Nessun cliente con un numero WhatsApp valido.</p>}
              {workspace.contacts.map((contact) => <button className="mb-1 flex min-h-14 w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[var(--wa-tint)]" key={contact.customer_id} onClick={async () => { if (await workspace.openConversationForCustomer(contact.customer_id)) { setAddressBookOpen(false); setMobileListOpen(false); } }} type="button"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--wa-primary)] text-xs font-black text-white">{contact.full_name.slice(0, 2).toUpperCase()}</span><span className="min-w-0"><b className="block truncate text-sm text-stone-900">{contact.full_name}</b><span className="text-xs text-stone-600">{contact.phone}</span></span></button>)}
            </div>}
            {!addressBookOpen && <>
            {workspace.loading && <p className="flex items-center gap-2 p-4 text-sm text-stone-600" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Caricamento…</p>}
            {!workspace.loading && workspace.conversations.length === 0 && <div className="p-6 text-center"><MessageCircle className="mx-auto size-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-700">Nessuna conversazione</p><p className="mt-1 text-xs leading-5 text-stone-500">I messaggi ricevuti tramite Cloud API appariranno qui.</p></div>}
            {workspace.conversations.map((conversation) => (
              <div className={`relative mb-1 flex items-center overflow-hidden rounded-xl border-l-4 transition-colors ${conversation.id === workspace.selectedConversationId ? "border-[var(--wa-primary)] bg-[var(--wa-tint)]" : "border-transparent hover:bg-stone-50"}`} key={conversation.id} onContextMenu={(event) => { event.preventDefault(); setMenuConversationId(conversation.id); }}>
                <button aria-pressed={conversation.id === workspace.selectedConversationId} className="flex min-h-16 min-w-0 flex-1 gap-3 p-2.5 pr-1 text-left" onClick={() => { setMenuConversationId(null); workspace.selectConversation(conversation.id); setMobileListOpen(false); }} type="button">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--wa-primary)] text-xs font-black text-white">{displayName(conversation.customer_name, conversation.participant_phone).slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="truncate text-sm text-stone-900">{displayName(conversation.customer_name, conversation.participant_phone)}</b>{conversation.unread_count > 0 && <span aria-label={`${conversation.unread_count} messaggi non letti`} className="ml-auto grid min-w-5 place-items-center rounded-full bg-[var(--wa-primary)] px-1 text-[10px] font-black text-white">{conversation.unread_count}</span>}</span><span className="mt-1 block truncate text-xs text-stone-600">{conversation.last_message_preview ?? "Conversazione avviata"}</span></span>
                </button>
                <button aria-expanded={menuConversationId === conversation.id} aria-haspopup="menu" aria-label={`Opzioni conversazione ${displayName(conversation.customer_name, conversation.participant_phone)}`} className="mr-1 grid size-11 shrink-0 place-items-center rounded-xl text-stone-500 hover:bg-white hover:text-stone-900" onClick={() => setMenuConversationId((current) => current === conversation.id ? null : conversation.id)} type="button"><EllipsisVertical aria-hidden="true" className="size-4" /></button>
                {menuConversationId === conversation.id && <>
                  <button aria-label="Chiudi menu conversazione" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuConversationId(null)} type="button" />
                  <div className="absolute right-2 top-11 z-20 min-w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" ref={conversationMenuRef} role="menu">
                    {conversation.unread_count > 0
                      ? <button className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-bold hover:bg-[var(--wa-tint)]" onClick={() => { setMenuConversationId(null); void workspace.markRead(conversation.id); }} role="menuitem" type="button"><Eye aria-hidden="true" className="size-4" /> Segna come letto</button>
                      : <button className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-bold hover:bg-[var(--wa-tint)]" onClick={() => { setMenuConversationId(null); void workspace.markUnread(conversation.id); }} role="menuitem" type="button"><EyeOff aria-hidden="true" className="size-4" /> Segna da leggere</button>}
                    <button className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-bold text-red-700 hover:bg-red-50" onClick={() => { setMenuConversationId(null); setDeleteConversationId(conversation.id); }} role="menuitem" type="button"><Trash2 aria-hidden="true" className="size-4" /> Elimina conversazione</button>
                  </div>
                </>}
              </div>
            ))}
            </>}
          </div>
        </section>

        <section className={`${selected && !mobileListOpen ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
          <header className="flex min-h-16 items-center gap-3 border-b border-[var(--wa-border)] bg-white px-4">
            <button aria-label="Torna alle conversazioni" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-700 hover:bg-[var(--wa-tint)] sm:hidden" onClick={() => setMobileListOpen(true)} type="button"><ArrowLeft aria-hidden="true" className="size-4" /></button>
            {selected ? <><span className="grid size-10 place-items-center rounded-full bg-[var(--wa-primary)] text-xs font-black text-white">{displayName(selected.customer_name, selected.participant_phone).slice(0, 2).toUpperCase()}</span><div className="min-w-0">{selected.customer_id ? <Link className="block truncate text-sm font-black text-stone-950 underline-offset-4 hover:text-[var(--wa-primary)] hover:underline" href={`/clients/${selected.customer_id}`} onClick={(event) => handleCustomerNavigation(event, `/clients/${selected.customer_id}`)}>{displayName(selected.customer_name, selected.participant_phone)}</Link> : <b className="block truncate text-sm text-stone-950">{displayName(selected.customer_name, selected.participant_phone)}</b>}<span className="text-xs text-stone-600">+{selected.participant_phone}</span></div></> : <b className="text-sm text-stone-700">Seleziona una conversazione</b>}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {selected && <a aria-label="Apri WhatsApp Web esterno" className="grid size-11 place-items-center rounded-xl border border-[var(--wa-border)] text-[var(--wa-primary)] hover:bg-[var(--wa-tint)]" href={`https://wa.me/${selected.participant_phone}`} rel="noreferrer" target="_blank" title="WhatsApp Web esterno, non sincronizzato con EsseBeauty"><ExternalLink aria-hidden="true" className="size-4" /></a>}
              <button aria-label="Chiudi chat WhatsApp" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-[var(--wa-tint)]" onClick={requestClose} type="button"><X aria-hidden="true" className="size-5" /></button>
            </div>
          </header>

          {selected && <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f7fbf8_0%,#f1f5f2_100%)] p-4">
              <p className="mx-auto mb-4 max-w-lg rounded-xl border border-[var(--wa-border)] bg-white/90 px-3 py-2 text-center text-[11px] leading-5 text-stone-600">Sono sincronizzati soltanto i messaggi inviati e ricevuti tramite WhatsApp Business.</p>
              <div aria-live="polite" aria-relevant="additions" className="space-y-2" role="log">
                {workspace.messages.map((message) => (
                  <article className={`w-fit max-w-[85%] rounded-xl border px-3 py-2 shadow-sm ${message.direction === "outbound" ? "ml-auto rounded-br-sm border-[var(--wa-border)] bg-[#dcf5e6]" : "rounded-bl-sm border-stone-200 bg-white"}`} key={message.id}>
                    {message.kind === "template" && <span className="mb-1 block text-[10px] font-black uppercase tracking-[.12em] text-[var(--wa-primary)]">Modello · {message.template_name}</span>}
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 text-stone-900">{message.body || (message.kind === "media" ? "Allegato WhatsApp" : "Messaggio inviato da modello")}</p>
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-stone-500">{timeLabel(message.created_at)}{message.direction === "outbound" && <CheckCheck className={`size-3 ${message.status === "read" ? "text-sky-600" : ""}`} />}{message.status === "failed" && <button className="ml-1 inline-flex items-center gap-1 font-bold text-red-700" onClick={() => void workspace.sendMessage({ text: message.body ?? "" })} type="button"><RefreshCw className="size-3" /> Riprova</button>}</span>
                  </article>
                ))}
              </div>
            </div>

            <form className="border-t border-stone-200 bg-white p-3" onSubmit={(event) => void submit(event)}>
              {workspace.error && <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" role="alert">{workspace.error}</p>}
              {!workspace.canReply ? <p className="rounded-xl bg-stone-100 px-3 py-3 text-sm text-stone-600">Hai accesso in sola lettura.</p> : workspace.serviceWindowOpen ? (
                <div className="flex items-end gap-2"><label className="sr-only" htmlFor="whatsapp-message">Messaggio</label><textarea className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[var(--wa-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--wa-ring)]" id="whatsapp-message" onChange={(event) => workspace.setDraft(event.target.value)} placeholder="Scrivi un messaggio…" ref={composerRef} rows={1} value={workspace.draft} /><button aria-label="Invia messaggio WhatsApp" className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--wa-primary)] text-white transition-colors hover:bg-[var(--wa-primary-hover)] disabled:opacity-40" disabled={!workspace.draft.trim()} type="submit"><Send aria-hidden="true" className="size-4" /></button></div>
              ) : (
                <div className="space-y-2"><p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">La finestra di assistenza di 24 ore è chiusa. Usa un modello Meta approvato.</p><div className="flex flex-wrap gap-2 sm:flex-nowrap"><label className="min-w-0 flex-1"><span className="sr-only">Nome modello approvato</span><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm focus:border-[var(--wa-primary)] focus:ring-4 focus:ring-[var(--wa-ring)]" onChange={(event) => setTemplateName(event.target.value)} placeholder="Nome modello approvato" value={templateName} /></label><label className="w-24"><span className="sr-only">Lingua modello</span><input className="min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm focus:border-[var(--wa-primary)] focus:ring-4 focus:ring-[var(--wa-ring)]" onChange={(event) => setTemplateLocale(event.target.value)} value={templateLocale} /></label><button aria-label="Invia modello WhatsApp" className="grid size-11 place-items-center rounded-xl bg-[var(--wa-primary)] text-white transition-colors hover:bg-[var(--wa-primary-hover)] disabled:opacity-40" disabled={!templateName.trim()} type="submit"><Send aria-hidden="true" className="size-4" /></button></div></div>
              )}
            </form>
          </>}
        </section>
        </>}
      </motion.aside>
      <ConfirmDialog
        confirmLabel="Elimina dalla lista"
        description="Rimuove la conversazione dalla tua lista WhatsApp senza cancellare il cliente o lo storico condiviso con altri operatori."
        destructive
        onCancel={() => setDeleteConversationId(null)}
        onConfirm={() => void confirmConversationDelete()}
        open={Boolean(deleteConversationId)}
        title="Elimina conversazione?"
      />
      <ConfirmDialog
        confirmLabel="Scarta e chiudi"
        description="Il messaggio non inviato verrà eliminato. Questa azione non può essere annullata."
        destructive
        onCancel={() => { setDiscardConfirmOpen(false); setPendingNavigation(null); }}
        onConfirm={discardAndClose}
        open={discardConfirmOpen}
        title="Scartare il messaggio?"
      />
      </motion.div>}
    </AnimatePresence>
  );
}
