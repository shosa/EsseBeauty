"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, ContactRound, EllipsisVertical, ExternalLink, Eye, EyeOff, LoaderCircle, MessageCircle, RefreshCw, Search, Send, Trash2, X } from "lucide-react";

import { useCommunicationWorkspace } from "./CommunicationWorkspaceProvider";

function displayName(name: string | null, phone: string): string {
  return name?.trim() || `+${phone}`;
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function WhatsAppChatDrawer() {
  const workspace = useCommunicationWorkspace();
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLocale, setTemplateLocale] = useState("it");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        workspace.close();
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
  }, [workspace.close, workspace.open]);

  useEffect(() => {
    if (!workspace.open || !addressBookOpen) return;
    const timer = setTimeout(() => void workspace.loadContacts(contactQuery), 200);
    return () => clearTimeout(timer);
  }, [addressBookOpen, contactQuery, workspace.loadContacts, workspace.open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (workspace.serviceWindowOpen) {
      if (!workspace.draft.trim()) return;
      await workspace.sendMessage({ text: workspace.draft.trim() });
    } else {
      if (!templateName.trim() || !templateLocale.trim()) return;
      await workspace.sendMessage({ template: { locale: templateLocale.trim(), name: templateName.trim(), parameters: [] } });
    }
    composerRef.current?.focus();
  }

  if (!workspace.canView || !workspace.open) return null;
  const selected = workspace.selectedConversation;

  return (
    <div className="fixed inset-0 z-[70] bg-[#20141b]/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) workspace.close(); }}>
      <aside
        aria-label="Chat WhatsApp"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-[760px] overflow-hidden bg-[#f5f1f3] shadow-[-24px_0_80px_rgb(32_20_27_/_0.28)] outline-none"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <section className={`${selected && !mobileListOpen ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-stone-200 bg-white sm:w-[290px] sm:shrink-0`}>
          <div className="border-b border-stone-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#792f59]">Cloud API</p><h2 className="text-xl font-black text-[#2d1d27]">WhatsApp</h2></div>
              <button aria-label="Chiudi chat WhatsApp" className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 sm:hidden" onClick={workspace.close} type="button"><X className="size-5" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-stone-500 shadow-sm transition focus-within:border-[#792f59] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#792f59]/10"><Search className="size-4 shrink-0" /><span className="sr-only">Cerca conversazione</span><input className="!min-h-0 min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm !shadow-none outline-none hover:!border-0 focus:!border-0 focus:!shadow-none" onChange={(event) => workspace.setSearch(event.target.value)} placeholder="Cerca chat…" value={workspace.search} /></label>
              <button aria-label="Apri rubrica clienti" className={`grid size-11 shrink-0 place-items-center rounded-2xl border shadow-sm transition ${addressBookOpen ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white text-[#792f59] hover:bg-[#fbf3f7]"}`} onClick={() => { setAddressBookOpen((value) => !value); workspace.setSearch(""); }} title="Rubrica clienti" type="button"><ContactRound className="size-5" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {addressBookOpen && <div>
              <div className="mb-2 flex items-center gap-2 px-2 py-1"><button aria-label="Torna alle conversazioni" className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setAddressBookOpen(false)} type="button"><ArrowLeft className="size-4" /></button><div><b className="block text-sm text-stone-900">Rubrica clienti</b><span className="text-[11px] text-stone-500">Scegli chi contattare</span></div></div>
              <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-stone-500"><Search className="size-4" /><span className="sr-only">Cerca nella rubrica clienti</span><input className="!min-h-0 min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm !shadow-none outline-none hover:!border-0 focus:!border-0 focus:!shadow-none" onChange={(event) => setContactQuery(event.target.value)} placeholder="Nome o telefono" value={contactQuery} /></label>
              {workspace.contactsLoading && <p className="flex items-center gap-2 p-4 text-sm text-stone-500"><LoaderCircle className="size-4 animate-spin" /> Caricamento rubrica…</p>}
              {!workspace.contactsLoading && workspace.contacts.length === 0 && <p className="p-5 text-center text-xs leading-5 text-stone-500">Nessun cliente con un numero WhatsApp valido.</p>}
              {workspace.contacts.map((contact) => <button className="mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-[#f5e4ed]" key={contact.customer_id} onClick={async () => { if (await workspace.openConversationForCustomer(contact.customer_id)) { setAddressBookOpen(false); setMobileListOpen(false); } }} type="button"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#792f59] text-xs font-black text-white">{contact.full_name.slice(0, 2).toUpperCase()}</span><span className="min-w-0"><b className="block truncate text-sm text-stone-900">{contact.full_name}</b><span className="text-xs text-stone-500">{contact.phone}</span></span></button>)}
            </div>}
            {!addressBookOpen && <>
            {workspace.loading && <p className="flex items-center gap-2 p-4 text-sm text-stone-500"><LoaderCircle className="size-4 animate-spin" /> Caricamento…</p>}
            {!workspace.loading && workspace.conversations.length === 0 && <div className="p-6 text-center"><MessageCircle className="mx-auto size-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-700">Nessuna conversazione</p><p className="mt-1 text-xs leading-5 text-stone-500">I messaggi ricevuti tramite Cloud API appariranno qui.</p></div>}
            {workspace.conversations.map((conversation) => (
              <div className={`relative mb-1 flex items-center rounded-2xl transition ${conversation.id === workspace.selectedConversationId ? "bg-[#f5e4ed]" : "hover:bg-stone-50"}`} key={conversation.id} onContextMenu={(event) => { event.preventDefault(); setMenuConversationId(conversation.id); }}>
                <button className="flex min-w-0 flex-1 gap-3 p-3 pr-1 text-left" onClick={() => { setMenuConversationId(null); workspace.selectConversation(conversation.id); setMobileListOpen(false); }} type="button">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2f6f4e] text-xs font-black text-white">{displayName(conversation.customer_name, conversation.participant_phone).slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="truncate text-sm text-stone-900">{displayName(conversation.customer_name, conversation.participant_phone)}</b>{conversation.unread_count > 0 && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[#25D366] px-1 text-[10px] font-black text-white">{conversation.unread_count}</span>}</span><span className="mt-1 block truncate text-xs text-stone-500">{conversation.last_message_preview ?? "Conversazione avviata"}</span></span>
                </button>
                <button aria-expanded={menuConversationId === conversation.id} aria-haspopup="menu" aria-label={`Opzioni conversazione ${displayName(conversation.customer_name, conversation.participant_phone)}`} className="mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-white hover:text-stone-800" onClick={() => setMenuConversationId((current) => current === conversation.id ? null : conversation.id)} type="button"><EllipsisVertical className="size-4" /></button>
                {menuConversationId === conversation.id && <>
                  <button aria-label="Chiudi menu conversazione" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuConversationId(null)} type="button" />
                  <div className="absolute right-2 top-11 z-20 min-w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" role="menu">
                    {conversation.unread_count > 0
                      ? <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-bold hover:bg-stone-50" onClick={() => { setMenuConversationId(null); void workspace.markRead(conversation.id); }} role="menuitem" type="button"><Eye className="size-4" /> Segna come letto</button>
                      : <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-bold hover:bg-stone-50" onClick={() => { setMenuConversationId(null); void workspace.markUnread(conversation.id); }} role="menuitem" type="button"><EyeOff className="size-4" /> Segna da leggere</button>}
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-bold text-red-700 hover:bg-red-50" onClick={() => { setMenuConversationId(null); void workspace.deleteConversation(conversation.id); }} role="menuitem" type="button"><Trash2 className="size-4" /> Cancella dalla lista</button>
                  </div>
                </>}
              </div>
            ))}
            </>}
          </div>
        </section>

        <section className={`${selected && !mobileListOpen ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
          <header className="flex min-h-16 items-center gap-3 border-b border-stone-200 bg-white px-4">
            <button aria-label="Torna alle conversazioni" className="grid size-9 place-items-center rounded-lg border border-stone-200 sm:hidden" onClick={() => setMobileListOpen(true)} type="button">←</button>
            {selected ? <><span className="grid size-10 place-items-center rounded-full bg-[#2f6f4e] text-xs font-black text-white">{displayName(selected.customer_name, selected.participant_phone).slice(0, 2).toUpperCase()}</span><div className="min-w-0">{selected.customer_id ? <Link className="block truncate text-sm font-black text-stone-950 underline-offset-4 hover:text-[#792f59] hover:underline" href={`/clients/${selected.customer_id}`} onClick={workspace.close}>{displayName(selected.customer_name, selected.participant_phone)}</Link> : <b className="block truncate text-sm text-stone-950">{displayName(selected.customer_name, selected.participant_phone)}</b>}<span className="text-xs text-stone-500">+{selected.participant_phone}</span></div><a aria-label="Apri WhatsApp Web esterno" className="ml-auto grid size-10 place-items-center rounded-xl border border-stone-200 text-[#2f6f4e]" href={`https://wa.me/${selected.participant_phone}`} rel="noreferrer" target="_blank" title="WhatsApp Web esterno, non sincronizzato con EsseBeauty"><ExternalLink className="size-4" /></a></> : <b className="text-sm text-stone-700">Seleziona una conversazione</b>}
            <button aria-label="Chiudi chat WhatsApp" className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50" onClick={workspace.close} type="button"><X className="size-5" /></button>
          </header>

          {selected && <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#fff_0%,#f5f1f3_70%)] p-4">
              <p className="mx-auto mb-4 max-w-md rounded-xl bg-white/80 px-3 py-2 text-center text-[11px] leading-5 text-stone-500 shadow-sm">EsseBeauty registra solo i messaggi scambiati tramite WhatsApp Business Cloud API. WhatsApp Web è esterno, non sincronizzato con EsseBeauty.</p>
              <div className="space-y-2">
                {workspace.messages.map((message) => (
                  <article className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${message.direction === "outbound" ? "ml-auto rounded-br-sm bg-[#dff7e8]" : "rounded-bl-sm bg-white"}`} key={message.id}>
                    {message.kind === "template" && <span className="mb-1 block text-[10px] font-black uppercase tracking-[.12em] text-[#2f6f4e]">Modello · {message.template_name}</span>}
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 text-stone-900">{message.body || (message.kind === "media" ? "Allegato WhatsApp" : "Messaggio inviato da modello")}</p>
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-stone-500">{timeLabel(message.created_at)}{message.direction === "outbound" && <CheckCheck className={`size-3 ${message.status === "read" ? "text-sky-600" : ""}`} />}{message.status === "failed" && <button className="ml-1 inline-flex items-center gap-1 font-bold text-red-700" onClick={() => void workspace.sendMessage({ text: message.body ?? "" })} type="button"><RefreshCw className="size-3" /> Riprova</button>}</span>
                  </article>
                ))}
              </div>
            </div>

            <form className="border-t border-stone-200 bg-white p-3" onSubmit={(event) => void submit(event)}>
              {workspace.error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{workspace.error}</p>}
              {!workspace.canReply ? <p className="rounded-xl bg-stone-100 px-3 py-3 text-sm text-stone-600">Hai accesso in sola lettura.</p> : workspace.serviceWindowOpen ? (
                <div className="flex items-end gap-2"><label className="sr-only" htmlFor="whatsapp-message">Messaggio</label><textarea className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[#2f6f4e]" id="whatsapp-message" onChange={(event) => workspace.setDraft(event.target.value)} placeholder="Scrivi un messaggio…" ref={composerRef} rows={1} value={workspace.draft} /><button aria-label="Invia messaggio WhatsApp" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#2f6f4e] text-white disabled:opacity-40" disabled={!workspace.draft.trim()} type="submit"><Send className="size-4" /></button></div>
              ) : (
                <div className="space-y-2"><p className="text-xs font-semibold text-amber-800">La finestra di assistenza di 24 ore è chiusa. Seleziona un modello Meta approvato.</p><div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Nome modello approvato</span><input className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" onChange={(event) => setTemplateName(event.target.value)} placeholder="Nome modello approvato" value={templateName} /></label><label className="w-24"><span className="sr-only">Lingua modello</span><input className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" onChange={(event) => setTemplateLocale(event.target.value)} value={templateLocale} /></label><button aria-label="Invia modello WhatsApp" className="grid size-10 place-items-center rounded-xl bg-[#2f6f4e] text-white disabled:opacity-40" disabled={!templateName.trim()} type="submit"><Send className="size-4" /></button></div></div>
              )}
            </form>
          </>}
        </section>
      </aside>
    </div>
  );
}
