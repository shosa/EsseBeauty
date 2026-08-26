# EsseBeauty operational UI, Platform and PWA design

## Intent

Consolidare il prodotto attorno a un linguaggio operativo unico senza cambiare identità visiva o introdurre schermate decorative. Le funzioni già raggiungibili dalla rail non vengono duplicate nella dashboard; le azioni estese adottano il modello Magazzino (icona, tono semantico, etichetta espansa su hover/focus); badge e pill restano solo quando comunicano uno stato che richiede una decisione.

## Workstreams

1. **CRM e shell** — rimuovere scorciatoie duplicate, rendere coerenti header, card, azioni e stati, eliminare route o funzioni realmente orfane solo dopo verifica dei riferimenti.
2. **WhatsApp** — rendere il drawer leggibile su desktop e mobile, mostrare chiaramente azioni letto/non letto/cancellazione, chiedere conferma per la rimozione e mantenere selezione e badge coerenti.
3. **Magazzino** — non mostrare UUID nella selezione articolo, salvare data documento e data competenza, distinguere i flussi e rendere complete le operazioni già supportate dal backend.
4. **Platform** — trasformare la pagina in console multi-tenant: overview, ricerca saloni, identità/licenza, accesso owner, moduli e cancellazione protetta del tenant. Riutilizzare le API platform già disponibili e aggiungere solo il contratto di cancellazione mancante.
5. **PWA clienti** — navigazione e card coerenti, azioni principali iconiche, riepilogo utile e stati vuoti/errore chiari sulle funzioni esistenti.
6. **PWA staff** — shell mobile conforme, dashboard giornaliera, agenda, richieste e profilo organizzati in viste operative; preservare permessi e API esistenti.

## Safety and data rules

- La cancellazione di un salone è riservata al platform admin, richiede conferma digitata e viene eseguita in transazione.
- Nessun UUID tecnico viene mostrato come etichetta utente.
- Le azioni distruttive hanno tono rosso, conferma esplicita e messaggio d’errore persistente.
- Le API restano tenant-scoped; la console platform è l’unica eccezione autenticata dal cookie platform.

## Verification

Ogni comportamento nuovo viene introdotto con test fallente, poi implementato. Ogni fase termina con test mirati, typecheck dei package coinvolti, `git diff --check`, commit e push. La chiusura richiede `pnpm test` e typecheck di Web, API, PWA e Staff PWA.

## Autonomous approval

Il committente ha esplicitamente delegato pianificazione, analisi e decisioni durante la propria assenza e ha richiesto implementazione, commit e push senza ulteriori domande. Questa specifica fissa le assunzioni conservative usate durante l’esecuzione.
