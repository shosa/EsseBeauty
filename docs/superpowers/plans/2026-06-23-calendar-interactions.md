# Calendar Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere scelta cabina, drag & drop confermato, conflitti forzabili e menu contestuali all’agenda.

**Architecture:** L’API produce una valutazione strutturata dei conflitti e applica override espliciti. Il frontend usa primitive locali per destinazioni drag, dialog di conferma e menu contestuali, mantenendo il salvataggio separato dall’interazione.

**Tech Stack:** Fastify 5, Drizzle ORM, Next.js 15, React 19, `@dnd-kit/core`, Vitest.

## Global Constraints

- Nessun drag salva senza conferma.
- Chiusure salone, permessi e tenant non sono forzabili.
- Staff e cabine devono essere compatibili con il servizio.
- Preservare colori, affiancamento e legenda dell’agenda.

---

### Task 1: Contratto conflitti e cabine

**Files:**
- Modify: `apps/api/src/routes/appointments/index.ts`
- Modify: `apps/api/src/routes/appointments/index.test.ts`

**Interfaces:**
- Produces: body `resource_id?`, `staff_id?`, `force_conflicts?`; risposta `conflicts: SchedulingConflict[]`.

- [ ] Scrivere test fallenti per cabina esplicita, conflitti forzabili e chiusura rigida.
- [ ] Implementare validazione centralizzata e aggiornare POST/PATCH.
- [ ] Eseguire test API e typecheck.

### Task 2: Wizard cabina e precompilazione

**Files:**
- Modify: `apps/web/app/(dashboard)/calendar/appointments/new/page.tsx`
- Modify: `apps/web/critical-crud-routes.test.ts`

**Interfaces:**
- Consumes: risorse da control-center e query params `startsAt`, `staffId`, `resourceId`.
- Produces: selezione cabina compatibile e invio `resource_id`.

- [ ] Scrivere contratto UI fallente.
- [ ] Implementare caricamento, filtro, proposta e precompilazione.
- [ ] Verificare test e typecheck web.

### Task 3: Drag & drop con conferma

**Files:**
- Modify: `apps/web/app/(dashboard)/calendar/page.tsx`
- Modify: `apps/web/ui-polish-regression.test.ts`

**Interfaces:**
- Produces: `PendingAppointmentMove` e dialog obbligatorio prima della PATCH.

- [ ] Scrivere contratto fallente per `DndContext` e conferma.
- [ ] Rendere card trascinabili e slot/colonne destinazioni.
- [ ] Mostrare riepilogo e conflitti; salvare solo dopo conferma.
- [ ] Verificare test e typecheck.

### Task 4: Menu contestuali

**Files:**
- Modify: `apps/web/app/(dashboard)/calendar/page.tsx`
- Modify: `apps/web/ui-polish-regression.test.ts`

**Interfaces:**
- Produces: menu appuntamento e menu slot vuoto.

- [ ] Scrivere contratto fallente per azioni menu.
- [ ] Implementare click destro e pulsante accessibile.
- [ ] Collegare apertura, spostamento, duplicazione, stato, eliminazione e nuovo appuntamento precompilato.
- [ ] Verificare test e typecheck.

### Task 5: Verifica trasversale

**Files:**
- Test: `apps/api/src/**/*.test.ts`
- Test: `apps/web/*.test.ts`

- [ ] Eseguire `pnpm test`.
- [ ] Eseguire `pnpm typecheck`.
- [ ] Eseguire `git diff --check`.
