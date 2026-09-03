# EsseBeauty — Analisi architetturale e proposta di service boundary

Documento di sola analisi. Nessun codice è stato modificato per produrlo. Basato sulla lettura diretta di `packages/db/schema.ts` (2652 righe, 88 tabelle), delle route in `apps/api/src/routes/**` (~18.000 righe), dei job in `apps/api/src/jobs/**` (~1.900 righe) e di `packages/feature-flags/**`.

**Attenzione preliminare**: il `README.md` del repo (compendio "agent-facing") è **significativamente disallineato** con lo stato reale del codice. Non documenta: `routes/sales` (POS/checkout, 1173 righe, il file route più grande del repo), `routes/vouchers`, `routes/enterprise` (in realtà consensi GDPR + service package + audit log), `routes/onboarding`, `routes/staff-app`, `routes/communications`, `lib/sale-void.ts`, `lib/accounting-pdf.ts`, `lib/purchase-vouchers.ts`, né i module key `DOCUMENTS`, `PACKAGES`, `MULTI_LOCATION`, `AUDIT_COMPLIANCE`. Questo conferma che l'approccio richiesto — analizzare il codice reale, non i nomi delle cartelle — era necessario: **il vincolo di contesto "niente servizio Commerce se non esiste già logica di vendita" non è applicabile: la logica di vendita esiste, è reale, ed è il sottosistema più grande e più accoppiato del repository.**

---

## 1. Sintesi

- Il DB ha 88 tabelle. **Tre tabelle — `customers`, `appointments`, `sales` — sono referenziate da chiave esterna da quasi ogni altro dominio** (loyalty, reviews, reminders, waitlist, marketing, communications, packages, inventory, consensi). Non esiste un confine di dominio nello schema che non sia attraversato da una FK viva verso una di queste tre.
- Esiste un vero sottosistema di vendita/POS (`sales`, `saleItems`, `salePayments`, `purchaseVouchers`, `purchaseVoucherMovements`, `cashMovements`): checkout multi-tender, gestione voucher, note di credito via storno, nessuna fattura fiscale/SDI (confermato assente). Il checkout esegue, **in un'unica transazione Postgres**, scritture su vendite, inventario, appuntamenti, pacchetti servizio, voucher e loyalty. Questa è la prova di accoppiamento transazionale più forte trovata nel codice.
- L'unico confine asincrono reale oggi è BullMQ/Redis con **4 code**: `marketing-campaigns`, `whatsapp-communications`, `appointment-reminders`, `review-requests`. Loyalty, notifiche in-app e audit log sono invece **sempre sincroni**, eseguiti in-process nello stesso hook `onResponse` che gestisce il completamento appuntamento.
- L'enforcement dei moduli (feature flag) è reale ma incompleto: il modulo più grande e accoppiato (`sales`/POS) **non è gated da nessun `requireModule`** — è sempre attivo per ogni salone, mentre `MULTI_LOCATION` è una chiave definita ma mai controllata da nessuna route (flag morta).
- **Risposta alla domanda centrale (sezione 4): no, la separazione fisica in microservizi non è giustificata oggi.** Il beneficio richiesto (isolamento, niente accesso diretto al DB altrui, comunicazione async dove serve) si ottiene rinforzando i confini di modulo *dentro* il monorepo attuale — la proposta è quindi un elenco di confini interni da rinforzare, non un elenco di servizi da separare.

---

## 2. Mappa dell'accoppiamento reale

### 2.1 Tabelle per dominio (per dimensione)

