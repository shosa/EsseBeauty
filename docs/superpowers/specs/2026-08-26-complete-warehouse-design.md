# Magazzino completo — Specifica di progettazione

## Obiettivo

Trasformare l'attuale modulo `Inventario` in `Magazzino`, un workspace operativo unico per governare articoli, giacenze, acquisti, consumi, attrezzature, spese, fornitori, documenti e inventari fisici. Il modulo deve supportare il lavoro quotidiano del salone senza perdere la tracciabilità economica e operativa.

Il route namespace `/inventory`, la feature key `inventory` e il permesso `inventory.manage` restano invariati per compatibilità. Tutte le etichette visibili diventano `Magazzino`.

## Stato attuale e vincoli

L'implementazione esistente contiene:

- `inventory_products`, con una quantità aggregata per prodotto;
- `inventory_movements`, con variazioni singole prive di un documento padre;
- richieste di riordino basilari;
- CRUD prodotto, storico movimenti e movimento rapido;
- collegamento dei prodotti venduti alla cassa.

Mancano fornitori strutturati, documenti di acquisto/scarico, righe bulk, inventari fisici, articoli non vendibili, beni e spese, valorizzazione affidabile, annullamenti tracciati e report acquisti/consumi.

Il nuovo dominio deve preservare prodotti, quantità e movimenti esistenti. Le vendite continueranno a scaricare automaticamente gli articoli inventariabili.

## Principi del dominio

1. La giacenza deriva da movimenti registrati, non da modifiche manuali non tracciate.
2. Ogni operazione bulk appartiene a un documento.
3. Una registrazione confermata è immutabile; correzioni e annullamenti generano movimenti compensativi.
4. Articolo, tracciamento della scorta e destinazione economica sono concetti distinti.
5. Attrezzature e spese possono comparire negli acquisti senza rimanere in giacenza.
6. Tutte le query e mutazioni sono isolate per `salonId` e protette da `inventory.manage`.
7. Importi monetari sono memorizzati in centesimi; quantità supportano valori decimali tramite unità minime esplicite.

## Modello articoli

`inventory_products` viene estesa senza sostituirla. Ogni articolo possiede:

- nome, SKU, barcode, categoria e unità di misura;
- `itemType`: `resale`, `consumable`, `equipment`, `expense`;
- `trackStock`: vero per articoli che generano giacenza;
- prezzo di vendita, ultimo costo e costo medio;
- soglia minima, quantità di riordino e fornitore preferito;
- stato attivo/archiviato;
- possibilità di vendita, consumo interno e stock negativo configurabili separatamente.

Comportamenti predefiniti:

- `resale`: inventariabile e vendibile;
- `consumable`: inventariabile, non vendibile e scaricabile per uso interno;
- `equipment`: non inventariabile, registrato nello storico beni acquistati;
- `expense`: non inventariabile, registrato come costo gestionale.

Le impostazioni possono essere personalizzate per articolo senza cambiare il tipo.

## Fornitori

Una nuova anagrafica fornitori contiene ragione sociale, referente, partita IVA/codice fiscale, email, telefono, indirizzo, termini di pagamento, note e stato. Gli articoli possono avere un fornitore preferito; ogni riga documento conserva comunque il fornitore e il costo storici.

L'archiviazione di un fornitore non modifica i documenti già registrati.

## Documenti di magazzino

Il documento è l'unità operativa per le azioni bulk. Tipi supportati:

- carico da acquisto;
- DDT o fattura fornitore;
- scarico per consumo interno;
- scarico per perdita, rottura o scadenza;
- reso a fornitore;
- rettifica manuale;
- inventario fisico;
- nota di credito;
- acquisto di attrezzature o spese senza giacenza.

Ogni documento contiene numero interno, riferimento esterno, fornitore opzionale, date documento/competenza, stato, note, allegato o URL di riferimento, totali imponibile/IVA/totale e utente creatore/confermatore.

Stati:

- `draft`: modificabile e privo di effetti;
- `posted`: immutabile e contabilizzato;
- `cancelled`: annullato mediante registrazione compensativa;
- `reversed`: documento compensativo collegato all'originale.

Le righe contengono articolo opzionale, descrizione libera, classificazione, quantità, unità, costo unitario, aliquota IVA, sconto, destinazione e variazione di scorta. Le righe di attrezzatura e spesa possono non avere un articolo di catalogo.

La conferma avviene in transazione: blocca le righe, calcola i totali, genera movimenti per le sole righe inventariabili, aggiorna costo medio/ultimo costo e registra spese o beni acquistati. Un errore annulla l'intera transazione.

## Movimenti e valorizzazione

`inventory_movements` resta il registro compatibile e viene esteso con documento, riga documento, tipo movimento, quantità prima/dopo, costo unitario e valore. I nuovi movimenti sono creati esclusivamente dal servizio di contabilizzazione.

Il valore della giacenza usa il costo medio ponderato mobile:

`nuovo costo medio = (valore giacenza precedente + valore carico) / nuova quantità`

Gli scarichi usano il costo medio corrente. Rettifiche positive richiedono un costo; rettifiche negative usano il costo medio. La vendita continua a creare lo scarico già previsto, arricchito con valore e riferimento alla vendita.

## Inventario fisico

Un inventario fisico è un documento specializzato con:

- ambito: tutti gli articoli o filtro per categoria;
- quantità teorica congelata all'apertura;
- quantità contata;
- differenza, valore differenza e note per riga;
- modalità di inserimento manuale, scansione barcode, incolla da foglio o CSV;
- stato bozza, in conteggio e confermato.

