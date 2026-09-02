import type { Metadata } from "next";
import { ArrowDown, ArrowRight, CalendarDays, ChartNoAxesCombined, FileSignature, HeartHandshake, Megaphone, PackageOpen, ShoppingBag, UsersRound } from "lucide-react";

import { FinalCta } from "../_components/FinalCta";
import { SiteFooter } from "../_components/SiteFooter";
import { SiteHeader } from "../_components/SiteHeader";
import { MODULE_GROUPS } from "./module-catalog";

export const metadata: Metadata = {
  description: "Scopri tutti i moduli di EsseBeauty per agenda, clienti, team, vendite, magazzino, marketing, documenti e analisi.",
  openGraph: { description: "Tutti i moduli EsseBeauty, connessi in un unico spazio di lavoro.", title: "Tutti i moduli | EsseBeauty" },
  title: "Tutti i moduli | EsseBeauty",
};

const icons = [CalendarDays, HeartHandshake, UsersRound, ShoppingBag, PackageOpen, Megaphone, FileSignature, ChartNoAxesCombined];

export default function ModulesPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">Vai al contenuto</a><div id="top" /><SiteHeader />
      <main id="main-content">
        <section className="modules-hero section-shell"><p className="eyebrow">Dentro EsseBeauty</p><h1>Tutti i moduli.<br /><em>Un solo modo di lavorare meglio.</em></h1><p>Ogni area risolve una parte concreta del lavoro. Insieme formano una suite in cui le informazioni si muovono con te, senza duplicazioni e senza salti tra strumenti.</p><a className="text-link modules-hero__jump" href="#catalogo">Esplora il catalogo <ArrowDown aria-hidden="true" /></a></section>
        <nav aria-label="Categorie dei moduli" className="module-jump-nav section-shell">{MODULE_GROUPS.map((group) => <a href={`#${group.id}`} key={group.id}>{group.title}</a>)}</nav>
        <div className="module-catalog section-shell" id="catalogo">
          {MODULE_GROUPS.map((group, groupIndex) => {
            const Icon = icons[groupIndex] ?? CalendarDays;
            return <section aria-labelledby={`${group.id}-title`} className="module-group" id={group.id} key={group.id}><div className="module-group__intro"><span className="module-group__icon"><Icon aria-hidden="true" /></span><p className="eyebrow">{group.eyebrow}</p><h2 id={`${group.id}-title`}>{group.title}</h2><p>{group.description}</p></div><div className="module-card-grid">{group.modules.map((module) => <article className="module-card" key={module.name}><span className="module-card__line" /><h3>{module.name}</h3><p>{module.description}</p><ul>{module.capabilities.map((capability) => <li key={capability}><ArrowRight aria-hidden="true" />{capability}</li>)}</ul></article>)}</div></section>;
          })}
        </div>
        <section className="modules-connection section-shell"><p className="eyebrow">La differenza è nella connessione</p><h2>Non otto strumenti separati.<br /><em>Un’unica giornata che scorre.</em></h2><p>Un appuntamento aggiorna il cliente. Una vendita muove il magazzino. Un servizio concluso può aprire una richiesta di recensione. È così che ogni modulo diventa più utile insieme agli altri.</p></section>
        <FinalCta />
      </main><SiteFooter />
    </>
  );
}
