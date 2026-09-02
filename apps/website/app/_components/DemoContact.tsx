"use client";

import { ArrowRight, Mail, X } from "lucide-react";
import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useRef } from "react";

import { SITE_CONFIG } from "../site-config";

export interface DemoFields {
  business: string;
  email: string;
  message: string;
  name: string;
  phone: string;
  teamSize: string;
}

export function createDemoMailto(fields: DemoFields, destination = SITE_CONFIG.demoEmail) {
  const subject = `Richiesta demo EsseBeauty — ${fields.business.trim()}`;
  const lines = [
    "Buongiorno,", "", "Vorrei richiedere una demo di EsseBeauty.", "",
    `Nome: ${fields.name.trim()}`,
    `Centro: ${fields.business.trim()}`,
    `Email: ${fields.email.trim()}`,
    ...(fields.phone.trim() ? [`Telefono: ${fields.phone.trim()}`] : []),
    `Team: ${fields.teamSize}`,
    ...(fields.message.trim() ? ["", "Messaggio:", fields.message.trim()] : []),
  ];
  return `mailto:${destination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

const DemoContactContext = createContext<{ openDemoContact: (opener: HTMLElement) => void } | null>(null);

export function DemoContactButton({ children, className }: { children: ReactNode; className?: string }) {
  const context = useContext(DemoContactContext);
  if (!context) throw new Error("DemoContactButton must be used inside DemoContactProvider");
  return <button className={className} onClick={(event) => context.openDemoContact(event.currentTarget)} type="button">{children}</button>;
}

export function DemoContactProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function closeDialog() { dialogRef.current?.close(); }
  function openDemoContact(opener: HTMLElement) {
    openerRef.current = opener;
    dialogRef.current?.showModal();
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    window.location.href = createDemoMailto({
      business: String(data.get("business") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      teamSize: String(data.get("teamSize") ?? ""),
    });
    closeDialog();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      document.body.style.overflow = "";
      openerRef.current?.focus();
    };
    const observer = new MutationObserver(() => {
      if (dialog.open) document.body.style.overflow = "hidden";
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    dialog.addEventListener("close", handleClose);
    return () => {
      observer.disconnect();
      dialog.removeEventListener("close", handleClose);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <DemoContactContext.Provider value={{ openDemoContact }}>
      {children}
      <dialog aria-describedby="demo-dialog-description" aria-labelledby="demo-dialog-title" className="demo-dialog" ref={dialogRef}>
        <button aria-label="Chiudi il modulo" className="demo-dialog__close" onClick={closeDialog} type="button"><X aria-hidden="true" /></button>
        <div className="demo-dialog__intro">
          <span><Mail aria-hidden="true" /></span><p className="eyebrow">Conosciamoci</p>
          <h2 id="demo-dialog-title">Richiedi una demo</h2>
          <p id="demo-dialog-description">Raccontaci qualcosa del tuo centro. Ti aiuteremo a capire come EsseBeauty può entrare nella tua giornata.</p>
        </div>
        <form className="demo-form" onSubmit={handleSubmit}>
          <div className="demo-form__grid">
            <label>Nome e cognome<input autoComplete="name" name="name" placeholder="Come ti chiami?" required /></label>
            <label>Nome del centro<input autoComplete="organization" name="business" placeholder="Il tuo centro estetico" required /></label>
            <label>Email<input autoComplete="email" name="email" placeholder="nome@centro.it" required type="email" /></label>
            <label>Telefono <small>Facoltativo</small><input autoComplete="tel" name="phone" placeholder="+39 333 000 0000" type="tel" /></label>
            <label className="demo-form__wide">Dimensione del team<select defaultValue="" name="teamSize" required><option disabled value="">Seleziona una voce</option><option>Solo io</option><option>2–5 persone</option><option>6–10 persone</option><option>Più di 10 persone</option></select></label>
            <label className="demo-form__wide">Cosa vorresti migliorare? <small>Facoltativo</small><textarea name="message" placeholder="Es. agenda, clienti, magazzino, comunicazioni…" rows={3} /></label>
          </div>
          <p className="demo-form__disclosure"><Mail aria-hidden="true" /> Apre la tua applicazione email con la richiesta già compilata. Per ora nessun dato viene salvato sul sito.</p>
          <div className="demo-form__actions"><button className="button-secondary" onClick={closeDialog} type="button">Annulla</button><button className="button-primary" type="submit">Prepara la richiesta <ArrowRight aria-hidden="true" /></button></div>
        </form>
      </dialog>
    </DemoContactContext.Provider>
  );
}