La conferma genera soltanto le rettifiche necessarie e conserva sia il teorico sia il contato per audit.

## Spese e attrezzature

Le righe non inventariabili confluiscono in due registri:

- spese: categoria, fornitore, data competenza, importo, IVA, documento e note;
- attrezzature: descrizione, seriale opzionale, data acquisto, costo, fornitore, garanzia, stato e data dismissione opzionale.

Questi registri fanno parte del Magazzino perché nascono dagli stessi documenti di acquisto, ma non alterano la giacenza. L'integrazione con la contabilità gestionale avviene tramite riferimenti al documento e non duplica gli incassi della cassa.

## Importazione e operazioni bulk

Il workspace offre una griglia di righe modificabile con ricerca articolo, creazione rapida, barcode, quantità, costo, IVA e classificazione. Supporta:

- aggiunta multipla;
- incolla tabellare da Excel o Google Sheets;
- import CSV con anteprima e mappatura colonne;
- validazione per riga;
- salvataggio in bozza prima della registrazione;
- riepilogo di quantità, imponibile, IVA e totale;
- messaggi di errore che identificano esattamente la riga.

Le importazioni non scrivono direttamente i movimenti: producono sempre un documento in bozza.

## Workspace UI

La pagina principale diventa un workspace compatto, non una sequenza verticale di card.

Header:

- titolo `Magazzino`;
- ricerca globale per nome, SKU e barcode;
- CTA primaria `Nuova operazione`;
- CTA rapide con icone: `Carico`, `Scarico`, `Inventario`, `Importa`.

Navigazione interna:

- Panoramica;
- Articoli;
- Movimenti;
- Documenti;
- Inventari;
- Fornitori;
- Spese e attrezzature;
- Analisi.

La panoramica mostra valore scorte, articoli sotto soglia, documenti in bozza, anomalie, acquisti del periodo, consumi e ultime operazioni. Le liste sono tabelle dense con filtri persistenti, selezione multipla, ordinamento e menu contestuale.

Azioni brevi usano modali. Schede articolo, fornitori e documenti semplici usano pannelli laterali ampi. Operazioni bulk e inventari usano un workspace quasi a pagina intera, perché richiedono spazio e confronto tra righe.

## API e servizi

Le route esistenti restano operative. Le nuove API sono raggruppate sotto `/api/salons/:id/inventory`:

- `/summary` per metriche operative;
- `/products` per ricerca, filtri e azioni bulk;
- `/suppliers` per anagrafica;
- `/documents` e `/documents/:documentId/post|reverse`;
- `/counts` per inventari fisici;
- `/expenses` e `/assets` per registri non inventariabili;
- `/reports` per valorizzazione, consumi, acquisti, scarti e fornitori;
- `/imports/preview` per validare CSV senza effetti.

La logica critica vive in servizi applicativi separati dalle route: validazione documento, contabilizzazione, inversione, calcolo costo medio e riconciliazione inventario. Questi servizi accettano una transazione Drizzle esplicita.

## Errori, concorrenza e audit

- La contabilizzazione usa transazioni e blocco delle righe articolo interessate.
- Un documento già contabilizzato restituisce un conflitto idempotente e non duplica movimenti.
- Stock negativo è rifiutato salvo configurazione dell'articolo.
- Documenti incompleti rimangono in bozza con errori per riga.
- Tutte le registrazioni conservano autore, timestamp e collegamenti origine/destinazione.
- Eliminazioni logiche sono consentite soltanto per anagrafiche; documenti e movimenti non vengono cancellati.
- Gli allegati non sono obbligatori per confermare, ma il riferimento documento è disponibile e ricercabile.

## Migrazione e compatibilità

1. Aggiungere tabelle e colonne con valori predefiniti compatibili.
2. Classificare gli articoli esistenti come `resale`, `trackStock=true` e `sellable=true`.
3. Conservare quantità correnti e movimenti storici.
4. Generare un documento di apertura tecnico per ogni salone che rappresenti la giacenza iniziale senza duplicarla.
5. Adeguare la cassa affinché scarichi soltanto articoli inventariabili.
6. Rinominare tutte le etichette visibili e i risultati della ricerca globale in `Magazzino`.

## Test e criteri di completamento

La funzionalità è completa quando:

- prodotti vendita, consumabili, attrezzature e spese possono essere registrati correttamente;
- un documento bulk in bozza non altera dati contabili o scorte;
- la conferma atomica genera movimenti, valori, spese e beni corretti;
- inversione e annullamento lasciano una traccia completa;
- inventario fisico riconcilia differenze senza sovrascrivere la storia;
- CSV/incolla producono anteprima, validazione e bozza;
- vendite e consumi scalano correttamente le quantità;
- metriche e report riflettono i documenti confermati;
- permessi e isolamento salone sono verificati;
- route legacy e dati esistenti continuano a funzionare;
- UI web supera typecheck, test di contratto e test dei flussi principali;
- API e database superano test unitari, transazionali e di schema.

## Consegna incrementale

L'implementazione viene suddivisa in incrementi ciascuno utilizzabile:

1. fondazioni dati, servizi di contabilizzazione e compatibilità;
2. workspace, catalogo esteso e rinomina;
3. fornitori e documenti bulk di carico/scarico;
4. inventari fisici e import CSV/incolla;
5. spese, attrezzature, report e rifinitura end-to-end.

Ogni incremento include migrazione, API, UI e test del proprio flusso, evitando una fase con database nuovo ma interfaccia inutilizzabile.
