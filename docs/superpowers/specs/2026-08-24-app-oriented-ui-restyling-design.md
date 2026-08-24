# EsseBeauty App-Oriented UI Restyling

## Obiettivo

Trasformare l'intera dashboard salon in un gestionale modulare e immediato, ispirato alla chiarezza applicativa di Odoo ma ottimizzato per il lavoro quotidiano di un salone. Agenda, Cassa e attività urgenti devono restare raggiungibili in un gesto; ogni funzione avanzata deve avere l'identità e i confini di una vera app.

Questa specifica sostituisce la precedente direzione “Connected Workspace” dove le due entrano in conflitto. Funzioni, API e modello dati esistenti restano invariati, salvo preferenze UI strettamente necessarie.

## Direzione approvata

La direzione è **App shell ibrida**:

- rail globale compatta e persistente per Home, app recenti e launcher;
- launcher completo delle app, ricercabile e organizzato per dominio;
- topbar globale per contesto, ricerca, notifiche, creazione rapida e profilo;
- navigazione secondaria contestuale dentro l'app aperta;
- Home come centro operativo trasversale;
- identità visiva distinta ma coerente per ogni app;
- densità media, alta nelle tabelle e rilassata nei riepiloghi;
- brand EsseBeauty riconoscibile, con mulberry usato per orientamento e azioni anziché come decorazione dominante.

## Tassonomia delle app

Le funzioni sono presentate in quattro domini, senza cambiare i route URL esistenti.

1. **Giornata**: Home, Agenda, Cassa.
2. **Relazioni**: Clienti, Staff, Servizi, Buoni acquisto.
3. **Crescita**: Marketing, Fedeltà, Recensioni, Lista d'attesa.
4. **Controllo**: Inventario, Contabilità, Report, Consensi, Pacchetti, Attività e Impostazioni.

I moduli disabilitati non appaiono nel launcher o nelle azioni contestuali. Le destinazioni fondamentali non soggette a feature flag restano sempre disponibili. I nomi visibili usano italiano corretto, inclusi accenti come “Contabilità”, “Fedeltà” e “Attività”.

## Shell globale

### Rail applicativa

Su desktop una rail larga circa 72–80 px contiene:

- marchio EsseBeauty e ritorno alla Home;
- pulsante launcher;
- Agenda e Cassa come app fissate;
- fino a quattro app recenti o preferite;
- Impostazioni, notifiche e profilo nella parte inferiore.

Icona, tooltip e stato attivo rendono ogni voce comprensibile anche senza etichetta permanente. La rail può espandersi temporaneamente per mostrare i nomi, ma non occupa stabilmente la larghezza dell'attuale sidebar.

### Launcher

Il launcher si apre come pannello ampio sopra il workspace. Mostra:

- ricerca immediata;
- app raggruppate per dominio;
- indicatori utili, per esempio richieste pendenti o scorte basse;
- preferiti e app recenti;
- spiegazione breve per moduli meno frequenti.

Il launcher è navigabile da tastiera e si chiude dopo l'apertura di un'app.

### Topbar

La topbar include:

- nome e icona dell'app corrente;
- breadcrumb o selettore della vista interna;
- ricerca globale con `Ctrl/Cmd+K`;
- azione primaria contestuale;
- inbox/notifiche;
- profilo e uscita.

Le azioni globali non vengono duplicate nell'header della pagina. Su mobile la topbar espone launcher, titolo, azione primaria e inbox.

### Navigazione contestuale

Ogni app può dichiarare tab o viste secondarie. Esempi:

- Agenda: Giorno, Settimana, appuntamenti e disponibilità;
- Cassa: Vendita, storico e chiusura;
- Clienti: Elenco, segmenti e dettagli;
- Impostazioni: Salone, team e accessi, operatività, comunicazioni e moduli.

La navigazione contestuale appare sotto la topbar e non crea una seconda sidebar concorrente.

## Home operativa

La Home risponde a quattro domande in ordine:

1. Cosa succede oggi?
2. Cosa richiede attenzione?
3. Come sta andando il salone?
4. Qual è l'azione più probabile adesso?

Contiene:

- saluto, data, sede corrente e stato della giornata;
- KPI essenziali: incasso, appuntamenti, occupazione e attività pendenti;
- timeline sintetica degli appuntamenti odierni;
- inbox unificata per prenotazioni online, richieste staff, lista d'attesa, recensioni e scorte;
- azioni rapide contestuali;
- stato team e moduli in secondo piano;
- collegamenti diretti ai record interessati, senza dashboard decorative prive di azione.

## Pattern delle app

### Liste e archivi

Clienti, Staff, Servizi, Inventario, Marketing, Buoni e viste analoghe condividono:

- header compatto con titolo, conteggio e azione primaria;
- toolbar unica con ricerca, filtri, ordinamento e viste salvabili localmente;
- tabella desktop densa e lista strutturata mobile;
- selezione multipla solo dove esistono azioni reali;
- azioni di riga esplicite, con menu per quelle secondarie;
- stato vuoto che spiega il valore dell'app e propone il primo passo;
- loading, errori e feedback uniformi.

### Dettagli e form

I dettagli usano riepilogo principale, tab contestuali e pannello azioni. I form:

