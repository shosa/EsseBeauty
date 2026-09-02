import { ArrowRight, Sparkles } from "lucide-react";

import { SITE_CONFIG } from "../site-config";
import { DemoContactButton } from "./DemoContact";

export function FinalCta() {
  return <section className="final-cta section-shell"><div className="final-cta__mark"><Sparkles aria-hidden="true" /></div><p className="eyebrow">Il prossimo passo</p><h2>Il tuo centro merita un modo<br /><em>più semplice di crescere.</em></h2><p>Scopri come EsseBeauty può entrare nella tua giornata e renderla più chiara, connessa e leggera.</p><div><DemoContactButton className="button-primary button-primary--light">Richiedi una demo <ArrowRight aria-hidden="true" /></DemoContactButton><a className="final-cta__login" href={SITE_CONFIG.appUrl}>Sei già cliente? <strong>Accedi a EsseBeauty</strong></a></div></section>;
}
