# Onboarding operativo guidato dai moduli

## Obiettivo

Trasformare l'onboarding del nuovo salone da una raccolta anagrafica di cinque passaggi a una configurazione operativa completa e riprendibile. Al termine, il salone deve poter creare appuntamenti validi perché possiede almeno una sede, risorse coerenti, servizi, staff e assegnazioni tra questi elementi.

Il percorso mostra soltanto le configurazioni pertinenti ai moduli attivi. Le dipendenze operative di base restano visibili anche senza moduli opzionali.

## Stato attuale

Il client `apps/web/app/onboarding/page.tsx` usa cinque step fissi: salone, orari, categorie e servizi, staff, riepilogo. L'API `apps/api/src/routes/onboarding/index.ts` salva questi dati e considera completo l'onboarding quando esistono almeno un servizio e un membro dello staff.

Il database supporta già:

- sedi tramite `salon_locations`;
- cabine e altre risorse tramite `salon_resources`;
- sede principale dello staff tramite `staff.location_id`;
- competenze tramite `service_staff`;
- risorse richieste dai servizi tramite `service_resources`;
- moduli del tenant tramite `salon_modules`.

Queste relazioni oggi non fanno parte dell'onboarding. Inoltre, `onboarding_step` descrive soltanto una posizione numerica in un wizard fisso e non prova che la configurazione sia ancora valida.

## Principi di prodotto

1. **Pronti a lavorare, non soltanto registrati.** Il completamento deriva dai dati reali necessari all'agenda.
2. **Percorso proporzionato al piano.** Gli step opzionali vengono inclusi solo se il relativo modulo è attivo.
3. **Salvataggio progressivo.** Ogni sezione è persistita e il titolare può riprendere il percorso senza perdere lavoro.
4. **Correzioni nel contesto.** Il riepilogo collega direttamente la sezione e l'elemento incompleto.
5. **Configurazione minima durante l'onboarding.** Le impostazioni avanzate restano nel gestionale; il wizard raccoglie solo ciò che serve per iniziare.

Questi principi seguono le linee guida locali sull'onboarding: spiegare i benefici, chiedere solo informazioni necessarie, consentire un percorso progressivo e non sostituire l'uso reale dell'app con istruzioni astratte. I form devono usare etichette persistenti, feedback vicino al problema, valori predefiniti ragionevoli e controlli accessibili.

## Modello del percorso

Il server restituisce una manifestazione ordinata degli step, costruita dai moduli attivi e dallo stato dei dati. Il client rende la manifestazione anziché mantenere un array fisso di cinque etichette.

Ogni step contiene almeno:

- `key`: identificatore stabile e non dipendente dalla posizione;
- `label` e `description`;
- `required`: se impedisce il completamento;
- `status`: `not_started`, `in_progress`, `complete` oppure `needs_attention`;
- `issues`: problemi strutturati con codice, messaggio e riferimento all'entità;
- `module_key`: valorizzato solo per step condizionali.

La posizione numerica è calcolata dalla manifestazione. `onboarding_step` può essere mantenuto temporaneamente per compatibilità e telemetria, ma non è la fonte di verità. `onboarding_completed_at` resta il marcatore del primo completamento; la readiness viene sempre ricalcolata.

## Sequenza degli step

### 1. Identità del salone

Raccoglie nome, contatti e dati generali del tenant. Non rappresenta più implicitamente una sede fisica.

Requisiti minimi:

- nome del salone;
- email o telefono consigliati ma non bloccanti.

### 2. Sedi e orari

Ogni salone deve avere una sede principale. Se nessuna sede esiste, i dati anagrafici già presenti vengono usati per precompilarla.

Senza `multi_location`:

- si configura una sola sede principale;
- non viene mostrato il comando per aggiungerne altre.

Con `multi_location`:

- si possono creare più sedi;
- per ogni sede si raccolgono nome, indirizzo, contatti, fuso orario, stato e orari;
- deve esistere almeno una sede attiva.

Gli orari del tenant esistenti vengono usati come predefiniti per la prima sede. La migrazione verso orari specifici per sede non è necessaria in questa prima versione se il modello non li supporta ancora: il wizard può dichiarare esplicitamente che gli orari generali si applicano a tutte le sedi. Un eventuale modello per-sede è un'evoluzione separata.

### 3. Cabine e risorse

Consente di creare cabine o stanze e assegnarle a una sede. Lo step è parte della configurazione operativa quando il modulo `multi_location` è attivo oppure quando il salone dichiara che i servizi richiedono una cabina.

Requisiti minimi:

- ogni risorsa attiva ha un nome e una sede attiva;
- nessuna cabina è obbligatoria per i servizi che non richiedono risorse;
- se un servizio viene associato a una risorsa, quella risorsa deve essere attiva.

Non si introduce un vincolo artificiale di “almeno una cabina” per saloni che lavorano senza cabine dedicate.

