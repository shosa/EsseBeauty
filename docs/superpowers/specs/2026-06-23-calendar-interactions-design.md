# EsseBeauty Calendar Interactions

## Obiettivo

Completare l’agenda operativa con scelta cabina nel wizard, drag & drop confermato, avvisi forzabili e menu contestuali.

## Flussi

- Il wizard mostra solo cabine collegate al servizio. Se più cabine sono compatibili, l’utente sceglie; se una sola è disponibile viene proposta automaticamente.
- Il drag modifica una bozza locale e apre sempre un riepilogo. Nessuna modifica viene salvata prima di “Conferma spostamento”.
- Il riepilogo mostra vecchio/nuovo orario, staff e cabina. Sovrapposizione staff, assenza, fuori orario e cabina occupata possono essere forzati con conferma esplicita.
- La chiusura salone, i permessi mancanti e dati cross-tenant non sono forzabili.
- Il menu contestuale appuntamento offre Apri, Sposta, Duplica, Cambia stato ed Elimina.
- Il menu contestuale sull’agenda vuota offre “Nuovo appuntamento qui”, precompilando orario e staff oppure cabina.

## API

- Le route appuntamenti accettano `resource_id`, `staff_id` e `force_conflicts`.
- La validazione restituisce conflitti strutturati con codice, messaggio e `forceable`.
- Il backend verifica sempre tenant, permessi, qualifiche staff e compatibilità servizio-cabina.

## UI

- `@dnd-kit` gestisce trascinamento e destinazioni.
- Un dialog condiviso conferma ogni spostamento.
- I menu contestuali sono accessibili anche tramite pulsante azioni, non solo click destro.

## Verifica

- Test API per compatibilità cabina, conflitti forzabili e chiusure rigide.
- Test contrattuali UI per wizard, drag con conferma e menu.
- Test completi e typecheck.
