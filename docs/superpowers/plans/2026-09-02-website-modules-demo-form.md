# Website Modules and Demo Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete `/moduli` catalog and replace every demo mail link with one accessible contact-form modal that truthfully hands off to the visitor’s email application.

**Architecture:** A client-side `DemoContactProvider` owns one native dialog and exposes its opener through context; lightweight `DemoContactButton` triggers reuse it across header, hero, and final CTA. A server-rendered `/moduli` route reads a typed module catalog and shares the existing website chrome, conversion flow, and design tokens.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, native HTML dialog and form validation, Vitest source contracts.

**Spec:** `docs/superpowers/specs/2026-09-02-essebeauty-website-design.md`

## Global Constraints

- Preserve `apps/website` as an independent workspace package.
- All public copy is Italian and describes only capabilities present in the repository.
- “Accedi” remains a normal subscriber link and never opens the demo form.
- The contact flow does not display a sent, saved, or success state because no backend accepts the data.
- The modal states that continuing opens the visitor’s email application.
- The modal supports Escape dismissal, focus restoration, accessible title/description, and disabled background scrolling.
- `/moduli` defines route-specific metadata and no pricing or plan-inclusion claims.

---

### Task 1: Reusable accessible demo-contact flow

**Files:**
- Create: `apps/website/app/_components/DemoContact.tsx`
- Modify: `apps/website/app/site-config.ts`
- Modify: `apps/website/app/layout.tsx`
- Modify: `apps/website/app/globals.css`
- Modify: `apps/website/website-contract.test.ts`

**Interfaces:**
- Consumes: `SITE_CONFIG.demoEmail`.
- Produces: `DemoContactProvider({ children })`, `DemoContactButton({ children, className? })`, and `createDemoMailto(fields)` returning a fully encoded mailto string.

- [ ] **Step 1: Write the failing dialog contract**

```ts
it("provides a truthful reusable demo dialog", () => {
  const dialog = source("app/_components/DemoContact.tsx");
  expect(dialog).toContain("DemoContactProvider");
  expect(dialog).toContain("DemoContactButton");
  expect(dialog).toContain("createDemoMailto");
  expect(dialog).toContain("Apre la tua applicazione email");
  expect(dialog).toContain("Solo io");
  expect(dialog).toContain("2–5 persone");
  expect(dialog).not.toContain("Richiesta inviata");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/website test`

Expected: FAIL because `DemoContact.tsx` does not exist.

- [ ] **Step 3: Implement mail composition and the shared dialog**

Define a `DemoFields` interface with `name`, `business`, `email`, `phone`, `teamSize`, and `message`. `createDemoMailto` uses `URLSearchParams`-safe encoding to compose a subject `Richiesta demo EsseBeauty — <business>` and an Italian body containing every supplied field. Implement a native `<dialog>` controlled with `showModal()` and `close()`, restore focus to the opener after close, and toggle `document.body.style.overflow` while open. The form uses required labels and native `type="email"` validation; `onSubmit` sets `window.location.href` to the composed mailto and closes the dialog without rendering success UI.

- [ ] **Step 4: Install the provider at the website root and style the form**

Wrap `children` with `DemoContactProvider` in `layout.tsx`. Add backdrop, panel, close button, responsive form grid, field, select, textarea, disclosure, and action styles to `globals.css`; retain visible focus rings and minimum 44px controls.

- [ ] **Step 5: Run test and typecheck**

Run: `pnpm --dir apps/website test && pnpm --dir apps/website typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/app apps/website/website-contract.test.ts
git commit -m "feat(website): add reusable demo contact dialog"
```

---

### Task 2: Complete modules catalog route

**Files:**
- Create: `apps/website/app/moduli/module-catalog.ts`
- Create: `apps/website/app/moduli/page.tsx`
- Modify: `apps/website/app/globals.css`
- Modify: `apps/website/website-contract.test.ts`

