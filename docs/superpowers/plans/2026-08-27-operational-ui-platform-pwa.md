# Operational UI, Platform and PWA implementation plan

1. Scrivere guardie di regressione per dashboard senza link duplicati della rail e per il nuovo componente CTA espandibile.
2. Estrarre la CTA espandibile in `packages/ui`, adottarla in Magazzino e nei principali header CRM; rimuovere pill non informative.
3. Scrivere test WhatsApp per conferma di cancellazione e stato coerente; rifinire drawer e provider.
4. Scrivere test Magazzino per riferimenti articolo leggibili e date documentali; implementare UI e payload.
5. Scrivere test API platform per cancellazione tenant e isolamento; implementare endpoint e console Platform con overview e danger zone.
6. Scrivere contratti PWA clienti e Staff PWA per navigazione, azioni e layout; implementare le viste mantenendo le API esistenti.
7. Eseguire scansione di route/link, simboli inutilizzati e duplicazioni; correggere solo problemi dimostrati da test o typecheck.
8. Eseguire suite e typecheck completi, correggere regressioni, commit per fase e push su `main`.
