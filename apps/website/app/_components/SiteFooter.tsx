import { BrandLogo } from "./BrandLogo";
import { SITE_CONFIG } from "../site-config";

export function SiteFooter() {
  return <footer className="site-footer"><div className="section-shell site-footer__inner"><div><a aria-label="EsseBeauty, torna all’inizio" href="#top"><BrandLogo /></a><p>Il gestionale che mette ordine nel lavoro<br />e cura nelle relazioni.</p></div><div><strong>Scopri</strong><a href="#funzionalita">Funzionalità</a><a href="#come-funziona">Come funziona</a><a href="#perche-essebeauty">Perché EsseBeauty</a></div><div><strong>Inizia</strong><a href={SITE_CONFIG.demoMailto}>Richiedi una demo</a><a href={SITE_CONFIG.appUrl}>Accedi</a><a href={`mailto:${SITE_CONFIG.demoEmail}`}>{SITE_CONFIG.demoEmail}</a></div></div><div className="section-shell site-footer__bottom"><span>© {new Date().getFullYear()} EsseBeauty</span><span>Creato con cura per il mondo beauty.</span></div></footer>;
}
