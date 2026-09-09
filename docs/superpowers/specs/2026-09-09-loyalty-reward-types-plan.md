# Premi Fedeltà tipizzati + integrazione in cassa

## Stato di avanzamento (2026-09-09, interrotto per limite token)

Fatto finora:
- **§1 Schema** — completo. `packages/db/schema.ts`: nuovo `rewardTypeEnum`, nuove colonne su `loyaltyRewards` (`type`, `serviceId`, `productId`, `discountAmountCents`, `discountPercent`, `minSpendCents`, `maxDiscountCents`), nuove colonne su `loyaltyRewardRedemptions` (`saleId`, `appliedType` **nullable**, `appliedDiscountCents`, `appliedServiceId`, `appliedProductId`), nuova colonna `purchaseVouchers.sourceRewardRedemptionId`. Migrazione generata: `packages/db/migrations/0059_loyalty_reward_types.sql` (+ snapshot/journal aggiornati). **Deliberatamente NON è stato aggiunto** il CHECK discriminato per tipo su `loyalty_rewards` (fallirebbe su righe esistenti con `discount_amount_cents` NULL) — la validazione per tipo resta solo lato API (§2). `applied_type` è nullable per lo stesso motivo (redemption storiche non hanno lo snapshot). **La migrazione non è stata ancora eseguita (`db:migrate`)** — va lanciata su un DB locale prima di procedere.
- **`apps/api/src/lib/purchase-vouchers.ts`** — `issuePurchaseVoucher` ora accetta `issuedSaleId: string | null` (per emettere un buono senza vendita, dal riscatto di un premio "credito") e un `sourceRewardRedemptionId` opzionale, scritto sulla riga `purchase_vouchers`.
- **`apps/api/src/lib/loyalty-service.ts`** — in corso: aggiunto solo l'import di `issuePurchaseVoucher`. **Non ancora fatto**: il branch `type !== "credit" → REWARD_REQUIRES_CHECKOUT` dentro `redeemLoyaltyReward`, l'emissione voucher per `type === "credit"`, e la nuova funzione `redeemRewardsInSale` per il riscatto in cassa (§4 del piano sotto).

Da fare, in ordine (vedi le sezioni corrispondenti più sotto per il dettaglio):
1. Finire §3 (`loyalty-service.ts`: branch credito + `REWARD_REQUIRES_CHECKOUT`).
2. §2 — riscrivere `rewardBody()` in `apps/api/src/routes/loyalty/index.ts` con validazione discriminata per tipo; valutare nuovo `GET /api/salons/:id/products?active=true`.
3. §4 — la parte più delicata: `redeemRewardsInSale` + integrazione in `apps/api/src/routes/sales/index.ts` (sia `pos-checkout` che `appointments/:id/checkout`).
4. §5, §6, §7 — frontend (pagina cliente fedeltà, cassa con gating modulo, form premio).
5. §8, §9 — demo data e test.
6. Eseguire `db:migrate` sul DB locale, girare typecheck e i test esistenti (loyalty-service.test.ts, pos-checkout.test.ts, loyalty-operations.test.ts) per verificare che nulla si sia rotto.

Nessuna modifica frontend è stata ancora toccata. Nessun test è stato ancora eseguito in questa sessione.

## Contesto

Oggi `loyalty_rewards` (`packages/db/schema.ts:1814-1823`) è piatta: solo `name`, `points_required`, `description`, `active`. Il riscatto (`redeemLoyaltyReward`, `apps/api/src/lib/loyalty-service.ts:72-154`) è un flusso puramente a punti, scollegato da qualunque vendita: nessun `sale_id`, nessun importo monetario, nessun collegamento a servizi/prodotti. In cassa (`apps/web/app/(dashboard)/sales/page.tsx`) esiste già un meccanismo maturo e esplicito per i buoni acquisto (voucher): l'operatore sceglie un buono da una lista (`customerVouchers`, righe 272-282) e lo applica con un click (`applyVoucher`, righe 470-486); lato server (`apps/api/src/routes/sales/index.ts`) il buono viene *validato e scalato* con lock pessimistico (`redeemPurchaseVoucher`, `apps/api/src/lib/purchase-vouchers.ts:72-109`) e il suo importo confluisce nello sconto della vendita (`discountCents = manualDiscountCents + voucherCents`, sales/index.ts:596-597) — mai trattato come incasso.

