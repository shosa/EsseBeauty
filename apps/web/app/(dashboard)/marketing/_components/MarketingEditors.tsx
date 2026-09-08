"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Bold, Braces, Italic, Link2, List, ListOrdered, Redo2, Smile, Underline, Undo2 } from "lucide-react";
import { EmojiStyle, type EmojiClickData } from "emoji-picker-react";
import { brandedEmailHtml, highlightMarketingWildcardsInHtml, isMarketingWildcardToken, MARKETING_WILDCARDS, splitMarketingWildcards } from "@esse-beauty/shared";

const EmojiPickerLazy = dynamic(() => import("emoji-picker-react"), { ssr: false });

const toolbar = [
  { command: "bold", icon: Bold, label: "Grassetto" },
  { command: "italic", icon: Italic, label: "Corsivo" },
  { command: "underline", icon: Underline, label: "Sottolineato" },
  { command: "insertUnorderedList", icon: List, label: "Elenco puntato" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Elenco numerato" },
];

/**
 * Popover state shared by the wildcard and emoji pickers. The panel is rendered
 * through a portal at a fixed, viewport-computed position instead of an
 * absolutely-positioned child, because every caller nests the trigger inside an
 * `overflow-hidden` editor card — an absolute panel would get clipped there.
 */
function usePopoverMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ left: rect.left, top: rect.bottom + 6 });
    }
    updatePosition();
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return { open, panelRef, position, setOpen, triggerRef };
}

const menuTriggerClass = "grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white hover:text-[#792f59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59] disabled:opacity-50";