**Interfaces:**
- Consumes: `SiteHeader`, `FinalCta`, `SiteFooter`, and `DemoContactButton`.
- Produces: `MODULE_GROUPS`, a typed readonly array of eight groups with `id`, `eyebrow`, `title`, `description`, `icon`, and `modules`; route `/moduli` with route-specific metadata.

- [ ] **Step 1: Write the failing modules-page contract**

```ts
it("documents every module area on a dedicated route", () => {
  const catalog = source("app/moduli/module-catalog.ts");
  const page = source("app/moduli/page.tsx");
  for (const label of ["Agenda e operatività", "Clienti e fidelizzazione", "Team e risorse", "Cassa e vendite", "Magazzino e acquisti", "Marketing e WhatsApp", "Recensioni e documenti", "Report e amministrazione"]) expect(catalog).toContain(label);
  expect(page).toContain("Tutti i moduli. Un solo modo di lavorare meglio.");
  expect(page).toContain("export const metadata");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/website test`

Expected: FAIL because the route and catalog do not exist.

- [ ] **Step 3: Create the truthful typed catalog**

Populate the eight approved areas with 3–5 cards each. Every card has `name`, a one-sentence operational explanation, and 2–4 concrete functions already represented by the repository’s calendar, client, staff, sales, inventory, marketing, communications, review, document, report, accounting, and settings surfaces.

- [ ] **Step 4: Build the route**

Add route metadata. Compose skip link, header, compact hero, category anchor navigation, eight alternating module sections, a connection statement, `FinalCta`, and `SiteFooter`. Use semantic sections and headings, keeping card layout server-rendered.

- [ ] **Step 5: Add responsive catalog styling**

Create `modules-hero`, `module-jump-nav`, `module-group`, `module-card-grid`, `module-card`, and `modules-connection` styles. Use 3 columns on wide screens, 2 at tablet widths, and 1 on mobile; anchor targets use `scroll-margin-top`.

- [ ] **Step 6: Run test and typecheck**

Run: `pnpm --dir apps/website test && pnpm --dir apps/website typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/app/moduli apps/website/app/globals.css apps/website/website-contract.test.ts
git commit -m "feat(website): add complete modules catalog"
```

---

### Task 3: Connect navigation and every demo CTA

**Files:**
- Modify: `apps/website/app/_components/SiteHeader.tsx`
- Modify: `apps/website/app/_components/FinalCta.tsx`
- Modify: `apps/website/app/page.tsx`
- Modify: `apps/website/app/_components/SiteFooter.tsx`
- Modify: `apps/website/app/globals.css`
- Modify: `apps/website/website-contract.test.ts`

**Interfaces:**
- Consumes: `DemoContactButton` and route `/moduli`.
- Produces: demo triggers at all current CTA positions and module navigation available from header/footer/homepage.

- [ ] **Step 1: Add a failing integration contract**

Assert that header, homepage, and final CTA import `DemoContactButton`, that none uses `SITE_CONFIG.demoMailto`, that header and footer include `/moduli`, and that `SITE_CONFIG.appUrl` remains in header, hero, and final CTA.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/website test`

Expected: FAIL on existing mailto anchors and missing `/moduli` links.

- [ ] **Step 3: Replace demo links and add catalog navigation**

Replace each demo anchor with `DemoContactButton` while preserving its class and copy. Add “Tutti i moduli” to desktop/mobile navigation and the footer. Add a contextual “Esplora tutti i moduli” link after the homepage feature showcase.

- [ ] **Step 4: Run complete website verification**

Run: `pnpm --dir apps/website test`

Run: `pnpm --dir apps/website typecheck`

Run: `pnpm --dir apps/website build`

Expected: five or more contract tests pass, TypeScript exits cleanly, and the build lists both `/` and `/moduli` as prerendered routes.

- [ ] **Step 5: Check repository hygiene and commit**

Run: `git diff --check`

```bash
git add apps/website
git commit -m "feat(website): connect module discovery and demo capture"
```

