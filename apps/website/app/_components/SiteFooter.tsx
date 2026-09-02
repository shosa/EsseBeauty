import { BrandLogo } from "./BrandLogo";
import { SITE_CONFIG } from "../site-config";
import { DemoContactButton } from "./DemoContact";

export function SiteFooter() {
  return <footer className="site-footer"><div className="section-shell site-footer__inner"><div><a aria-label="EsseBeauty, torna all’inizio" href="/"><BrandLogo /></a><p>Il gestionale che mette ordine nel lavoro<br />e cura nelle relazioni.</p></div><div><strong>Scopri</strong><a href="/#funzionalita">Funzionalità</a><a href="/moduli">Tutti i moduli</a><a href="/#come-funziona">Come funziona</a><a href="/#perche-essebeauty">Perché EsseBeauty</a></div><div><strong>Inizia</strong><DemoContactButton className="footer-demo-button">Richiedi una demo</DemoContactButton><a href={SITE_CONFIG.appUrl}>Accedi</a><a href={`mailto:${SITE_CONFIG.demoEmail}`}>{SITE_CONFIG.demoEmail}</a></div></div><div className="section-shell site-footer__bottom"><span>© {new Date().getFullYear()} EsseBeauty</span><span>Creato con cura per il mondo beauty.</span></div></footer>;
}