- raggruppano i campi per decisione, non per schema database;
- mantengono l'azione di salvataggio raggiungibile;
- indicano modifiche non salvate;
- mostrano errori accanto al campo e un riepilogo quando necessario;
- usano conferme solo per operazioni irreversibili o ad alto impatto.

### Agenda e Cassa

Agenda e Cassa rimangono workspace specializzati, non vengono forzate nel layout tabellare standard.

L'Agenda privilegia timeline, risorse, drag/resize, filtri, legenda e dettaglio appuntamento. La Cassa privilegia composizione della vendita, cliente, righe, pagamento e riepilogo persistente. Entrambe usano la stessa shell, topbar, feedback e linguaggio visivo delle altre app.

## Componenti e architettura frontend

La configurazione delle app diventa una fonte unica tipizzata contenente chiave, nome, descrizione, dominio, icona, route, feature flag, colore di accento e azioni rapide. Rail, launcher, topbar, breadcrumb, ricerca e navigazione mobile consumano questa configurazione.

`@esse-beauty/ui` resta la fonte delle primitive condivise. Deve coprire almeno:

- app shell, launcher e topbar;
- page header compatto e navigazione contestuale;
- toolbar, filtri, data table e structured mobile list;
- KPI, inbox item, empty/error/loading state;
- form field, action bar, dialog, drawer e toast;
- badge, menu, tooltip e focus state.

Le pagine non devono introdurre nuove copie locali di card, toolbar, badge o skeleton. I file troppo grandi modificati dal restyling vengono divisi per responsabilità senza riscrivere logica non correlata.

## Sistema visivo

- Superficie workspace: neutri caldi molto chiari.
- Shell: tono scuro del brand, compatto e sobrio.
- Accento globale: mulberry EsseBeauty.
- Accento app: variazione controllata usata solo per icona, stato attivo e piccoli indicatori.
- Card: bordo sottile, ombra minima, raggio ridotto rispetto all'interfaccia attuale.
- Tipografia: sans serif leggibile; gerarchia ottenuta con peso, dimensione e spaziatura, non con riquadri decorativi.
- Tabelle: righe da circa 44–48 px su desktop.
- Motion: 140–220 ms, solo per transizioni che chiariscono stato e posizione.
- Icone: set coerente con stroke e dimensioni uniformi; emoji escluse dall'interfaccia finale.

## Responsive e accessibilità

- Desktop: rail persistente, contenuto fluido e topbar completa.
- Tablet: rail compatta, toolbar adattiva e pannelli a due colonne quando sostenibili.
- Mobile: launcher full-screen, barra superiore essenziale, eventuale bottom navigation limitata a Home, Agenda, Cassa e Altro.
- Tabelle complesse diventano liste strutturate; non vengono semplicemente ritagliate orizzontalmente.
- Target interattivi minimi 44 px su touch.
- Tutte le operazioni principali sono disponibili da tastiera.
- Focus visibile, contrasto WCAG AA, label accessibili e stato non comunicato dal solo colore.
- `prefers-reduced-motion` disabilita transizioni non essenziali.

## Stati, errori e continuità operativa

- Skeleton coerenti preservano la geometria della pagina.
- Errori di caricamento mantengono contesto e offrono “Riprova”.
- Errori di salvataggio non cancellano gli input dell'utente.
- L'inbox distingue priorità, origine, stato letto e destinazione.
- Ricerca e launcher funzionano anche quando singoli endpoint opzionali falliscono.
- Le preferenze UI non devono bloccare il rendering se non disponibili.

## Strategia di consegna

L'implementazione copre l'intera dashboard ma resta suddivisa in commit reversibili:

1. configurazione app, token e primitive;
2. shell, launcher, topbar e mobile navigation;
3. Home operativa;
4. Agenda e Cassa;
5. liste, dettagli e form delle app Relazioni;
6. app Crescita e Controllo;
7. Impostazioni;
8. responsive, accessibilità e rifinitura trasversale.

Ogni fase deve lasciare l'app compilabile e i flussi esistenti utilizzabili. Il branch dedicato è `codex/app-oriented-ui-restyling`; `main` resta il punto di ripristino sincronizzato con GitHub al commit `433e5f0`.

## Verifica e criteri di accettazione

- Tutte le route dashboard esistenti sono raggiungibili dal launcher o dalla navigazione contestuale appropriata.
- I feature flag continuano a nascondere i moduli disabilitati.
- Home, Agenda, Cassa, Clienti e Impostazioni funzionano a 1440 px, 1024 px e 390 px.
- Ricerca globale, launcher, notifiche, creazione rapida, logout e preferenze shell restano funzionanti.
- CRUD, calendario, checkout e onboarding non subiscono regressioni funzionali.
- Nessun testo con encoding corrotto o accenti mancanti nelle superfici modificate.
- Test contrattuali coprono configurazione app, navigazione, primitive e route critiche.
- Test web e API rilevanti, typecheck e build terminano con successo.
- Controllo visuale delle route rappresentative eseguito su desktop e mobile.
- Nessuna modifica intenzionale ai contratti API o allo schema dati, salvo una migrazione esplicitamente motivata per preferenze UI.