L'utente vuole che i premi fedeltà abbiano un **tipo** (trattamento omaggio, prodotto omaggio, sconto fisso, sconto %, credito) e possano essere applicati in cassa con la stessa serietà dei buoni — **mai in automatico**: l'operatore deve scegliere esplicitamente il premio da un elenco, vedere l'effetto esatto (quale riga si azzera, quanto sconto si applica) e confermare, esattamente come già avviene con i buoni. Inoltre ogni nuova UI aggiunta deve essere condizionata alla presenza del modulo Loyalty attivo (pattern già in uso: `useModuleEnabled(MODULE_KEYS.LOYALTY)` da `@esse-beauty/feature-flags`, vedi `apps/web/app/(dashboard)/clients/[customerId]/page.tsx:89-91`).

Decisione architetturale chiave: per i tipi che modificano l'importo di una vendita (trattamento/prodotto omaggio, sconto fisso, sconto %) l'importo dello sconto **non è mai proposto dal client** — è calcolato e validato dal server a partire dalla configurazione del premio, con lock sul cliente e verifica punti, sullo stesso livello di rigore di `redeemPurchaseVoucher`. Il tipo "credito" invece riusa **integralmente** l'infrastruttura buoni già esistente (`purchase_vouchers` + `purchase_voucher_movements` + UI voucher in cassa): riscattarlo emette un buono, che poi si spende con la UI voucher già esistente — zero nuovo codice di cassa per questo tipo.

## 1. Schema (`packages/db/schema.ts`)

- Nuovo `pgEnum("reward_type", ["free_treatment", "free_product", "fixed_discount", "percent_discount", "credit"])`, pattern identico a `saleItemTypeEnum` (schema.ts:45-49).
- Su `loyaltyRewards` (schema.ts:1814-1823) aggiungere: `type: rewardTypeEnum("type").notNull().default("fixed_discount")` (default per compatibilità con le righe demo/esistenti, poi valorizzato correttamente), `serviceId` (nullable FK → `services`, `onDelete: "set null"`), `productId` (nullable FK → `inventoryProducts`, `onDelete: "set null"`), `discountAmountCents` (nullable integer, usato da `fixed_discount` e `credit`), `discountPercent` (nullable integer), `minSpendCents` (nullable integer), `maxDiscountCents` (nullable integer).
- Aggiungere un `check()` (pattern da `sale_items_discount_non_negative` ecc.) che vincoli, per ciascun `type`, quali colonne devono essere non-null e con segno/range corretto (es. `type='percent_discount' → discount_percent between 1 and 100`, `type='free_treatment' → service_id is not null`, ecc.) — replica lo spirito dei check già presenti nel file.
- Su `loyaltyRewardRedemptions` (schema.ts:1849-1875) aggiungere: `saleId` (nullable FK → `sales`, `onDelete: "set null"`, stesso stile di `loyaltyPoints.saleId`), e colonne "snapshot" catturate al momento del riscatto — `appliedType` (rewardTypeEnum, non-null), `appliedDiscountCents` (nullable), `appliedServiceId`/`appliedProductId` (nullable) — necessarie perché il premio potrà essere disattivato/modificato dopo il riscatto (soft-delete, index.ts:238-241) e lo storico deve restare leggibile.
- Su `purchaseVouchers` (schema.ts:1224-1257) aggiungere `sourceRewardRedemptionId` (nullable FK → `loyaltyRewardRedemptions`, `onDelete: "set null"`) per tracciare i buoni generati da un premio "credito".
- Generare con `pnpm --filter @esse-beauty/db db:generate` (script confermato in `packages/db/package.json`) — aspettarsi eventualmente più migration incrementali se `drizzle-kit` richiede passaggi separati per i nuovi check/default, come già avvenuto per 0056→0058.

