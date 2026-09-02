import { BarChart3, Box, CalendarDays, Check, Megaphone, PackageCheck, ShoppingBag, Sparkles, Star, UsersRound } from "lucide-react";

const features = [
  {
    label: "Agenda e lista d’attesa",
    title: "Ogni giornata scorre meglio.",
    text: "Dagli appuntamenti alle cabine, ogni dettaglio è al posto giusto. Tu vedi la giornata intera, il team sa sempre cosa fare.",
    bullets: ["Agenda chiara per staff e risorse", "Lista d’attesa pronta a riempire gli spazi", "Promemoria e richieste sempre collegate"],
    kind: "agenda",
  },
  {
    label: "Clienti e fidelizzazione",
    title: "Ogni cliente è davvero conosciuto.",
    text: "Preferenze, storico, consensi e percorsi restano insieme. Così ogni relazione continua da dove era rimasta.",
    bullets: ["Schede cliente complete e ricercabili", "Programmi fedeltà, pacchetti e buoni", "Documenti, consensi e recensioni"],
    kind: "clients",
  },
  {
    label: "Cassa e magazzino",
    title: "Ogni vendita resta sotto controllo.",
    text: "Servizi, prodotti, spese e scorte si aggiornano nello stesso flusso: dalla cassa al magazzino, senza ricostruzioni a fine giornata.",
    bullets: ["Cassa veloce per servizi e prodotti", "Scorte, fornitori e movimenti tracciati", "Pacchetti e voucher assegnati al cliente"],
    kind: "commerce",
  },
  {
    label: "Marketing e recensioni",
    title: "Ogni decisione parte dai dati giusti.",
    text: "Leggi l’andamento del centro e trasforma ciò che sai in comunicazioni più pertinenti, relazioni più forti e scelte consapevoli.",
    bullets: ["Indicatori operativi sempre leggibili", "Campagne WhatsApp mirate e consapevoli", "Raccolta recensioni collegata al servizio"],
    kind: "insights",
  },
] as const;

function MiniPreview({ kind }: { kind: (typeof features)[number]["kind"] }) {
  if (kind === "agenda") return <div className="feature-ui feature-ui--agenda"><div className="feature-ui__bar"><CalendarDays aria-hidden="true" /><strong>Mercoledì 3</strong><span>8 appuntamenti</span></div>{["09:00  Trattamento viso", "10:30  Pedicure spa", "12:00  Massaggio relax"].map((item, index) => <div className="mini-row" key={item}><span>{item.slice(0,5)}</span><i className={`mini-dot mini-dot--${index}`} /><strong>{item.slice(7)}</strong><Check aria-hidden="true" /></div>)}</div>;
  if (kind === "clients") return <div className="feature-ui feature-ui--client"><div className="client-card"><span className="client-avatar">AR</span><div><strong>Anna Rinaldi</strong><small>Cliente dal 2022 · Gold</small></div></div><div className="client-stats"><span><strong>18</strong> visite</span><span><strong>420</strong> punti</span><span><strong>3</strong> preferenze</span></div><div className="client-note"><Sparkles aria-hidden="true" /><span><strong>Il prossimo gesto giusto</strong><small>Ricorda il trattamento viso preferito da Anna.</small></span></div></div>;
  if (kind === "commerce") return <div className="feature-ui feature-ui--commerce"><div className="commerce-total"><span>Vendite di oggi</span><strong>€ 684,00</strong><small>Servizi e prodotti aggiornati</small></div><div className="commerce-grid"><span><ShoppingBag aria-hidden="true" /><strong>9</strong><small>servizi</small></span><span><Box aria-hidden="true" /><strong>3</strong><small>prodotti</small></span><span><PackageCheck aria-hidden="true" /><strong>2</strong><small>riordini</small></span></div></div>;
  return <div className="feature-ui feature-ui--insights"><div className="insight-heading"><div><span>Il centro questo mese</span><strong>Un andamento da leggere</strong></div><BarChart3 aria-hidden="true" /></div><div className="bars" aria-hidden="true">{[52,74,62,88,70,94,82].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="insight-foot"><span><Megaphone aria-hidden="true" /> Campagna clienti inattivi</span><span><Star aria-hidden="true" /> Nuove recensioni</span></div></div>;
}

export function FeatureShowcase() {
  return (
    <section aria-labelledby="features-title" className="features section-shell" id="funzionalita">
      <div className="section-heading"><p className="eyebrow">Tutto ciò che serve. Insieme.</p><h2 id="features-title">Un unico spazio per far funzionare <em>davvero</em> il tuo centro.</h2><p>Non una somma di strumenti. Un modo più semplice di vedere, organizzare e far crescere il lavoro.</p></div>
      <div className="feature-list">
        {features.map((feature, index) => (
          <article className={`feature${index % 2 ? " feature--reverse" : ""}`} key={feature.label}>
            <div className="feature__copy"><span className="feature__number">0{index + 1}</span><p className="feature__label">{feature.label}</p><h3>{feature.title}</h3><p>{feature.text}</p><ul>{feature.bullets.map((bullet) => <li key={bullet}><Check aria-hidden="true" />{bullet}</li>)}</ul></div>
            <div className="feature__visual"><MiniPreview kind={feature.kind} /><span className="feature-orb"><UsersRound aria-hidden="true" /></span></div>
          </article>
        ))}
      </div>
    </section>
  );
}