| Dominio | Tabelle | Note |
|---|---|---|
| Inventario/magazzino | 10 | mini-ERP: documenti, righe documento, movimenti, conteggi, spese, cespiti — tutti con pattern di storno self-referenziale (`reverses*Id`) |
| Platform (globale, no tenant) | 9 | `salons`, piani, admin centrali, audit platform, impersonation |
| Config salone / sedi | 8 | `salonLocations`, `salonResources`, impostazioni varie — qui vive il "multi-location" |
| Comunicazioni (WhatsApp/email) | 8 | pattern outbox con lease/retry, il sottosistema più maturo del repo |
| Loyalty | 7 | punti, tier, premi, regole di maturazione |
| Auth/identità | 6 | utenti, credenziali, sessioni, permessi |
| **Sales/Commerce/POS** | 6 | `sales`, `saleItems`, `salePayments`, `purchaseVouchers`, `purchaseVoucherMovements`, `cashMovements` — 6 tabelle ma il fan-in/fan-out più alto del repo |
| Staff/servizi, calendario, service package | 5 ciascuno | |
| Reviews | 4 | |
| Marketing | 3 | |
| Clienti, reminders, notifiche, UI prefs, consensi | 2 ciascuno | |
| Waitlist, audit tenant-level | 1 ciascuno | |

Nessuna tabella dedicata per "multi-location" o "onboarding": il multi-location è modellato come colonne nullable `locationId`/`resourceId` sparse su `staff`, `appointments`, `availabilityBlocks`, `serviceResources` — un attributo, non un dominio. L'onboarding scrive `salons.onboardingStep`/`onboardingCompletedAt` più righe in `salonLocations` (`routes/onboarding/persistence.ts:9-25`) — un wizard sottile, non un dominio operativo.

**Nota tecnica**: `packages/db/schema.ts` non usa mai l'API `relations()` di Drizzle — zero occorrenze. Tutto l'accoppiamento è espresso solo a livello di colonna (`.references()`/`foreignKey()`). Il grafo dei domini non è visibile nel codice applicativo se non tramite join manuali — un fattore che rende l'accoppiamento reale meno evidente di quanto sia.

### 2.2 Le tre entità hub

Elenco (non esaustivo) delle FK dirette verso le tre tabelle centrali:

- **`customers`** ← `sales`, `purchaseVouchers` (x2, titolare e acquirente), `loyaltyPoints`, `loyaltyRewardRedemptions`, `reviews`, `waitlistEntries`, `campaignRecipients`, `communicationConsents`, `communicationConversations`, `customerServicePackages`, `customerConsents`.
- **`appointments`** ← `sales` (FK unica), `reminders`, `reviewInvitations`, `reviews`, `waitlistEntries` (via staff/service, non diretto ma logicamente accoppiato), `inventoryMovements`, `loyaltyPoints`, `customerConsents`, `servicePackageUsages`.
- **`sales`** ← `loyaltyPoints`, `inventoryMovements`, `purchaseVouchers.issuedSaleId`, `customerServicePackages.purchaseSaleId`, `servicePackageUsages`.

Questo significa che qualunque dominio periferico (loyalty, reviews, reminders, waitlist, marketing, consensi, pacchetti, inventario) **non può essere isolato senza portarsi dietro un riferimento a cliente e/o appuntamento e/o vendita**. Non è accoppiamento accidentale: è il modello di dominio.

### 2.3 Il caso più forte: la transazione di checkout POS

`apps/api/src/routes/sales/index.ts` (1173 righe, il file route più grande del repo) importa **20 tabelle** a livello di file: `appointments, customerPackageItemBalances, customerServicePackages, customers, inventoryDocuments, inventoryExpenses, inventoryMovements, inventoryProducts, inventorySuppliers, notifications, saleItems, salePayments, sales, salons, serviceCategories, services, servicePackageItems, servicePackageUsages, servicePackages, staff, users`.

Il checkout (walk-in `sales/index.ts:538-700` e da appuntamento `sales/index.ts:763-953`) esegue, **dentro un unico `app.db.transaction(...)`** (`:601`, `:813`):

