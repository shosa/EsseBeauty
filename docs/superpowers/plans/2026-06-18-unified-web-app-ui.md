# Unified Web App UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere la web app un workspace gestionale completo, coerente e collegato senza rimuovere funzionalità.

**Architecture:** La shell globale possiede sfondo, navigazione e topbar. Le primitive condivise definiscono pagina, header, pannelli, KPI e toolbar; dashboard e impostazioni adottano per prime il nuovo linguaggio, propagato alle altre sezioni tramite `@esse-beauty/ui`.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Preservare API, flussi CRUD e permessi esistenti.
- Mantenere una densità media adatta a un gestionale complesso.
- Evitare sfondi, card statistiche e skeleton duplicati nelle singole pagine.
- Conservare desktop, tablet e mobile.

---

### Task 1: Contratto Connected Workspace

**Files:**
- Modify: `apps/web/ui-polish-regression.test.ts`
- Modify: `packages/ui/index.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces: classi condivise `esse-workspace`, `esse-page-header`, `esse-panel`, `esse-toolbar`.

- [ ] Scrivere test che richiedano shell continua, pagina senza sfondo autonomo e pannelli condivisi.
- [ ] Eseguire il test e verificare il fallimento.
- [ ] Aggiornare primitive e token.
- [ ] Rieseguire test e typecheck.

### Task 2: Shell, navigazione e contesto

**Files:**
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/app/(dashboard)/settings/layout.tsx`

**Interfaces:**
- Consumes: primitive Connected Workspace.
- Produces: sidebar scura, topbar contestuale e impostazioni integrate.

- [ ] Scrivere il contratto shell nel test.
- [ ] Verificare il fallimento.
- [ ] Implementare navigazione raggruppata e topbar contestuale.
- [ ] Verificare test e typecheck.

### Task 3: Dashboard operativa

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: notifiche, agenda, KPI e moduli esistenti.
- Produces: agenda principale e coda “Da fare” collegata.

- [ ] Scrivere il contratto dashboard.
- [ ] Verificare il fallimento.
- [ ] Sostituire componenti locali duplicati con primitive condivise.
- [ ] Collegare priorità e moduli alle relative sezioni.
- [ ] Verificare test e typecheck.

### Task 4: Verifica trasversale

**Files:**
- Test: `apps/web/*.test.ts`

- [ ] Eseguire tutti i test web e UI.
- [ ] Eseguire typecheck web e UI.
- [ ] Controllare dashboard, calendario, clienti e impostazioni nel browser desktop.
- [ ] Controllare dashboard e navigazione nel browser mobile.
