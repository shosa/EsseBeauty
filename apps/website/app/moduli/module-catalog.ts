export interface ModuleCard {
  capabilities: readonly string[];
  description: string;
  name: string;
}

export interface ModuleGroup {
  description: string;
  eyebrow: string;
  id: string;
  modules: readonly ModuleCard[];
  title: string;
}

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  {
    id: "agenda-operativita", eyebrow: "Organizza la giornata", title: "Agenda e operatività",
    description: "Tutto ciò che serve per trasformare richieste, disponibilità e spazi in una giornata ordinata e sempre leggibile.",
    modules: [
      { name: "Agenda professionale", description: "Visualizza appuntamenti, durate, collaboratori e stati in un calendario pensato per il ritmo del centro.", capabilities: ["Viste giorno, settimana e mese", "Spostamento e gestione degli stati", "Ricerca rapida di clienti e servizi"] },
      { name: "Lista d’attesa", description: "Raccogli le preferenze dei clienti e recupera più facilmente gli spazi che si liberano in agenda.", capabilities: ["Preferenze di giorno e fascia oraria", "Passaggio diretto a nuovo appuntamento", "Stato delle richieste"] },
      { name: "Cabine e risorse", description: "Coordina spazi e attrezzature insieme al personale, evitando sovrapposizioni difficili da vedere.", capabilities: ["Agenda per risorsa", "Disponibilità delle cabine", "Associazione ai servizi"] },
      { name: "Regole del centro", description: "Definisci orari, chiusure, intervalli e limiti di prenotazione che guidano il lavoro quotidiano.", capabilities: ["Orari e giorni di apertura", "Chiusure singole o ricorrenti", "Preavviso e durata degli slot"] },
    ],
  },
  {
    id: "clienti-fidelizzazione", eyebrow: "Conosci ogni persona", title: "Clienti e fidelizzazione",
    description: "Una memoria condivisa del rapporto con ogni cliente, utile alla reception, al team e alle attività di relazione.",
    modules: [
      { name: "Rubrica clienti", description: "Trova subito ogni persona e conserva dati, preferenze e informazioni operative in una scheda ordinata.", capabilities: ["Ricerca e segmentazione", "Storico e note", "Consensi di comunicazione"] },
      { name: "Programma fedeltà", description: "Rendi visibili punti, movimenti e premi per dare continuità alla relazione dopo ogni visita.", capabilities: ["Saldo e storico punti", "Livelli e soglie", "Riscatto premi tracciato"] },
      { name: "Pacchetti", description: "Assegna percorsi di servizi al cliente e controlla utilizzi e disponibilità direttamente dalla sua scheda.", capabilities: ["Assegnazione nominativa", "Scalaggio degli utilizzi", "Stato del pacchetto"] },
      { name: "Buoni regalo", description: "Crea e utilizza voucher collegati al cliente, mantenendo valore e utilizzi nel flusso di vendita.", capabilities: ["Emissione da cassa", "Associazione al cliente", "Controllo del valore residuo"] },
    ],
  },
  {
    id: "team-risorse", eyebrow: "Lavora come una squadra", title: "Team e risorse",
    description: "Strumenti per coordinare collaboratori, responsabilità e disponibilità senza perdere il controllo operativo del centro.",
    modules: [
      { name: "Collaboratori", description: "Raccogli profilo, ruolo, servizi e stato di ogni persona che lavora all’interno del centro.", capabilities: ["Scheda professionale", "Servizi abilitati", "Stato e sedi operative"] },
      { name: "Permessi", description: "Assegna accessi coerenti con il ruolo, lasciando visibili solo le aree necessarie al lavoro quotidiano.", capabilities: ["Ruoli e permessi granulari", "Accesso per area", "Controllo delle azioni sensibili"] },
      { name: "Disponibilità e ferie", description: "Gestisci orari personali, indisponibilità e richieste che modificano la capacità dell’agenda.", capabilities: ["Orari settimanali", "Blocchi di disponibilità", "Richieste e approvazioni"] },
      { name: "App collaboratori", description: "Offri al team uno spazio dedicato per consultare il lavoro e inviare richieste senza entrare nella console completa.", capabilities: ["Agenda personale", "Richieste disponibilità", "Esperienza installabile"] },
    ],
  },
  {
    id: "cassa-vendite", eyebrow: "Chiudi bene ogni servizio", title: "Cassa e vendite",
    description: "Un flusso commerciale che unisce cliente, servizi, prodotti e strumenti di pagamento senza passaggi scollegati.",
    modules: [
      { name: "Cassa", description: "Componi il conto partendo dall’agenda oppure crea una vendita libera con pochi passaggi chiari.", capabilities: ["Richiamo appuntamenti del giorno", "Servizi e prodotti nello stesso conto", "Cliente occasionale o registrato"] },
      { name: "Catalogo servizi", description: "Organizza trattamenti, categorie, prezzi e durate per renderli immediatamente utilizzabili in agenda e cassa.", capabilities: ["Categorie di servizio", "Durate e prezzi", "Associazione a staff e risorse"] },
      { name: "Prodotti", description: "Vendi prodotti professionali insieme ai servizi mantenendo il collegamento con cliente e disponibilità.", capabilities: ["Ricerca prodotto", "Prezzo di vendita", "Aggiornamento delle scorte"] },
      { name: "Pagamenti e assegnazioni", description: "Registra il pagamento e collega immediatamente pacchetti o voucher alla persona che li utilizzerà.", capabilities: ["Metodi di pagamento", "Assegnazione pacchetti", "Utilizzo dei buoni"] },
    ],
  },
  {
    id: "magazzino-acquisti", eyebrow: "Conosci ciò che entra e ciò che esce", title: "Magazzino e acquisti",
    description: "Una visione operativa di prodotti, documenti e costi per gestire le scorte senza ricostruzioni manuali.",
    modules: [
      { name: "Scorte e movimenti", description: "Controlla disponibilità e variazioni di ogni prodotto con una cronologia leggibile e collegata alle operazioni.", capabilities: ["Carichi e scarichi", "Soglie di riordino", "Storico dei movimenti"] },
      { name: "Fornitori", description: "Mantieni i riferimenti dei fornitori vicini ai prodotti e ai documenti che li riguardano.", capabilities: ["Anagrafica fornitore", "Associazione prodotti", "Riferimenti di acquisto"] },
      { name: "Documenti di magazzino", description: "Registra acquisti, rettifiche e spese attraverso righe strutturate e date di competenza.", capabilities: ["Documenti multi-riga", "IVA e valori in euro", "Contabilizzazione dei movimenti"] },
      { name: "Conteggi e analisi", description: "Confronta la quantità fisica con quella registrata e leggi il valore delle scorte del centro.", capabilities: ["Conteggio fisico", "Riconciliazione differenze", "Valore e rotazione delle scorte"] },
    ],
  },
  {
    id: "marketing-whatsapp", eyebrow: "Comunica con più pertinenza", title: "Marketing e WhatsApp",
    description: "Dalla segmentazione alla conversazione, ogni comunicazione parte da informazioni e consensi già presenti nel lavoro quotidiano.",
    modules: [
      { name: "Campagne marketing", description: "Prepara comunicazioni mirate scegliendo il pubblico giusto e controllando destinatari inclusi ed esclusi.", capabilities: ["Anteprima destinatari", "Pianificazione invio", "Stato delle consegne"] },
      { name: "Modelli riutilizzabili", description: "Conserva testi e strutture ricorrenti per creare più rapidamente campagne coerenti con il centro.", capabilities: ["Libreria modelli", "Creazione e modifica", "Riutilizzo nelle campagne"] },
      { name: "WhatsApp workspace", description: "Gestisci conversazioni collegate ai clienti e continua il lavoro senza perdere il contesto della relazione.", capabilities: ["Rubrica contatti", "Conversazioni e non letti", "Collegamento alla scheda cliente"] },
      { name: "Consensi marketing", description: "Registra la volontà del cliente e la provenienza del consenso prima di includerlo nelle comunicazioni.", capabilities: ["Stato del consenso", "Fonte e nota", "Controllo prima delle campagne"] },
    ],
  },
  {
    id: "recensioni-documenti", eyebrow: "Cura fiducia e conformità", title: "Recensioni e documenti",
    description: "Richieste, firme ed evidenze restano collegate al servizio e alla persona, con uno stato sempre comprensibile.",
    modules: [
      { name: "Raccolta recensioni", description: "Invia richieste dopo i servizi completati e controlla il percorso senza solleciti improvvisati.", capabilities: ["Inviti collegati all’appuntamento", "Canali di consegna", "Stato e recupero invii"] },
      { name: "Gestione recensioni", description: "Leggi e organizza i feedback ricevuti per trasformarli in una vista utile al lavoro del centro.", capabilities: ["Elenco feedback", "Stati operativi", "Collegamento al cliente"] },
      { name: "Modelli di consenso", description: "Prepara documenti riutilizzabili per i trattamenti e mantieni una base coerente per le nuove richieste.", capabilities: ["Creazione modelli", "Campi e versioni", "Associazione ai servizi"] },
      { name: "Firma ed evidenze", description: "Condividi richieste di firma e conserva stato, scadenza ed evidenza del documento sottoscritto.", capabilities: ["Link di firma", "Scadenza controllata", "Download dell’evidenza"] },
    ],
  },
  {
    id: "report-amministrazione", eyebrow: "Decidi con una vista più chiara", title: "Report e amministrazione",
    description: "Indicatori, configurazioni e controlli mantengono leggibile l’andamento del centro e il modo in cui la suite lavora.",
    modules: [
      { name: "Dashboard operativa", description: "Riunisce appuntamenti, attività e indicatori utili per iniziare la giornata dalla situazione reale.", capabilities: ["Agenda del giorno", "Indicatori sintetici", "Attività da gestire"] },
      { name: "Report", description: "Consulta viste dedicate all’andamento commerciale e operativo senza estrarre dati in strumenti separati.", capabilities: ["Vendite e servizi", "Confronti temporali", "Indicatori del centro"] },
      { name: "Contabilità operativa", description: "Leggi incassi, registri e spese registrate per seguire il lato economico delle attività quotidiane.", capabilities: ["Panoramica economica", "Registri di cassa", "Spese collegate"] },
      { name: "Impostazioni e sedi", description: "Configura identità, sedi, moduli e preferenze che determinano l’esperienza del centro.", capabilities: ["Profilo e sedi", "Attivazione moduli", "Preferenze operative"] },
    ],
  },
];