export function WildcardMenu({ disabled, onInsert }: { disabled?: boolean; onInsert: (token: string) => void }) {
  const { open, panelRef, position, setOpen, triggerRef } = usePopoverMenu();
  const panelWidth = 288;
  return <>
    <button aria-expanded={open} aria-label="Inserisci campo dinamico" className={menuTriggerClass} disabled={disabled} onClick={() => setOpen((value) => !value)} onMouseDown={(event) => event.preventDefault()} ref={triggerRef} type="button"><Braces className="size-4" /></button>
    {open && createPortal(
      <div className="fixed z-50 w-72 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg" ref={panelRef} style={{ left: Math.min(position.left, window.innerWidth - panelWidth - 8), top: position.top }}>
        <p className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Campi dinamici</p>
        {MARKETING_WILDCARDS.map((wildcard) => <button className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 hover:bg-[#fbf3f7] hover:text-[#792f59]" key={wildcard.token} onClick={() => { onInsert(wildcard.token); setOpen(false); }} onMouseDown={(event) => event.preventDefault()} type="button">
          <span className="flex flex-col"><span className="font-medium">{wildcard.label}</span><span className="text-xs text-stone-400">Es. {wildcard.sample}</span></span>
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{wildcard.token}</code>
        </button>)}
      </div>,
      document.body,
    )}
  </>;
}

export function EmojiMenu({ disabled, onInsert }: { disabled?: boolean; onInsert: (emoji: string) => void }) {
  const { open, panelRef, position, setOpen, triggerRef } = usePopoverMenu();
  const panelWidth = 320;
  return <>
    <button aria-expanded={open} aria-label="Inserisci emoji" className={menuTriggerClass} disabled={disabled} onClick={() => setOpen((value) => !value)} onMouseDown={(event) => event.preventDefault()} ref={triggerRef} type="button"><Smile className="size-4" /></button>
    {open && createPortal(
      <div className="fixed z-50" ref={panelRef} style={{ left: Math.min(position.left, window.innerWidth - panelWidth - 8), top: position.top }}>
        <EmojiPickerLazy
          emojiStyle={EmojiStyle.NATIVE}
          height={380}
          onEmojiClick={(data: EmojiClickData) => { onInsert(data.emoji); setOpen(false); }}
          previewConfig={{ showPreview: false }}
          searchPlaceHolder="Cerca emoji"
          width={panelWidth}
        />
      </div>,
      document.body,
    )}
  </>;
}

export function RichTextEditor({ disabled, onChange, value }: { disabled?: boolean; onChange: (html: string) => void; value: string }) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value;
  }, [value]);

  function run(command: string, argument?: string) {
    editor.current?.focus();
    document.execCommand(command, false, argument);
    onChange(editor.current?.innerHTML ?? "");
  }

  return <div className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${disabled ? "opacity-65" : "focus-within:border-[#792f59] focus-within:ring-2 focus-within:ring-[#792f59]/10"}`}>
    <div aria-label="Formattazione testo" className="flex flex-wrap gap-1 border-b border-stone-200 bg-stone-50 p-2" role="toolbar">
      {toolbar.map(({ command, icon: Icon, label }) => <button aria-label={label} className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white hover:text-[#792f59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#792f59]" disabled={disabled} key={command} onMouseDown={(event) => event.preventDefault()} onClick={() => run(command)} type="button"><Icon className="size-4" /></button>)}
      <span aria-hidden="true" className="mx-1 w-px bg-stone-200" />
      <button aria-label="Inserisci link" className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white hover:text-[#792f59]" disabled={disabled} onClick={() => { const url = window.prompt("Indirizzo del link"); if (url) run("createLink", url); }} type="button"><Link2 className="size-4" /></button>
      <button aria-label="Annulla" className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white hover:text-[#792f59]" disabled={disabled} onClick={() => run("undo")} type="button"><Undo2 className="size-4" /></button>
      <button aria-label="Ripristina" className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white hover:text-[#792f59]" disabled={disabled} onClick={() => run("redo")} type="button"><Redo2 className="size-4" /></button>
      <span aria-hidden="true" className="mx-1 w-px bg-stone-200" />
      <WildcardMenu disabled={disabled} onInsert={(token) => run("insertText", token)} />
      <EmojiMenu disabled={disabled} onInsert={(emoji) => run("insertText", emoji)} />
    </div>
    <div aria-label="Contenuto email" className="min-h-64 px-4 py-3 text-sm leading-6 outline-none [&_a]:text-[#792f59] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" contentEditable={!disabled} onInput={(event) => onChange(event.currentTarget.innerHTML)} ref={editor} role="textbox" suppressContentEditableWarning />
  </div>;
}

export function PushTextEditor({ disabled, maxLength = 180, onChange, value }: { disabled?: boolean; maxLength?: number; onChange: (value: string) => void; value: string }) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insert(text: string) {
    const node = textarea.current;
    if (!node) return;
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`.slice(0, maxLength);
    onChange(next);
    node.focus();
    requestAnimationFrame(() => {
      const caret = Math.min(start + text.length, next.length);
      node.setSelectionRange(caret, caret);
    });
  }

  return <div className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${disabled ? "opacity-65" : "focus-within:border-[#792f59] focus-within:ring-2 focus-within:ring-[#792f59]/10"}`}>
    <div aria-label="Inserimenti rapidi" className="flex flex-wrap gap-1 border-b border-stone-200 bg-stone-50 p-2" role="toolbar">
      <WildcardMenu disabled={disabled} onInsert={insert} />
      <EmojiMenu disabled={disabled} onInsert={insert} />
    </div>
    <textarea className="w-full resize-y p-3 text-sm outline-none disabled:bg-stone-100" disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} ref={textarea} rows={5} value={value} />
    <div className="border-t border-stone-200 bg-stone-50 px-3 py-1.5 text-right text-xs text-stone-500">{value.length}/{maxLength}</div>
  </div>;
}

export function EmailPreview({ html, salonName, subject }: { html: string; salonName?: string; subject: string }) {
  const documentHtml = brandedEmailHtml({
    bodyHtml: html ? highlightMarketingWildcardsInHtml(html) : "<p>Inizia a scrivere per vedere qui l’anteprima della mail.</p>",
    eyebrow: salonName || "EsseBeauty",
    footerNote: `Comunicazione inviata tramite EsseBeauty per conto di ${salonName || "il salone"}.`,
    title: subject || "Oggetto della campagna",
  });
  return <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
    <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3"><span className="size-2.5 rounded-full bg-rose-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" /><span className="ml-2 truncate text-xs text-stone-500">Anteprima email · {subject || "Senza oggetto"}</span></div>
    <iframe className="h-[600px] w-full bg-white" sandbox="" srcDoc={documentHtml} title="Anteprima HTML della email" />
  </div>;
}

function withWildcardsBold(text: string) {
  return splitMarketingWildcards(text).map((part, index) => isMarketingWildcardToken(part) ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>);
}

export function PushPreview({ body, title }: { body: string; title: string }) {
  return <div className="mx-auto max-w-sm rounded-[28px] border-[6px] border-stone-900 bg-stone-100 p-3 shadow-xl">
    <div className="mb-3 flex justify-between px-2 text-[10px] font-semibold"><span>09:41</span><span>EsseBeauty</span></div>
    <div className="rounded-2xl bg-white/95 p-4 shadow-sm"><div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#792f59] text-sm font-bold text-white">E</div><div className="min-w-0"><p className="text-xs font-semibold text-stone-500">EsseBeauty · adesso</p><p className="mt-1 text-sm font-bold text-stone-950">{withWildcardsBold(title || "Titolo notifica")}</p><p className="mt-1 text-sm leading-5 text-stone-600">{withWildcardsBold(body || "Il testo della notifica apparirà qui.")}</p></div></div></div>
  </div>;
}
