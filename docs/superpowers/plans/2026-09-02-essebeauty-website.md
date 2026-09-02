# EsseBeauty Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, accessible Italian sales website for EsseBeauty with a demo conversion action and a prominent login path for existing subscribers.

**Architecture:** Add a focused Next.js App Router package at `apps/website`, following the repository's existing workspace conventions. Keep the page server-rendered and componentized by commercial responsibility, with only a small client component for mobile navigation; centralize external destinations and verify the resulting narrative through source-contract tests plus a production build.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Tailwind CSS 4/PostCSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-essebeauty-website-design.md`

## Global Constraints

- The application directory and workspace package are named `apps/website` and `@esse-beauty/website`.
- All public-facing copy is Italian and must not contain fabricated customer counts, testimonials, ratings, prices, or numerical performance claims.
- The primary CTA is “Richiedi una demo”; the existing-subscriber CTA is “Accedi”.
- Login and demo destinations are centralized in `app/site-config.ts` and can be overridden with `NEXT_PUBLIC_ESSEBEAUTY_APP_URL` and `NEXT_PUBLIC_ESSEBEAUTY_DEMO_EMAIL`.
- The page is server-rendered except for the responsive navigation control.
- Body text and controls meet WCAG AA contrast, controls have visible focus states, navigation is keyboard accessible, and animation honors `prefers-reduced-motion`.
- The page supports responsive reflow without horizontal overflow and remains readable at 200% zoom.
- Reuse the existing EsseBeauty logo asset; do not add unverified third-party branding or product claims.

---

### Task 1: Standalone website package and commercial contract

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/next-env.d.ts`
- Create: `apps/website/next.config.mjs`
- Create: `apps/website/postcss.config.mjs`
- Create: `apps/website/website-contract.test.ts`
- Create: `apps/website/app/site-config.ts`

**Interfaces:**
- Consumes: root `pnpm-workspace.yaml`, `tsconfig.base.json`, and workspace versions already resolved in `pnpm-lock.yaml`.
- Produces: `SITE_CONFIG` with `{ appUrl: string; demoEmail: string; demoMailto: string }`, and package scripts `dev`, `build`, `start`, `lint`, `typecheck`, and `test`.

- [ ] **Step 1: Write the failing commercial contract test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("EsseBeauty sales website", () => {
  it("centralizes the demo and subscriber destinations", () => {
    const config = source("app/site-config.ts");
    expect(config).toContain("NEXT_PUBLIC_ESSEBEAUTY_APP_URL");
    expect(config).toContain("NEXT_PUBLIC_ESSEBEAUTY_DEMO_EMAIL");
    expect(config).toContain("demoMailto");
  });

  it("presents the approved sales story and both conversion actions", () => {
    const page = source("app/page.tsx");
    expect(page).toContain("Il tuo centro estetico, finalmente tutto sotto controllo");
    expect(page).toContain("Richiedi una demo");
    expect(page).toContain("Accedi");
    expect(page).toContain("Funzionalità");
    expect(page).toContain("Come funziona");
    expect(page).toContain("Perché EsseBeauty");
  });

  it("includes accessible navigation and reduced-motion support", () => {
    expect(source("app/page.tsx")).toContain('id="main-content"');
    expect(source("app/_components/SiteHeader.tsx")).toContain("aria-expanded");
    expect(source("app/globals.css")).toContain("prefers-reduced-motion");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/website test`

Expected: FAIL because the package and source files do not exist yet.

- [ ] **Step 3: Add the minimal workspace package configuration**

Create `package.json` with package name `@esse-beauty/website`, Next/React/Lucide dependencies matching existing workspace versions, Tailwind/PostCSS/TypeScript/Vitest development dependencies, port `3005`, and the scripts named in this task's interface. Extend `../../tsconfig.base.json` in `tsconfig.json`; configure DOM libraries, Next's TypeScript plugin, incremental compilation, and the `@/*` path alias. Match `apps/platform/next.config.mjs` for workspace root tracing and Turbopack root. Configure `@tailwindcss/postcss` in `postcss.config.mjs`.

- [ ] **Step 4: Add centralized destinations**

```ts
const appUrl = process.env.NEXT_PUBLIC_ESSEBEAUTY_APP_URL || "http://localhost:3000/login";
const demoEmail = process.env.NEXT_PUBLIC_ESSEBEAUTY_DEMO_EMAIL || "info@essebeauty.it";
const subject = encodeURIComponent("Richiesta demo EsseBeauty");
const body = encodeURIComponent("Buongiorno, vorrei scoprire EsseBeauty e richiedere una demo.");

export const SITE_CONFIG = {
  appUrl,
  demoEmail,
  demoMailto: `mailto:${demoEmail}?subject=${subject}&body=${body}`,
} as const;
```