1. inserimento `sales` + `saleItems`;
2. per ogni riga prodotto: decremento `inventoryProducts.stockQuantity` + inserimento `inventoryMovements` (`:643-673`, `:879-913`);
3. se collegato a un appuntamento: `appointments.status = "completed"` (`:914`);
4. consumo di eventuali pacchetti servizio prepagati (`consumePackageItems`, `:238-308`);
5. emissione/riscatto voucher regalo (`issueVouchers`/`savePayments`, `:334-399`);
6. maturazione punti loyalty (`awardSaleLoyalty`, `:687-695`, `:924-933`), se il modulo è attivo.

Il void (`lib/sale-void.ts:142-170`, `:256-260`) fa l'inverso, sempre in un'unica transazione: ripristina stock, inserisce un movimento di storno, e fa scadere i punti loyalty maturati.

**Questo è il segnale architetturale più importante del documento**: un'unica operazione di business (chiudere una vendita) tocca atomicamente 6 domini concettualmente diversi. Separare fisicamente anche solo "inventario" o "loyalty" da "sales" romperebbe questa atomicità — o lo stock potrebbe andare negativo tra due chiamate di rete separate, o i punti loyalty potrebbero disallinearsi da una vendita annullata, a meno di introdurre saga/2PC. Nessun elemento nel codice suggerisce che questa complessità sia oggi giustificata da un bisogno reale (vedi §4).

Da notare anche: `routes/appointments/index.ts:416-421` fa il percorso inverso — il cambio di stato di un appuntamento legge direttamente la tabella `sales` per rifiutare la modifica se esiste una vendita pagata collegata (`APPOINTMENT_STATUS_LOCKED_BY_SALE`). Scheduling e Sales si leggono a vicenda anche fuori dalla transazione di checkout.

### 2.4 Cosa è già asincrono oggi

4 code BullMQ (`apps/api/src/jobs/queues.ts:3-8`), tutte su Redis condiviso, nessun partizionamento per tenant nel payload (solo un id di riga, es. `{outboxId}`, `{reminderId}`):

| Coda | Produce da | Consuma in | Pattern |
|---|---|---|---|
| `whatsapp-communications` | `enqueueCommunication()` (`jobs/communications.ts:63-171`), chiamata da reminders, reviews, waitlist-notify, marketing | `communications.ts:357-366`, worker con lease + advisory lock (`pg_advisory_xact_lock`) | Outbox transazionale: la riga DB è la fonte di verità, il job Redis è solo un "wake up" — un job perso si autoripara con una scansione di recovery ogni 60s. **Il pattern più maturo del repo.** |
| `review-requests` | `scheduleReviewRequest()`, chiamata sincrona dall'hook `onResponse` quando un appuntamento passa a `completed` (`jobs/appointment-events.ts:111`) | `reviews.ts:480-495` | Delay calcolato da policy salone; recovery ogni 5 min |
| `appointment-reminders` | **non** collegata alla creazione dell'appuntamento — un job `scan` ricorrente ogni 15 min (`reminders.ts:196-202`) interroga gli appuntamenti imminenti e crea/accoda i reminder | `reminders.ts:182-194` | Poll-based, non event-driven |
| `marketing-campaigns` | invio campagna da `routes/marketing/index.ts:216-224` | `marketing.ts:185-194` | Batch da 50 destinatari |

**Punto debole individuato**: il worker di `whatsapp-communications` (`communications.ts:234-260`, `updateProductState`) scrive direttamente, in base a una stringa `sourceType`, nelle tabelle di **tre domini altrui** (`reminders`, `reviewInvitations`, `campaignRecipients`, più `marketing_campaigns` via `refreshCampaignStatus`). È un hub di integrazione de facto, non un confine pulito — ogni dominio dovrebbe possedere il proprio callback di stato-consegna invece di farselo scrivere da un worker condiviso.

**Loyalty, notifiche in-app e audit log sono sempre sincroni**, eseguiti nello stesso hook `onResponse` di `appointment-events.ts` (righe 234-266) che gestisce completamento/cancellazione appuntamento — nessuna coda, nessun disaccoppiamento, anche se concettualmente sarebbero i candidati più naturali per diventarlo.

### 2.5 Enforcement dei moduli: quanto è reale

