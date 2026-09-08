"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";

const toolbar = [
  { command: "bold", icon: Bold, label: "Grassetto" },
  { command: "italic", icon: Italic, label: "Corsivo" },
  { command: "underline", icon: Underline, label: "Sottolineato" },
  { command: "insertUnorderedList", icon: List, label: "Elenco puntato" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Elenco numerato" },
];

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
    </div>
    <div aria-label="Contenuto email" className="min-h-64 px-4 py-3 text-sm leading-6 outline-none [&_a]:text-[#792f59] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" contentEditable={!disabled} onInput={(event) => onChange(event.currentTarget.innerHTML)} ref={editor} role="textbox" suppressContentEditableWarning />
  </div>;
}

export function EmailPreview({ html, subject }: { html: string; subject: string }) {
  const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#f5f2f3;color:#292524;font-family:Arial,sans-serif}.shell{max-width:620px;margin:24px auto;background:white;border-radius:18px;overflow:hidden}.head{padding:22px 28px;background:#792f59;color:white}.body{padding:28px;line-height:1.65}.foot{padding:18px 28px;background:#faf7f8;color:#78716c;font-size:12px}a{color:#792f59}</style></head><body><div class="shell"><div class="head"><strong>EsseBeauty</strong></div><div class="body"><h1 style="font-size:24px;margin-top:0">${subject || "Oggetto della campagna"}</h1>${html || "<p>Inizia a scrivere per vedere qui l’anteprima della mail.</p>"}</div><div class="foot">Comunicazione inviata dal tuo salone tramite EsseBeauty.</div></div></body></html>`;
  return <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
    <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3"><span className="size-2.5 rounded-full bg-rose-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" /><span className="ml-2 truncate text-xs text-stone-500">Anteprima email · {subject || "Senza oggetto"}</span></div>
    <iframe className="h-[480px] w-full bg-white" sandbox="" srcDoc={documentHtml} title="Anteprima HTML della email" />
  </div>;
}

export function PushPreview({ body, title }: { body: string; title: string }) {
  return <div className="mx-auto max-w-sm rounded-[28px] border-[6px] border-stone-900 bg-stone-100 p-3 shadow-xl">
    <div className="mb-3 flex justify-between px-2 text-[10px] font-semibold"><span>09:41</span><span>EsseBeauty</span></div>
    <div className="rounded-2xl bg-white/95 p-4 shadow-sm"><div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#792f59] text-sm font-bold text-white">E</div><div className="min-w-0"><p className="text-xs font-semibold text-stone-500">EsseBeauty · adesso</p><p className="mt-1 text-sm font-bold text-stone-950">{title || "Titolo notifica"}</p><p className="mt-1 text-sm leading-5 text-stone-600">{body || "Il testo della notifica apparirà qui."}</p></div></div></div>
  </div>;
}
