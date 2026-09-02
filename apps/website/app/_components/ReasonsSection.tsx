import { Blocks, Fingerprint, Gauge, Link2, Shapes } from "lucide-react";

const reasons = [
  { icon: Fingerprint, title: "Nato intorno al beauty", text: "Parla la lingua del centro estetico e segue i suoi flussi reali." },
  { icon: Link2, title: "Tutto resta collegato", text: "Ogni azione aggiorna le informazioni che servono, dove servono." },
  { icon: Gauge, title: "Chiaro anche nei momenti pieni", text: "Interfacce leggibili aiutano il team quando la giornata accelera." },
  { icon: Shapes, title: "Un’esperienza per tutti", text: "Reception, collaboratori e clienti condividono un percorso coerente." },
  { icon: Blocks, title: "Pronto a evolvere", text: "Le funzioni crescono con le esigenze del centro, senza complicarlo." },
];

export function ReasonsSection() {
  return <section aria-labelledby="reasons-title" className="reasons section-shell" id="perche-essebeauty"><div className="section-heading section-heading--center"><p className="eyebrow">Perché EsseBeauty</p><h2 id="reasons-title">Tecnologia che si fa notare<br /><em>solo quando ti semplifica la vita.</em></h2></div><div className="reasons__grid">{reasons.map(({ icon: Icon, text, title }) => <article key={title}><span><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>;
}