- [ ] **Step 5: Install the workspace dependencies and rerun the targeted test**

Run: `pnpm install`

Run: `pnpm --dir apps/website test`

Expected: FAIL only because page, header, and CSS files are not implemented.

- [ ] **Step 6: Commit the package foundation**

```bash
git add apps/website/package.json apps/website/tsconfig.json apps/website/next-env.d.ts apps/website/next.config.mjs apps/website/postcss.config.mjs apps/website/website-contract.test.ts apps/website/app/site-config.ts pnpm-lock.yaml
git commit -m "test(website): define promotional site contract"
```

---

### Task 2: Brand shell, accessible navigation, and meaningful hero preview

**Files:**
- Create: `apps/website/app/layout.tsx`
- Create: `apps/website/app/globals.css`
- Create: `apps/website/app/page.tsx`
- Create: `apps/website/app/_components/BrandLogo.tsx`
- Create: `apps/website/app/_components/SiteHeader.tsx`
- Create: `apps/website/app/_components/ProductPreview.tsx`
- Create: `apps/website/public/esse-logo.svg`

**Interfaces:**
- Consumes: `SITE_CONFIG` from `app/site-config.ts`.
- Produces: `BrandLogo`, `SiteHeader`, and `ProductPreview` React components; semantic tokens shared by every later section; the `main-content` landmark and approved hero copy.

- [ ] **Step 1: Add the minimal semantic page structure needed by the contract**

Create `page.tsx` with a skip link, `SiteHeader`, `<main id="main-content">`, hero eyebrow, exact approved headline, concise supporting copy, demo and access anchors using `SITE_CONFIG`, three product-quality statements, and the initial `ProductPreview`. Use semantic HTML rather than client state.

- [ ] **Step 2: Implement the accessible responsive header**

Create a client `SiteHeader` with a button that exposes `aria-expanded`, `aria-controls="primary-navigation"`, a textual accessible name that changes with menu state, anchor links for the three approved sections, and both conversion links. Close the menu when an anchor is selected; keep desktop navigation visible through CSS.

- [ ] **Step 3: Establish the complete visual token system before component styling**

In `globals.css`, import Tailwind, define ivory, espresso, plum, blush, border, muted, focus, success, and amber tokens; set fluid typography and spacing; style skip-link behavior, `.button-primary`, `.button-secondary`, `.eyebrow`, `.section-shell`, and visible `:focus-visible` rings. Add global `box-sizing`, smooth scrolling, safe overflow handling, and a `prefers-reduced-motion: reduce` block that disables smooth scrolling and nonessential animation.

- [ ] **Step 4: Build the recognizable product preview**

Implement `ProductPreview` as accessible interface-native markup showing a realistic day header, appointment timeline, client names, service labels, daily revenue summary, and a small occupancy/status panel. Mark purely decorative icons and shapes `aria-hidden="true"`; give the preview an `aria-label` describing it as an illustrative EsseBeauty workspace.

- [ ] **Step 5: Add metadata and local brand asset**

In `layout.tsx`, load a characterful display font and legible sans font with `next/font/google`, set Italian metadata title and description, and apply font variables. Copy the existing `apps/web/public/esse-logo.svg` to `apps/website/public/esse-logo.svg`; render it through `BrandLogo` with the EsseBeauty wordmark in text.

- [ ] **Step 6: Run focused verification**

Run: `pnpm --dir apps/website test`

Expected: PASS for the commercial contract.

Run: `pnpm --dir apps/website typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Start the retained development server and verify the route responds**

Run: `pnpm --dir apps/website dev`

In another terminal run: `Invoke-WebRequest -UseBasicParsing http://localhost:3005 | Select-Object StatusCode`

Expected: `200`. Open this first meaningful preview in Codex only after this response succeeds.

- [ ] **Step 8: Commit the brand shell and hero**

```bash
git add apps/website/app apps/website/public/esse-logo.svg
git commit -m "feat(website): add sales hero and brand shell"
```

---

### Task 3: Complete the commercial narrative

**Files:**
- Create: `apps/website/app/_components/FeatureShowcase.tsx`
- Create: `apps/website/app/_components/OutcomeStrip.tsx`
- Create: `apps/website/app/_components/StepsSection.tsx`
- Create: `apps/website/app/_components/ReasonsSection.tsx`
- Create: `apps/website/app/_components/FinalCta.tsx`
- Create: `apps/website/app/_components/SiteFooter.tsx`
- Modify: `apps/website/app/page.tsx`
- Modify: `apps/website/app/globals.css`
- Modify: `apps/website/website-contract.test.ts`

