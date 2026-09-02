import { ArrowRight } from "lucide-react";

const steps = [
  { number: "01", title: "Raccontaci il tuo centro", text: "Servizi, team, spazi e regole: EsseBeauty prende la forma del tuo modo di lavorare." },
  { number: "02", title: "Porta tutto in un unico spazio", text: "La giornata si muove tra agenda, clienti e vendite senza perdere informazioni per strada." },
  { number: "03", title: "Cresci con più consapevolezza", text: "Dati chiari e relazioni curate ti aiutano a scegliere il prossimo passo con serenità." },
];

export function StepsSection() {
  return <section aria-labelledby="steps-title" className="steps" id="come-funziona"><div className="section-shell"><div className="steps__heading"><p className="eyebrow">Semplice dall’inizio</p><h2 id="steps-title">Dal primo giorno,<br /><em>più ordine e più respiro.</em></h2></div><ol>{steps.map((step, index) => <li key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p>{index < steps.length - 1 && <ArrowRight aria-hidden="true" />}</li>)}</ol></div></section>;
}