## 2. API — CRUD premi (`apps/api/src/routes/loyalty/index.ts`)

- Sostituire il type-guard `rewardBody()` (righe 53-63) con una validazione discriminata su `type` che segue la stessa idiom hand-written a type-predicate già usata nel file (niente zod: nessun altro file in `apps/api` lo usa, confermato via ricerca — non introdurlo qui). Per ciascun `type` richiede i soli campi pertinenti ed rifiuta gli altri (400 con codice tipo `INVALID_REWARD_CONFIG`).
- `POST/PATCH .../rewards` (righe 221-236): passare i nuovi campi all'insert/update.
- Non serve un nuovo endpoint per leggere servizi/prodotti: riusare `GET /api/salons/:id/services?active=true` (pattern già usato in `settings/documents/[templateId]/page.tsx`) per il picker "trattamento"; per il picker "prodotto" verificare se esiste già un endpoint semplice equivalente per i prodotti attivi (l'esplorazione non ne ha trovato uno standalone — solo il catalogo POS e il magazzino). Se manca, aggiungere un piccolo `GET /api/salons/:id/products?active=true` che restituisca `{id, name, price_cents}` dalla tabella `inventoryProducts`, mirror minimale di quello dei servizi — non riusare l'endpoint catalogo POS (troppo pesante/con campi non pertinenti).

## 3. API — riscatto "credito" (mint buono) — `apps/api/src/lib/loyalty-service.ts`

- Estendere `redeemLoyaltyReward` (righe 72-154): dopo il controllo saldo punti (già presente), se `reward.type !== "credit"` → lanciare `LoyaltyOperationError("REWARD_REQUIRES_CHECKOUT", 400)` (il riscatto di questi tipi è possibile solo dentro una vendita, vedi §4).
- Se `type === "credit"`: dopo l'insert della redemption e della riga `loyaltyPoints` (comportamento invariato), chiamare `issuePurchaseVoucher(tx, {...})` (già esistente in `apps/api/src/lib/purchase-vouchers.ts:26-70`, genera codice Luhn) con `originalAmountCents: reward.discountAmountCents`, `customerId`, `issuedSaleId: null`, e collegare il buono creato scrivendo `sourceRewardRedemptionId` sulla riga voucher. Riusare la funzione esistente invece di reimplementare la generazione codice.
- Nessuna modifica alla logica di idempotenza/lock esistente (righe 84-97, `lockCustomer` 55-62) — resta identica, si aggiunge solo l'effetto collaterale per il tipo credito.
- L'endpoint `POST /api/salons/:id/loyalty/customers/:customerId/redemptions` (index.ts:270-277) non cambia nella firma: l'errore `REWARD_REQUIRES_CHECKOUT` passa già attraverso `operationError()` (righe 65-70).

## 4. API — riscatto in cassa (trattamento/prodotto/sconto fisso/sconto %) — `apps/api/src/routes/sales/index.ts`

Punto più delicato: entrambi gli endpoint di checkout (`pos-checkout` righe 539-701, `appointments/:id/checkout` righe 776-966) condividono la stessa logica di calcolo sconto/pagamenti — le modifiche vanno replicate in entrambi, seguendo lo stesso schema con cui oggi trattano i voucher.

- Nuovo campo body: `redeemed_rewards: [{ reward_id }]` (solo id — **niente importo dal client**, per i motivi di integrità finanziaria spiegati nel Contesto).
- Nuova funzione `redeemRewardsInSale(tx, { rewardIds, customerId, lines, salonId, actorUserId })` in `apps/api/src/lib/loyalty-service.ts`, che riusa `lockCustomer` e `activeBalanceSql`/`activeBalance` già esportate:
  1. Se `rewardIds.length` e non c'è `customerId` → errore `REWARD_CUSTOMER_REQUIRED`.
  2. `lockCustomer` una sola volta (come oggi).
  3. Per ciascun reward: caricarlo (`active=true`, salone corretto, altrimenti `REWARD_NOT_AVAILABLE`); calcolare l'importo sconto **server-side** in base al `type`:
     - `free_treatment`/`free_product`: cercare in `lines` l'unica riga con `service_id`/`product_id` uguale a quello del reward; se assente → `REWARD_ITEM_NOT_IN_CART`; se trovata ma già a importo zero (coperta da pacchetto) → `REWARD_ITEM_ALREADY_COVERED`; sconto = intero importo lordo della riga (azzera la riga).
     - `fixed_discount`: sconto = `min(discountAmountCents, saleValueRimanente)`; se `minSpendCents` impostato e subtotale < soglia → `REWARD_MIN_SPEND_NOT_MET`.
     - `percent_discount`: sconto = `round(subtotale * discountPercent / 100)`, eventualmente limitato da `maxDiscountCents`; stessa verifica `minSpendCents`.
  4. Sommare i punti richiesti da tutti i reward selezionati e verificare `activeBalance >= totalPoints` in un colpo solo (come oggi fa `redeemLoyaltyReward` per un singolo reward) → altrimenti `INSUFFICIENT_POINTS`.
  5. Ritornare `{ perLineDiscounts: Map<lineKey, cents>, totalRewardDiscountCents, redemptions: [{rewardId, pointsSpent, appliedType, appliedDiscountCents, appliedServiceId/ProductId}] }` senza scrivere nulla — la scrittura (insert `loyalty_reward_redemptions` con `saleId` valorizzato + insert `loyaltyPoints` con `delta` negativo, stesso pattern di `redeemLoyaltyReward` righe 116-144) avviene **dopo** che la vendita e le sue righe sono state inserite (serve `saleId`), dentro la stessa transazione di checkout, subito prima o assieme a `awardSaleLoyalty` (già chiamata a sales/index.ts:688-696).
- Integrazione nel calcolo esistente (sales/index.ts ~590-598): applicare `perLineDiscounts` sovrascrivendo il `discountCents` calcolato da `normalizedLine` per le righe coinvolte (i tipi trattamento/prodotto ignorano qualunque `discount_cents` inviato dal client per quella riga — sempre ricalcolato dal server), poi `discountCents = manualDiscountCents + voucherCents + totalRewardDiscountCents` accanto alla riga 596 esistente, mantenendo invariato il controllo finale `cashCents !== totalCents`.
- Nuovi codici errore da aggiungere a `checkoutErrorMessages` nel frontend (§6): `REWARD_NOT_AVAILABLE`, `REWARD_ITEM_NOT_IN_CART`, `REWARD_ITEM_ALREADY_COVERED`, `REWARD_MIN_SPEND_NOT_MET`, `INSUFFICIENT_POINTS`, `REWARD_CUSTOMER_REQUIRED`.
- **Vincolo esplicito di scope (coerente con "niente automatismi"):** dato che `checkout()` lato client (sales/page.tsx:501-559) spezza il carrello in più chiamate quando ci sono più appuntamenti collegati (`orderedKeys`, righe 508-518), i premi redimibili in cassa sono ammessi solo quando il carrello corrisponde a **un'unica** vendita (un solo gruppo). Se il carrello è multiplo, il pulsante "+ Premio" viene disabilitato con tooltip esplicativo — niente riparto proporzionale implicito dei punti fra più vendite.

## 5. Frontend — pagina cliente fedeltà (`apps/web/app/(dashboard)/loyalty/customers/page.tsx`)

- Nell'elenco `available_rewards` (righe 176-182): per i reward con `type !== "credit"` disabilitare il bottone "Riscatta premio" e mostrare un badge "Si applica in cassa" invece del bottone attivo; il flusso `ConfirmDialog` + `confirmRedemption` (righe 129-142, 202-209) resta invariato e attivo solo per `type === "credit"`.
- Aggiungere un piccolo badge tipo sul reward (trattamento/prodotto/sconto fisso/sconto %/credito) nella lista, per coerenza visiva con quanto mostrato in cassa.

## 6. Frontend — cassa (`apps/web/app/(dashboard)/sales/page.tsx`)

Tutto il nuovo blocco è gated da `useModuleEnabled(MODULE_KEYS.LOYALTY)` (import da `@esse-beauty/feature-flags`, non presente oggi in questo file) **e** dal permesso `PERMISSION_KEYS.LOYALTY_MANAGE` via `useAuth().hasPermission`, stesso doppio controllo già usato in `clients/[customerId]/page.tsx:89-91`. Se il modulo non è attivo il pulsante/sezione non esiste proprio nel DOM (non solo disabilitato).

- Nuovo state `customerRewards` (tipo `AvailableReward[]`: id, name, type, points_required, e i campi di configurazione pertinenti), caricato con lo stesso pattern del `useEffect` per `customerVouchers` (righe 272-282) da un endpoint che restituisca i reward disponibili per quel cliente con relativo `available: boolean` — riusare `GET /api/salons/:id/loyalty/customers/:customerId` (già usato altrove, righe di `available_rewards` in index.ts:248-260) invece di crearne uno nuovo.
- Nuovo pulsante "+ Premio" nella rail accanto a "+ Buono" (vicino a righe 698-705), visibile solo se `loyaltyEnabled && canManageLoyalty && customerId` (serve un cliente selezionato) e **solo quando il carrello è un'unica vendita** (vedi vincolo §4) — altrimenti disabilitato con tooltip.
- Click apre un `Dialog` (pattern esistente, es. quello buono righe 604-670) che lista `customerRewards` filtrati per `available: true`; ogni riga mostra tipo + anteprima calcolata client-side (stessa formula del server, solo per mostrare un numero prima di confermare — es. "Trattamento omaggio: Colore (-€38,00)" o "Sconto 15% su spesa min. €50 (~-€12,00)"); per i tipi trattamento/prodotto, se il servizio/prodotto non è nel carrello il reward è mostrato ma non selezionabile, con messaggio "Aggiungi [nome] al carrello per applicare questo premio".
- Nessuna auto-selezione: l'operatore deve cliccare esplicitamente il reward desiderato in un elenco, poi un secondo tap/bottone di conferma nel dialog (coerente col resto della cassa che usa `ConfirmDialog`/dialog con azione esplicita, non click singolo diretto su riga sensibile).
- Stato locale nuovo `appliedRewards: {reward_id, name, type, previewCents}[]` (parallelo a `issuedVouchers`), mostrato come riga informativa nel riepilogo sconti/pagamenti (accanto al campo "Sconto conto" esistente, riga ~1039) con possibilità di rimuovere (mirror di `removeCartLine`/`setIssuedVouchers` filter).
- In `checkout()` (righe 501-559): includere `redeemed_rewards: appliedRewards.map(r => ({reward_id: r.reward_id}))` nel body **solo per il gruppo unico** (analogamente a come `issued_vouchers` oggi è incluso solo per il gruppo walk-in, riga 533); su risposta ok, azzerare `appliedRewards` in `resetRegister()` (riga 468); su errore, mappare i nuovi codici in `checkoutErrorMessages` (righe 488-499) e mostrare messaggio chiaro senza applicare nulla (nessun rollback parziale lato client necessario: la transazione server è atomica).
- Import necessario: `MODULE_KEYS, useModuleEnabled` da `@esse-beauty/feature-flags` (non presente oggi in questo file, va aggiunto all'import esistente riga 6-7 area).

## 7. Frontend — form premio (`apps/web/app/(dashboard)/loyalty/rewards/new/page.tsx` e `[rewardId]/page.tsx`)

(Le route sotto `settings/loyalty/rewards/...` sono semplici re-export di questi due file — nessuna modifica separata necessaria lì.)

- Aggiungere `Select` (da `@esse-beauty/ui`, già usato altrove con `<option>` — pattern in `settings/documents/[templateId]/page.tsx`) per `type`, con le 5 opzioni in italiano (Trattamento omaggio, Prodotto omaggio, Sconto fisso, Sconto %, Credito).
- Render condizionale sotto al selettore tipo:
  - `free_treatment` → `Select` servizi, fetch `GET /api/salons/:id/services?active=true`.
  - `free_product` → `Select` prodotti, fetch dal nuovo endpoint `GET /api/salons/:id/products?active=true` (§2).
  - `fixed_discount` → input importo (pattern `Math.round(Number(x)*100)` già usato in `settings/services/new/page.tsx:73`) + input opzionale "spesa minima".
  - `percent_discount` → input percentuale (number 1-100) + input opzionali "spesa minima" e "sconto massimo".
  - `credit` → input importo (stesso pattern conversione cents).
- Nessun nuovo componente UI di libreria da creare: `Select` + `FormField` + `<input type="number">` bastano, seguendo esattamente le convenzioni già presenti (niente componenti "vibe-coded" nuovi, coerente con le indicazioni già note su questo progetto per le viste enterprise).

## 8. Dati demo (`apps/api/src/demo/build-demo-scenario.ts`)

- Estendere il blocco loyalty (righe ~858-906) per generare almeno un reward per ciascun `type` con dati coerenti (un trattamento/prodotto esistente nel demo, importi realistici), cosi la UI cassa/admin è verificabile subito con `pnpm demo` o equivalente. Aggiornare `apps/api/src/demo/validate-demo-scenario.ts` solo se i nuovi campi FK-like (`serviceId`/`productId` su `loyaltyRewards`, `saleId` su `loyaltyRewardRedemptions`) non sono già coperti dalla mappa generica `FIELD_TO_TABLE` (righe 14-66) — aggiungere le chiavi mancanti.

## 9. Test da aggiornare/estendere

- `apps/api/src/routes/loyalty/loyalty-service.test.ts`: i test esistenti (righe 65-137) su `redeemLoyaltyReward` con reward di default devono continuare a passare — usare `type: "credit"` nei fixture di quei test dato che ora è l'unico tipo riscattabile da quella funzione standalone; aggiungere nuovi test per `REWARD_REQUIRES_CHECKOUT` sui tipi non-credito, e per la creazione voucher-da-premio (verificare riga `purchase_vouchers` creata con `sourceRewardRedemptionId` popolato).
- Nuovo/esteso `apps/api/src/routes/sales/pos-checkout.test.ts`: essendo test di asserzione sul sorgente (string match), aggiungere assert sul nuovo blocco `redeemed_rewards`/`redeemRewardsInSale` analoghi a quelli già presenti per i voucher (es. che lo sconto premio confluisca in `discountCents` e non in `sale_payments`).
- `apps/web/loyalty-operations.test.ts`: verificare che le nuove stringhe UI aggiunte non rimuovano quelle già attese (test "contains" — non toccare le stringhe esistenti, solo aggiungere le nuove pagine/porzioni).

## Verifica end-to-end

1. `pnpm --filter @esse-beauty/db db:generate` poi `db:migrate` su DB locale; controllare gli snapshot generati.
2. Type-check (`pnpm typecheck` o equivalente) su `apps/api` e `apps/web`.
3. Test: `pnpm --filter api test loyalty` e `pnpm --filter api test pos-checkout` (nomi indicativi, confermare script reali in `package.json`).
4. Manuale in locale (no browser automatico salvo necessità): creare un reward per ciascun tipo dall'admin, verificare in cassa che: (a) col modulo Loyalty disattivato il pulsante "+ Premio" non compaia affatto; (b) con modulo attivo, un trattamento omaggio si applichi solo se il servizio è già in carrello e solo dopo conferma esplicita; (c) un tentativo di riscatto con punti insufficienti blocchi con messaggio chiaro; (d) un reward "credito" generi un buono utilizzabile subito dopo dalla lista buoni esistente in cassa.