**Interfaces:**
- Consumes: `SITE_CONFIG`, shared button/section/typography classes, and `BrandLogo`.
- Produces: anchored sections with IDs `funzionalita`, `come-funziona`, and `perche-essebeauty`; four commercial pillars; final CTA and footer.

- [ ] **Step 1: Extend the failing contract for truthful feature coverage**

Add assertions that combined component source contains these exact capability labels: `Agenda e lista d’attesa`, `Clienti e fidelizzazione`, `Cassa e magazzino`, `Marketing e recensioni`, and that the source does not contain `oltre 1.000`, `5 stelle`, or `risultati garantiti`.

- [ ] **Step 2: Run the test to verify the new assertions fail**

Run: `pnpm --dir apps/website test`

Expected: FAIL because the feature section components do not yet exist.

- [ ] **Step 3: Implement the outcome transition and four feature pillars**

Build `OutcomeStrip` with the three business outcomes from the spec. Build `FeatureShowcase` from a typed local array whose four entries correspond to smoother days, complete client knowledge, commercial control, and data-led decisions. Each entry includes a result-focused heading, concise paragraph, capability list, and a distinct interface preview using realistic Italian data. Alternate wide-screen composition through an `isReverse` class while retaining source order on mobile.

- [ ] **Step 4: Implement adoption and proof sections**

Build `StepsSection` with the three approved adoption steps and `ReasonsSection` with the five evidence-safe product qualities. Use ordered-list semantics for steps and meaningful headings for proof points; do not add ratings, testimonials, or numerical claims.

- [ ] **Step 5: Implement final conversion and footer**

Build `FinalCta` using both `SITE_CONFIG.demoMailto` and `SITE_CONFIG.appUrl`. Build `SiteFooter` with anchored product links, demo email, the access link, current year, and no links to nonexistent legal pages.

- [ ] **Step 6: Compose the complete page and responsive styling**

Update `page.tsx` to render the new sections in narrative order. Extend `globals.css` with the commercial grid, alternating feature layout, preview variants, ordered steps, CTA panel, and footer; collapse grids at 900px and mobile navigation at 760px; enforce minimum 44px primary touch targets and readable mobile preview simplification.

- [ ] **Step 7: Run the focused test and typecheck**

Run: `pnpm --dir apps/website test && pnpm --dir apps/website typecheck`

Expected: both commands PASS.

- [ ] **Step 8: Commit the complete narrative**

```bash
git add apps/website/app apps/website/website-contract.test.ts
git commit -m "feat(website): complete EsseBeauty sales narrative"
```

---

### Task 4: Social metadata and final verification

**Files:**
- Create: `apps/website/public/og.png`
- Modify: `apps/website/app/layout.tsx`
- Modify: `apps/website/website-contract.test.ts`
- Modify: `apps/website/package.json` only if final scripts require correction.

**Interfaces:**
- Consumes: the completed visual direction, exact product title, and public origin from `NEXT_PUBLIC_SITE_URL` with a safe default.
- Produces: site-wide Open Graph and X metadata using `/og.png`; a production-ready independent workspace package.

- [ ] **Step 1: Add failing metadata assertions**

Extend `website-contract.test.ts` to require `openGraph`, `twitter`, `EsseBeauty`, `/og.png`, and `NEXT_PUBLIC_SITE_URL` in `layout.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/website test`

Expected: FAIL because complete social metadata is absent.

- [ ] **Step 3: Create and wire the branded social preview**

Generate one landscape image using the site palette and exact headline “Il tuo centro estetico, finalmente tutto sotto controllo.” Save it at `public/og.png`. Inspect the image for exact, legible text. In `layout.tsx`, derive `metadataBase` from `NEXT_PUBLIC_SITE_URL || "http://localhost:3005"` and configure matching Open Graph and X titles, descriptions, and `/og.png` image metadata.

- [ ] **Step 4: Run the full website verification**

Run: `pnpm --dir apps/website test`

Expected: PASS.

Run: `pnpm --dir apps/website typecheck`

Expected: PASS.

Run: `pnpm --dir apps/website build`

Expected: production build completes successfully and renders `/` as a static or server-rendered page without errors.

- [ ] **Step 5: Check repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors in website files. Review `git status --short` and stage only `apps/website` plus the plan/checklist updates; preserve all unrelated user changes.

- [ ] **Step 6: Commit the production-ready website**

```bash
git add apps/website
git commit -m "feat(website): finalize promotional website"
```