### 4. Categorie e servizi

Estende i campi esistenti con:

- durata e prezzo;
- buffer prima e dopo;
- prenotabilità online;
- risorse compatibili o richieste;
- ordine di visualizzazione.

Deve esistere almeno un servizio attivo. La cancellazione e ricreazione integrale oggi usata dall'endpoint onboarding va sostituita con operazioni stabili per ID o con un upsert transazionale: ricreare i servizi invaliderebbe `service_staff`, `service_resources` e ogni altro riferimento.

### 5. Staff

Raccoglie per ogni persona:

- nome visualizzato;
- ruolo professionale;
- contatti opzionali;
- sede principale;
- orari di lavoro;
- collegamento dell'account del titolare, quando richiesto.

Deve esistere almeno un membro attivo. Con più sedi, ogni membro attivo deve avere una sede principale attiva. La configurazione multi-sede dello stesso operatore non viene aggiunta finché il dominio supporta solo un `location_id` per membro.

### 6. Competenze e disponibilità dei servizi

Presenta una matrice servizi × staff con filtri per sede e categoria. Deve offrire:

- assegnazione singola;
- selezione di tutto lo staff visibile;
- copia delle assegnazioni da un membro o servizio;
- conteggio delle coperture mancanti;
- associazione delle risorse necessarie al servizio.

Ogni servizio attivo e prenotabile deve avere almeno un membro dello staff attivo assegnato. Le associazioni salvate sono righe reali in `service_staff`; le risorse sono righe reali in `service_resources`.

### 7. Configurazioni condizionali dei moduli

Gli step sono aggiunti da un registro centrale di definizioni, non da condizioni disperse nella pagina. Nella prima versione, `multi_location` è l'unico modulo che modifica il percorso: abilita sedi aggiuntive e rende visibile la configurazione strutturata di sedi e cabine.

Gli altri moduli attuali (`reminders`, `inventory`, `loyalty`, `packages`, `documents`, `reviews`, `waitlist`, `marketing`, `staff_performance` e `audit_compliance`) non aggiungono uno step nella prima versione, perché dispongono già di valori predefiniti oppure non richiedono una decisione iniziale per rendere operativa l'agenda. Il registro li rappresenta esplicitamente con nessuno step e nessun requisito bloccante, così una futura configurazione minima potrà essere aggiunta senza modificare il componente principale.

Un modulo attivo non deve produrre automaticamente una schermata. Il registro dichiara se il modulo aggiunge uno step, quali dati richiede e se tale requisito è bloccante.

### 8. Verifica e attivazione

Il riepilogo mostra sezioni complete, errori bloccanti e suggerimenti non bloccanti. Ogni problema include un'azione “Correggi” che apre lo step e, quando possibile, seleziona l'entità interessata.

L'attivazione è consentita quando:

- esiste almeno una sede attiva;
- esiste almeno un servizio attivo;
- esiste almeno un membro dello staff attivo;
- ogni servizio prenotabile ha almeno un operatore attivo;
- ogni associazione punta a entità dello stesso salone;
- le risorse richieste sono attive e appartengono a una sede valida;
- tutti i requisiti bloccanti dei moduli attivi sono soddisfatti.

I suggerimenti, come completare tutti i contatti o aggiungere descrizioni ai servizi, non impediscono l'attivazione.

## API e responsabilità

### Lettura

`GET /api/onboarding` restituisce:

- dati necessari a tutti gli step;
- moduli attivi;
- manifestazione degli step;
- readiness complessiva;
- problemi strutturati.

La logica che costruisce manifestazione e readiness vive in funzioni di dominio pure e testabili, per esempio `onboarding-definition.ts` e `onboarding-readiness.ts`, non nel componente React.

### Scrittura

Gli endpoint possono restare separati per sezione, ma devono:

- validare che tutti gli ID appartengano al tenant autenticato;
- aggiornare per ID senza distruggere relazioni esistenti;
- usare transazioni per collezioni e relazioni;
- restituire la readiness aggiornata o consentire un refetch uniforme;
- usare codici errore stabili traducibili dal client.

Nuove sezioni previste:

- sedi;
- risorse;
- staff esteso;
- assegnazioni staff-servizi;
- assegnazioni servizi-risorse;
- configurazioni minime dei moduli registrati.

Si possono riutilizzare le regole delle API impostazioni esistenti, estraendo servizi di dominio condivisi. Il wizard non deve effettuare chiamate interne HTTP alle route delle impostazioni.

### Completamento

`POST /api/onboarding/complete` ricalcola la readiness sul server nella stessa richiesta. Se incompleta restituisce `409 ONBOARDING_INCOMPLETE` con l'elenco dei problemi; non si fida dello step visualizzato dal client.

## Comportamento con cambi di piano

