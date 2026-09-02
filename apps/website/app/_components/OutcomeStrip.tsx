import { HeartHandshake, Layers3, TimerReset } from "lucide-react";

const outcomes = [
  { icon: TimerReset, title: "Più tempo per le persone", text: "Meno passaggi manuali, meno strumenti da rincorrere durante la giornata." },
  { icon: Layers3, title: "Un’unica verità", text: "Agenda, clienti e vendite parlano tra loro, senza informazioni duplicate." },
  { icon: HeartHandshake, title: "Un’esperienza più curata", text: "Il team lavora meglio e ogni cliente si sente riconosciuto." },
];

export function OutcomeStrip() {
  return (
    <section aria-labelledby="outcomes-title" className="outcomes section-shell">
      <div className="outcomes__intro"><p className="eyebrow">Meno caos. Più bellezza.</p><h2 id="outcomes-title">Quando tutto è connesso,<br /><em>il lavoro cambia ritmo.</em></h2></div>
      <div className="outcomes__grid">
        {outcomes.map(({ icon: Icon, text, title }) => <article key={title}><span><Icon aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </section>
  );
}