`packages/feature-flags/server.ts:26-55` fa un hit DB su `salonModules` con cache in-process TTL 60s. `requireModule()` è un preHandler Fastify. Verificato via grep su tutte le route:

- ✅ Gated correttamente: reminders, reviews, waitlist, loyalty, marketing, inventory (tutti i sotto-file), reports (`STAFF_PERF`), e il file `enterprise/index.ts` per `DOCUMENTS`/`PACKAGES`/`AUDIT_COMPLIANCE`.
- ❌ **`routes/sales/index.ts` — zero chiamate a `requireModule`.** Il POS/checkout, il sottosistema più grande e più accoppiato del repo, è sempre attivo per ogni salone. Fa solo due controlli `isModuleEnabled` "morbidi" (visibilità catalogo pacchetti, se assegnare punti loyalty) ma non blocca mai la route.
- ❌ `routes/vouchers/index.ts` — nessun gating.
- ❌ `MODULE_KEYS.MULTI_LOCATION` — definita in `keys.ts` ma **mai referenziata da nessun `requireModule` in nessuna route**: flag morta.

### 2.6 Domini "mal nominati" (verificato leggendo il codice, non le cartelle)

- **`routes/enterprise/index.ts`** (1051 righe) non ha nulla a che fare con multi-sede/enterprise. Contiene, mescolati in un solo file: gestione consensi GDPR (`consent-templates`, `customer-consents`, firma pubblica via token), pacchetti servizio (`service-packages`, `customer-service-packages`), audit log (`audit-log`) e note private appuntamento. Tre moduli funzionalmente indipendenti sotto un nome fuorviante.
- **Collisione di naming**: `MODULE_KEYS.DOCUMENTS` gate i *consensi/documenti GDPR* (in `enterprise/index.ts`), mentre la tabella `inventoryDocuments` (documenti di magazzino: acquisto, DDT, rettifica) è un concetto completamente diverso gated da `MODULE_KEYS.INVENTORY`. Rischio concreto di confusione futura per chi (umano o agente) legge "documents" nel codice.
- **`routes/staff-app/index.ts`** (305 righe) vs **`routes/staff/index.ts`** (565 righe): non sono lo stesso dominio con due nomi — sono due *superfici* sullo stesso dominio per due pubblici diversi. `staff-app` espone endpoint self-service (`/api/staff-app/me`, `/appointments`, `/calendar-blocks`, `/availability-requests`, `/reports`) per il collaboratore stesso; `staff/index.ts` espone la CRUD amministrativa (`/api/salons/:id/staff`, permessi, blocchi disponibilità) per owner/manager. Toccano tabelle sovrapposte (`staff`, `availabilityBlocks`, `appointments`) da due angolazioni di autorizzazione diverse — corretto tenerle come due file/route separate nello stesso modulo, non un segnale di dominio diverso.
- **Platform resta isolata quasi per intero**: l'unica query di `routes/platform/index.ts` che tocca tabelle operative (`platform/index.ts:308-310`) è un `count(*) from appointments` per una dashboard aggregata — non lettura di record salone. L'isolamento tenant/platform descritto nel README regge nella pratica.

---

## 3. Vincoli di contesto rilevanti emersi dall'analisi

- Non esiste alcuna logica fiscale/di fatturazione elettronica: confermato dall'assenza di `fiscal`/`scontrino`/`SDI`/`ricevuta fiscale` in tutto `apps/api/src`, e da `apps/api/src/demo/build-demo-scenario.ts:217` che elenca "Fatturazione elettronica" come provider stub esplicitamente `enabled: false`. `lib/accounting-pdf.ts` produce solo un rapportino contabile interno (PDF riepilogativo), non uno scontrino/fattura. **Il vincolo "niente Commerce/POS/fiscale" del brief regge per la parte fiscale, ma non per POS/vendite, che esistono ed sono reali.**
- Nessuna tabella o pattern Kafka/gRPC/service-mesh nel codice — coerente col vincolo di non introdurne.
- Singolo Postgres, nessuna evidenza di query cross-database — coerente con "un solo Postgres con schemi logici" del brief.

