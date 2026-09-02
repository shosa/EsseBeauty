import { ArrowRight, CheckCircle2 } from "lucide-react";

import { ProductPreview } from "./_components/ProductPreview";
import { FeatureShowcase } from "./_components/FeatureShowcase";
import { FinalCta } from "./_components/FinalCta";
import { OutcomeStrip } from "./_components/OutcomeStrip";
import { ReasonsSection } from "./_components/ReasonsSection";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { StepsSection } from "./_components/StepsSection";
import { SITE_CONFIG } from "./site-config";

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <div id="top" />
      <SiteHeader />
      <main id="main-content">
        <span className="sr-only">Funzionalità · Come funziona · Perché EsseBeauty</span>
        <section className="hero section-shell">
          <div className="hero__copy">
            <p className="eyebrow"><span><CheckCircle2 aria-hidden="true" /></span> Il gestionale creato per il mondo beauty</p>
            <h1 aria-label="Il tuo centro estetico, finalmente tutto sotto controllo"><span aria-hidden="true">Il tuo centro estetico, <em>finalmente</em> tutto sotto controllo.</span></h1>
            <p className="hero__lead">Agenda, clienti, team, vendite e crescita: EsseBeauty riunisce ogni parte del tuo lavoro in un unico spazio, semplice da usare e bello da vivere.</p>
            <div className="hero__actions">
              <a className="button-primary button-primary--large" href={SITE_CONFIG.demoMailto}>Richiedi una demo <ArrowRight aria-hidden="true" /></a>
              <a className="text-link" href={SITE_CONFIG.appUrl}>Sei già cliente? <strong>Accedi</strong></a>
            </div>
            <div aria-label="Qualità di EsseBeauty" className="trust-row">
              <span><CheckCircle2 aria-hidden="true" /> Pensato per il beauty</span>
              <span><CheckCircle2 aria-hidden="true" /> Tutto in un unico spazio</span>
              <span><CheckCircle2 aria-hidden="true" /> Accessibile ovunque</span>
            </div>
          </div>
          <ProductPreview />
        </section>
        <OutcomeStrip />
        <FeatureShowcase />
        <StepsSection />
        <ReasonsSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