Se un modulo viene attivato durante un onboarding incompleto, il relativo step appare alla lettura successiva. Se viene disattivato, lo step scompare e i suoi requisiti non bloccano più il completamento; i dati già salvati non vengono cancellati.

Dopo il primo completamento, l'attivazione di nuovi moduli non rimanda automaticamente il titolare all'intero onboarding. Il gestionale mostrerà una checklist di configurazione del nuovo modulo, riusando le stesse definizioni di readiness. Questa checklist post-onboarding può essere implementata successivamente, ma il dominio deve renderla possibile.

## UX e accessibilità

- Barra laterale su desktop e indicatore compatto su schermi stretti, entrambi derivati dagli step effettivi.
- Titolo, spiegazione e stato testuale per ogni step; il colore non è l'unico segnale.
- Etichette sempre visibili, messaggi di validazione associati ai campi e focus spostato sul primo errore.
- Target interattivi di almeno 44 punti su mobile e ordine di tabulazione naturale.
- Layout a colonna alle dimensioni compatte e con testo ingrandito; nessuna informazione critica deve essere troncata.
- Pulsante primario con esito chiaro e stato di caricamento; navigazione indietro sempre disponibile dopo il primo step.
- Il progresso indica “N passaggi completati su M” e non una percentuale fuorviante quando gli step hanno pesi diversi.
- Uscire non perde dati già salvati. Il testo comunica che il percorso può essere ripreso.

## Errori e concorrenza

- Un errore di rete conserva le bozze locali e offre un nuovo tentativo.
- Un'entità rimossa o disattivata in un'altra sessione produce `needs_attention` al refetch.
- Gli errori tenant-scope rispondono come risorsa non trovata o non autorizzata senza rivelare dati esterni.
- I salvataggi di collezioni sono atomici.
- La navigazione non avanza se il salvataggio richiesto fallisce.

## Strategia di migrazione

1. Introdurre il calcolo di readiness e la manifestazione mantenendo compatibile il payload attuale.
2. Creare automaticamente una sede principale per gli onboarding incompleti che ne sono privi, precompilandola dai dati del salone.
3. Rendere stabili gli ID di categorie, servizi e staff durante gli aggiornamenti.
4. Aggiungere sedi, risorse e assegnazioni al wizard.
5. Collegare progressivamente le configurazioni dei moduli che hanno requisiti reali.
6. Smettere di usare `onboarding_step` come fonte di verità dopo che client e backoffice leggono la manifestazione.

Non vengono cancellati dati esistenti. Le modifiche allo schema devono essere limitate a eventuali campi realmente mancanti, come gli orari per sede, che restano fuori dalla prima versione salvo ulteriore decisione di prodotto.

## Test

### Dominio

- composizione degli step con combinazioni diverse di moduli;
- readiness per sede, servizio, staff, competenze e risorse;
- disattivazione di un modulo senza perdita dei dati;
- problemi strutturati e link allo step corretto.

### API

- isolamento tra tenant per tutti gli ID ricevuti;
- upsert senza perdita di `service_staff` e `service_resources`;
- transazioni e rollback su payload parzialmente invalido;
- rifiuto del completamento con configurazione incompleta;
- completamento valido con configurazione minima;
- attivazione o disattivazione di moduli durante il percorso.

### Interfaccia

- step visibili derivati dalla risposta API;
- ripresa dallo stato salvato;
- aggiunta di una sola sede senza Multi-sede e più sedi con il modulo;
- creazione e associazione di cabine;
- matrice delle competenze, azioni di massa e copertura mancante;
- correzione dal riepilogo;
- gestione degli errori senza perdita delle bozze;
- navigazione da tastiera, focus sugli errori e comportamento responsive.

### Regressione

- login e redirect degli owner con onboarding incompleto;
- accesso normale per saloni già completati;
- pagine impostazioni di sedi, cabine, staff e servizi;
- creazione appuntamenti con gli stessi vincoli configurati nel wizard.

## Fuori ambito della prima versione

- disponibilità di uno stesso operatore su più sedi quando il modello supporta una sola sede principale;
- orari indipendenti per sede senza un modello dati dedicato;
- configurazione avanzata di ogni modulo;
- importazione massiva da gestionali esterni;
- riapertura automatica dell'intero onboarding dopo l'attivazione di un modulo;
- modifica dei piani commerciali o del sistema di feature flag.

## Criteri di successo

- Un nuovo salone può completare il percorso senza dover visitare subito le pagine impostazioni.
- Dopo il completamento può creare un appuntamento scegliendo un servizio e almeno un operatore valido.
- Con Multi-sede attivo, sedi e cabine risultano già configurate e coerenti.
- Nessun servizio prenotabile viene lasciato senza personale.
- Gli step mostrati corrispondono ai moduli attivi e cambiano senza modifiche al componente principale.
- Le relazioni esistenti non vengono perse modificando catalogo o staff durante l'onboarding.