---

## 4. Risposta alla domanda centrale

**No.** Alla scala attuale, la separazione fisica in microservizi non è giustificata da un bisogno concreto — non c'è alcuna evidenza nel codice di: necessità di scaling indipendente (nessun dominio mostra segnali di carico sproporzionato rispetto agli altri: la coda più "pesante" per volume potenziale, comunicazioni WhatsApp/email, gira già su un worker BullMQ separabile in-process senza bisogno di un deploy separato), necessità di deploy indipendenti (mantenitore singolo + agenti di coding: un deploy singolo è più semplice da ragionare e da tenere coerente di N deploy coordinati), o necessità di isolamento guasti (oggi un errore in un job asincrono è già contenuto da try/catch e non fa fallire la richiesta HTTP — vedi `appointment-events.ts:263-265`).

Il fattore decisivo è quello trovato in §2.3: **il dominio più grande e più critico del sistema (vendite/POS) è costruito attorno a una transazione ACID che attraversa 6 aree concettuali**. Questa non è un'imperfezione da correggere migrando a microservizi — è una garanzia di correttezza (niente vendita senza stock scalato, niente punti loyalty orfani, niente appuntamento "completato" senza vendita chiusa) che un confine di rete distruggerebbe o costringerebbe a ricostruire con saga/outbox/compensazioni, con un salto di complessità operativa che nessun dato nel codice giustifica oggi.

