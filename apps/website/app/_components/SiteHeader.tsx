"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { SITE_CONFIG } from "../site-config";
import { BrandLogo } from "./BrandLogo";

const links = [
  { href: "#funzionalita", label: "Funzionalità" },
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#perche-essebeauty", label: "Perché EsseBeauty" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner section-shell">
        <a aria-label="EsseBeauty, torna all’inizio" className="brand-link" href="#top"><BrandLogo /></a>
        <button
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? "Chiudi il menu" : "Apri il menu"}
          className="menu-toggle"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav aria-label="Navigazione principale" className={`site-nav${open ? " site-nav--open" : ""}`} id="primary-navigation">
          <div className="site-nav__links">
            {links.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
          </div>
          <div className="site-nav__actions">
            <a className="button-secondary" href={SITE_CONFIG.appUrl}>Accedi</a>
            <a className="button-primary" href={SITE_CONFIG.demoMailto}>Richiedi una demo</a>
          </div>
        </nav>
      </div>
    </header>
  );
}
