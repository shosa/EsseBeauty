import { ArrowUpRight, CalendarDays, Check, CircleDollarSign, Clock3, Sparkles } from "lucide-react";

const appointments = [
  { name: "Giulia Moretti", service: "Rituale viso · 60 min", time: "09:30", tone: "rose" },
  { name: "Elena Russo", service: "Manicure semipermanente", time: "11:00", tone: "plum" },
  { name: "Marta Bianchi", service: "Massaggio relax · 50 min", time: "14:30", tone: "sand" },
];

export function ProductPreview() {
  return (
    <div aria-label="Anteprima illustrativa dello spazio di lavoro EsseBeauty" className="product-preview" role="img">
      <div className="product-preview__glow" />
      <section className="workspace-card">
        <div className="workspace-card__top">
          <div><span className="workspace-kicker">Oggi, martedì 2 settembre</span><strong>Buongiorno, Sofia</strong></div>
          <span className="workspace-avatar">SM</span>
        </div>
        <div className="workspace-summary">
          <div><CalendarDays aria-hidden="true" /><span><strong>12</strong> appuntamenti</span></div>
          <div><CircleDollarSign aria-hidden="true" /><span><strong>€ 684</strong> incasso di oggi</span></div>
        </div>
        <div className="workspace-body">
          <div className="agenda-panel">
            <div className="panel-heading"><div><span>Agenda</span><strong>La tua giornata</strong></div><button aria-label="Apri l’agenda" type="button"><ArrowUpRight aria-hidden="true" /></button></div>
            <div className="appointment-list">
              {appointments.map((item) => (
                <div className="appointment" key={item.time}>
                  <span className="appointment__time">{item.time}</span>
                  <span className={`appointment__marker appointment__marker--${item.tone}`} />
                  <span className="appointment__copy"><strong>{item.name}</strong><small>{item.service}</small></span>
                  <span className="appointment__status"><Check aria-hidden="true" /></span>
                </div>
              ))}
            </div>
          </div>
          <aside className="day-panel">
            <span className="day-panel__icon"><Sparkles aria-hidden="true" /></span>
            <span className="workspace-kicker">Il centro oggi</span>
            <strong>Una giornata ben organizzata.</strong>
            <div className="occupancy"><span><Clock3 aria-hidden="true" /> Occupazione</span><strong>78%</strong></div>
            <div className="occupancy__bar"><span /></div>
            <small>3 collaboratrici attive<br />2 cabine disponibili</small>
          </aside>
        </div>
      </section>
      <div className="floating-note floating-note--left"><span className="note-check"><Check aria-hidden="true" /></span><span><strong>Cliente confermato</strong><small>Promemoria inviato</small></span></div>
      <div className="floating-note floating-note--right"><Sparkles aria-hidden="true" /><span><strong>+1 recensione</strong><small>Richiesta automatica</small></span></div>
    </div>
  );
}