Lo stesso beneficio richiesto dalla domanda (isolamento dei dati, niente accesso diretto al DB di un altro modulo, comunicazione asincrona dove serve) è ottenibile restando nel monorepo attuale, rinforzando confini *logici*: il sistema ha già un confine asincrono reale e ben progettato (l'outbox delle comunicazioni, §2.4) che dimostra che il team/gli agenti sanno già costruire questo tipo di isolamento quando serve — va esteso con disciplina agli altri moduli, non sostituito con un confine di processo.

L'unico sottosistema che oggi *assomiglia* già a un servizio indipendente (pattern outbox, lease, worker dedicato, unico punto di contatto con l'esterno — l'API Meta/WhatsApp e il provider email) è **Communications**. Va segnalato come il candidato più "service-ready" se in futuro il volume di messaggistica giustificasse uno scaling indipendente — ma nessun dato attuale lo richiede, quindi la raccomandazione resta di non estrarlo ora.

---

## 5. Confini di modulo interni da rinforzare

Dato che la risposta al punto 4 è "restare nel monorepo", ecco dove il codice attuale viola già l'isolamento che si vorrebbe imporre, in ordine di impatto:

1. **Dare a Sales/POS il proprio modulo flag.** È l'unico sottosistema di questa dimensione (1173 + 271 + 177 + 109 righe) senza `requireModule`. Non tutti i saloni useranno necessariamente cassa/checkout in-app; oggi è sempre attivo per costruzione, non per scelta esplicita. Aggiungere `MODULE_KEYS.SALES` (o `POS`) e farlo rispettare non riduce l'accoppiamento interno (che resta legittimo, §2.3) ma rende esplicito e controllabile *chi* può usarlo.
2. **Spezzare `routes/enterprise/index.ts` in tre file/cartelle** (`consent-compliance/`, `service-packages/`, `audit/`) che riflettano i tre `MODULE_KEYS` reali (`DOCUMENTS`, `PACKAGES`, `AUDIT_COMPLIANCE`). Zero rischio (rinominare/spostare, nessuna logica cambia), beneficio diretto per leggibilità futura — sia umana sia per agenti che oggi vengono fuorviati dal nome "enterprise".
3. **Rinominare `MODULE_KEYS.DOCUMENTS`** in qualcosa che non collida concettualmente con `inventoryDocuments` (es. `CONSENTS` o `COMPLIANCE_DOCUMENTS`), per eliminare l'ambiguità terminologica descritta in §2.6.
4. **Rimuovere o attivare `MODULE_KEYS.MULTI_LOCATION`.** Oggi è una promessa non mantenuta nel codice — o si collega davvero a un controllo su `salonLocations`/`resourceId`, o si rimuove per non lasciare un flag morto che confonde chi svilupperà multi-sede in futuro.
5. **Far possedere a ciascun dominio il proprio callback di stato-consegna**, invece di lasciare che il worker di `whatsapp-communications` (`communications.ts:234-260`) scriva direttamente in `reminders`, `reviewInvitations`, `campaignRecipients`, `marketingCampaigns` in base a una stringa `sourceType`. Concretamente: ogni dominio (reminders, reviews, marketing) espone una funzione tipo `onDeliveryResult(outboxId, result)` che il worker chiama, invece di mutare le tabelle altrui direttamente. Comportamento identico, confine esplicito nel codice.
6. **Introdurre un confine di import applicato staticamente** (es. una regola ESLint `no-restricted-imports` o `dependency-cruiser`) che impedisca a un file route di un modulo di importare direttamente le tabelle Drizzle di un altro modulo, tranne che tramite una piccola API di lettura condivisa (es. un modulo `customers-read.ts` con funzioni tipo `getCustomerSummary(id)` usato da loyalty/marketing/reviews/sales invece di ciascuno importare `customers` grezzo da `packages/db/schema.ts`). Va introdotta in modo incrementale (solo warning sui file nuovi/toccati, non un refactor big-bang su 18.000 righe esistenti) — coerente con la preferenza già nota di lavorare in modo diretto e non cerimonioso.

---

## 6. Rischi e punti da verificare prima di un eventuale refactor

- **La transazione di checkout è il codice a più alto raggio d'azione del repo.** Prima di toccare `routes/sales/index.ts` per uno qualunque dei punti sopra, verificare che `pos-checkout.test.ts` e i test collegati coprano davvero i percorsi void/voucher/pacchetto, non solo il caso felice — è il file dove un regressione costa più caro (stock, pagamenti, loyalty).
- **Il pattern di idempotenza del worker comunicazioni** (advisory lock, lease, `onConflictDoNothing` su webhook) è delicato: se si sposta la logica di `updateProductState` verso callback per-dominio (punto 5), va preservata l'atomicità attuale — oggi la scrittura di stato avviene nella stessa unità di lavoro del worker.
- **Nessuna delle chiamate `requireModule` mancanti (Sales, Vouchers) è stata verificata contro i test esistenti** — aggiungere il gating potrebbe rompere flussi demo/test che oggi assumono POS sempre attivo (es. `apps/api/src/demo/*`, che referenzia `sales`/`payment` pesantemente). Controllare `apps/api/src/demo/apply-demo-scenario.ts` e `build-demo-scenario.ts` prima di introdurre il flag.
- **Le code BullMQ non sono partizionate per tenant** (§2.4) — non è un problema oggi, ma se un salone dovesse inviare una campagna marketing molto grande, potrebbe ritardare i reminder di altri saloni sulla stessa coda condivisa. Da tenere d'occhio se il numero di saloni/traffico cresce, non da risolvere ora.
- **Introdurre un import-boundary linter** rischia di generare un numero elevato di violazioni preesistenti al primo run (es. `sales/index.ts` con 20 import cross-dominio, `marketing/index.ts`, `loyalty/index.ts`). Da configurare come regola solo-warning inizialmente, non come gate CI bloccante, per evitare di bloccare lo sviluppo quotidiano su un problema di igiene del codice esistente.
- Questo documento non ha ispezionato in dettaglio `apps/web`, `apps/pwa`, `apps/staff-pwa`, `apps/platform` lato frontend, né la cartella `packages/db/migrations` file per file — l'analisi è basata sull'API/DB, che è dove vive l'accoppiamento reale rilevante per un service boundary.
