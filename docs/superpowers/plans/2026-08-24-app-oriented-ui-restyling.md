# App-Oriented UI Restyling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete salon dashboard as an Odoo-inspired hybrid app workspace while preserving every existing route, API contract, feature flag and operational flow.

**Architecture:** A typed app registry becomes the single source for the rail, launcher, topbar, contextual navigation and mobile navigation. Shared primitives in `@esse-beauty/ui` establish the denser visual system, while route groups are migrated by domain so each commit remains usable and reversible.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, Tailwind CSS, Motion, Vitest, Fastify APIs already present in the repository.

## Global Constraints

- Preserve all existing dashboard route URLs and API contracts.
- Preserve module feature-flag behavior and hide disabled apps from every navigation surface.
- Keep `main` at commit `433e5f0` as the pre-restyling restore point.
- Use the existing EsseBeauty palette; mulberry is for orientation and primary action, not decorative saturation.
- Use Italian copy with correct accents.
- Use no emoji in the production UI.
- Support 1440 px, 1024 px and 390 px layouts, 44 px touch targets, visible focus and reduced motion.
- Each task must end with passing targeted tests and a focused commit.

---

### Task 1: Typed app registry and navigation contract

**Files:**
- Create: `apps/web/app/(dashboard)/_components/app-registry.ts`
- Modify: `apps/web/app/(dashboard)/_components/shell-config.ts`
- Modify: `apps/web/app/(dashboard)/_components/Icons.tsx`
- Modify: `apps/web/shell-config.test.ts`
- Test: `apps/web/app-registry.test.ts`

**Interfaces:**
- Consumes: `MODULE_KEYS` and the existing icon components.
- Produces: `AppDefinition`, `APP_DOMAINS`, `APP_REGISTRY`, `appForPath(pathname)`, `visibleApps(enabledModules)` and `contextTabsForPath(pathname)`.

- [ ] **Step 1: Write the failing registry tests**

Assert exact app keys and domains, longest-prefix route matching, correct labels with accents, and exclusion of a disabled `inventory` feature.

```ts
expect(APP_REGISTRY.map((app) => app.key)).toContain("calendar");
expect(appForPath("/settings/loyalty/rewards/new")?.key).toBe("loyalty");
expect(visibleApps(new Set()).some((app) => app.key === "inventory")).toBe(false);
expect(APP_REGISTRY.find((app) => app.key === "accounting")?.label).toBe("Contabilità");
```

- [ ] **Step 2: Run the registry tests and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- app-registry.test.ts shell-config.test.ts`

Expected: failure because `app-registry.ts` and its exports do not exist.

- [ ] **Step 3: Implement the registry and icon coverage**

Define each app with `key`, `label`, `description`, `domain`, `href`, `icon`, optional `moduleKey`, `accent`, `quickActions` and `tabs`. Order route matching by descending route length so nested settings routes resolve to the owning app.

- [ ] **Step 4: Run targeted tests and typecheck**

Run: `corepack pnpm --filter @esse-beauty/web test -- app-registry.test.ts shell-config.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the registry**

```powershell
git add apps/web/app-registry.test.ts apps/web/shell-config.test.ts 'apps/web/app/(dashboard)/_components/app-registry.ts' 'apps/web/app/(dashboard)/_components/shell-config.ts' 'apps/web/app/(dashboard)/_components/Icons.tsx'
git commit -m "feat: define app-oriented dashboard registry"
```

### Task 2: Shared app-workspace primitives and visual tokens

**Files:**
- Modify: `packages/ui/index.tsx`
- Modify: `apps/web/ui-contract.test.ts`
- Modify: `apps/web/app/design-tokens.md`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: existing `Button`, `AppPage`, `PageHeader`, `SectionCard`, `DataTable`, `Drawer` and design tokens.
- Produces: `AppIconTile`, `AppLauncherPanel`, `ContextTabs`, `WorkspaceToolbar`, `KpiStrip`, `InboxItem`, and denser backward-compatible styles for existing primitives.

- [ ] **Step 1: Extend the UI contract test**

Import every new primitive, assert that it is a function, and assert `designTokens.layout.railWidth === "76px"`, `designTokens.layout.tableRowHeight === "46px"`.

- [ ] **Step 2: Run the UI contract and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- ui-contract.test.ts`

Expected: missing-export failures for the new primitives.

- [ ] **Step 3: Implement the primitive contracts**

Use semantic elements, 44 px controls, visible `focus-visible` styling and className extension points. Keep existing props compatible so current pages continue compiling during migration.

- [ ] **Step 4: Apply the denser global visual foundation**

Update workspace background, input focus, cards, tables, scrollbar, reduced-motion behavior and responsive spacing. Remove oversized shadows and decorative gradients from shared primary actions while retaining clear hierarchy.

- [ ] **Step 5: Verify UI package and web contracts**

Run: `corepack pnpm --filter @esse-beauty/ui build && corepack pnpm --filter @esse-beauty/web test -- ui-contract.test.ts ui-polish-regression.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: build, selected tests and typecheck pass.

- [ ] **Step 6: Commit the foundation**

```powershell
git add packages/ui/index.tsx apps/web/ui-contract.test.ts apps/web/ui-polish-regression.test.ts apps/web/app/design-tokens.md apps/web/app/globals.css
git commit -m "feat: add app workspace UI foundation"
```

### Task 3: Hybrid shell, launcher, contextual topbar and mobile navigation

**Files:**
- Create: `apps/web/app/(dashboard)/_components/AppRail.tsx`
- Create: `apps/web/app/(dashboard)/_components/AppLauncher.tsx`
- Create: `apps/web/app/(dashboard)/_components/WorkspaceTopbar.tsx`
- Create: `apps/web/app/(dashboard)/_components/MobileAppNavigation.tsx`
- Create: `apps/web/app/(dashboard)/_components/CommandPalette.tsx`
- Create: `apps/web/app/(dashboard)/_components/NotificationCenter.tsx`
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/shell-config.test.ts`
- Test: `apps/web/app-shell-contract.test.ts`

**Interfaces:**
- Consumes: `APP_REGISTRY`, `appForPath`, `visibleApps`, `contextTabsForPath`, authentication state, shell preference endpoints and existing notification/search APIs.
- Produces: a global shell with `--app-rail-width`, launcher state, contextual app title/tabs, global search, notification drawer and mobile app navigation.

- [ ] **Step 1: Write shell source-contract tests**

Assert that the shell renders the six focused components, uses `aria-label="Apri tutte le app"`, exposes `Ctrl+K`, and contains mobile destinations Home, Agenda, Cassa and Altro.

- [ ] **Step 2: Run shell tests and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- app-shell-contract.test.ts shell-config.test.ts`

Expected: missing component/source assertions fail.

- [ ] **Step 3: Extract search and notifications without behavior changes**

Move existing API calls and types from `DashboardShell.tsx` into focused components. Retain endpoint paths, cookie credentials, read/archive behavior and the `esse:open-notifications` event.

- [ ] **Step 4: Implement rail and launcher**

Render enabled apps from the registry, include keyboard/escape handling, focus return, current-app state and descriptive tooltips. Persist the current collapsed preference endpoint without making it a render dependency.

- [ ] **Step 5: Implement topbar and mobile navigation**

Render current app identity, context tabs, contextual primary action, global search and inbox. At widths below `md`, replace the rail with the four-item mobile navigation and full-screen launcher.

- [ ] **Step 6: Replace the old shell composition**

Reduce `DashboardShell.tsx` to authentication, cross-cutting data loading and composition of focused shell components. Preserve onboarding redirect and logout behavior.

- [ ] **Step 7: Verify shell behavior**

Run: `corepack pnpm --filter @esse-beauty/web test -- app-shell-contract.test.ts shell-config.test.ts middleware.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: all selected tests and typecheck pass.

- [ ] **Step 8: Commit the shell**

```powershell
git add 'apps/web/app/(dashboard)/_components' apps/web/app-shell-contract.test.ts apps/web/shell-config.test.ts
git commit -m "feat: build hybrid app workspace shell"
```

### Task 4: Operational Home

**Files:**
- Create: `apps/web/app/(dashboard)/_components/HomeKpiStrip.tsx`
- Create: `apps/web/app/(dashboard)/_components/TodayTimeline.tsx`
- Create: `apps/web/app/(dashboard)/_components/OperationalInbox.tsx`
- Modify: `apps/web/app/(dashboard)/page.tsx`
- Test: `apps/web/home-workspace-contract.test.ts`

**Interfaces:**
- Consumes: existing dashboard endpoint response, notification opening event and existing route links.
- Produces: actionable KPI strip, today's timeline, unified pending-work panel and quick actions.

- [ ] **Step 1: Write failing Home contract tests**

Assert headings “Oggi nel salone” and “Da gestire”, links to `/calendar`, `/sales`, `/clients`, and the notification event trigger.

- [ ] **Step 2: Run the Home contract and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- home-workspace-contract.test.ts`

Expected: new component/source assertions fail.

- [ ] **Step 3: Implement focused Home components**

Map existing data to compact KPI, timeline and actionable inbox presentations. Preserve loading, partial-data and error states.

- [ ] **Step 4: Compose the operational Home**

Use one dominant timeline area and one secondary inbox area, followed by lower-priority team/module status. Remove decorative duplication.

- [ ] **Step 5: Verify Home and critical routes**

Run: `corepack pnpm --filter @esse-beauty/web test -- home-workspace-contract.test.ts critical-crud-routes.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: all selected tests and typecheck pass.

- [ ] **Step 6: Commit Home**

```powershell
git add 'apps/web/app/(dashboard)/page.tsx' 'apps/web/app/(dashboard)/_components/HomeKpiStrip.tsx' 'apps/web/app/(dashboard)/_components/TodayTimeline.tsx' 'apps/web/app/(dashboard)/_components/OperationalInbox.tsx' apps/web/home-workspace-contract.test.ts
git commit -m "feat: turn dashboard into operational home"
```

### Task 5: Agenda and Cassa specialist workspaces

**Files:**
- Modify: `apps/web/app/(dashboard)/calendar/page.tsx`
- Modify: `apps/web/app/(dashboard)/calendar/_components/AppointmentDetailPanel.tsx`
- Modify: `apps/web/app/(dashboard)/calendar/appointments/new/page.tsx`
- Modify: `apps/web/app/(dashboard)/sales/page.tsx`
- Modify: `apps/web/calendar-timeline-compression.test.ts`
- Modify: `apps/web/ui-polish-regression.test.ts`

**Interfaces:**
- Consumes: existing calendar and checkout state/actions plus shared workspace primitives.
- Produces: compact Agenda toolbar and details, sticky Cassa totals/payment panel, responsive specialist layouts.

- [ ] **Step 1: Add failing source-contract assertions**

Assert Agenda uses the shared `WorkspaceToolbar` and context tabs, and Cassa contains a sticky checkout summary while preserving payment method controls and existing register fields.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- calendar-timeline-compression.test.ts ui-polish-regression.test.ts`

Expected: new shared-workspace assertions fail.

- [ ] **Step 3: Restyle Agenda without changing scheduling logic**

Move date navigation, view switch, resource filters, legend and create action into the compact workspace chrome. Preserve drag/resize, overlap confirmation, compression and detail-panel behavior.

- [ ] **Step 4: Restyle Cassa without changing checkout logic**

Organize catalog/customer selection on the left and a sticky cart, totals and payment flow on the right. Preserve split payment, register, receipt and validation behavior introduced by commit `af10366`.

- [ ] **Step 5: Verify specialist flows**

Run: `corepack pnpm --filter @esse-beauty/web test -- calendar-timeline-compression.test.ts ui-polish-regression.test.ts critical-crud-routes.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: all selected tests and typecheck pass.

- [ ] **Step 6: Commit specialist workspaces**

```powershell
git add 'apps/web/app/(dashboard)/calendar' 'apps/web/app/(dashboard)/sales/page.tsx' apps/web/calendar-timeline-compression.test.ts apps/web/ui-polish-regression.test.ts
git commit -m "feat: refine agenda and checkout workspaces"
```

### Task 6: Relazioni apps

**Files:**
- Modify: `apps/web/app/(dashboard)/clients/page.tsx`
- Modify: `apps/web/app/(dashboard)/clients/[customerId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/clients/new/page.tsx`
- Modify: `apps/web/app/(dashboard)/staff/page.tsx`
- Modify: `apps/web/app/(dashboard)/services/page.tsx`
- Modify: `apps/web/app/(dashboard)/vouchers/page.tsx`
- Modify: `apps/web/critical-crud-routes.test.ts`
- Modify: `apps/web/remaining-crud-routes.test.ts`

**Interfaces:**
- Consumes: shared toolbar/table/form primitives and unchanged CRUD endpoints.
- Produces: coherent list/detail/form layouts for Clienti, Staff, Servizi and Buoni acquisto.

- [ ] **Step 1: Add failing Relazioni contract assertions**

Require compact headers, shared toolbars, mobile list affordances, explicit primary actions and useful empty-state copy on each app route.

- [ ] **Step 2: Run route contracts and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- critical-crud-routes.test.ts remaining-crud-routes.test.ts`

Expected: at least one new shared-layout assertion fails.

- [ ] **Step 3: Migrate list pages**

Apply consistent counts, search/filter/action toolbar, dense rows and mobile structured cards. Retain every fetch, mutation and route target.

- [ ] **Step 4: Migrate detail and creation pages**

Use compact breadcrumb/header, grouped form sections, persistent action bar and inline validation while preserving all fields and mutations.

- [ ] **Step 5: Verify Relazioni flows**

Run: `corepack pnpm --filter @esse-beauty/web test -- critical-crud-routes.test.ts remaining-crud-routes.test.ts encoding.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: selected tests and typecheck pass with no encoding failures.

- [ ] **Step 6: Commit Relazioni apps**

```powershell
git add 'apps/web/app/(dashboard)/clients' 'apps/web/app/(dashboard)/staff' 'apps/web/app/(dashboard)/services' 'apps/web/app/(dashboard)/vouchers' apps/web/critical-crud-routes.test.ts apps/web/remaining-crud-routes.test.ts
git commit -m "feat: unify relationship app workspaces"
```

### Task 7: Crescita and Controllo apps

**Files:**
- Modify: `apps/web/app/(dashboard)/marketing/`
- Modify: `apps/web/app/(dashboard)/reviews/page.tsx`
- Modify: `apps/web/app/(dashboard)/waitlist/page.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/`
- Modify: `apps/web/app/(dashboard)/accounting/page.tsx`
- Modify: `apps/web/app/(dashboard)/reports/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/loyalty/`
- Modify: `apps/web/app/(dashboard)/settings/documents/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/packages/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/audit/page.tsx`
- Modify: `apps/web/remaining-crud-routes.test.ts`

**Interfaces:**
- Consumes: shared list/detail/form patterns and module feature flags.
- Produces: coherent Crescita and Controllo workspaces with app-specific KPI and actions.

- [ ] **Step 1: Extend route contracts for every module app**

Assert each route uses shared page structure, retains its creation/detail links and exposes its principal operation.

- [ ] **Step 2: Run module route contracts and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- remaining-crud-routes.test.ts ui-polish-regression.test.ts`

Expected: new module-layout assertions fail.

- [ ] **Step 3: Migrate Crescita apps**

Apply app identity and standard workspaces to Marketing, Fedeltà, Recensioni and Lista d'attesa, retaining campaign, reward, review and waitlist behavior.

- [ ] **Step 4: Migrate Controllo apps**

Apply standard workspaces to Inventario, Contabilità, Report, Consensi, Pacchetti and Attività, retaining stock movements, report filters and audit operations.

- [ ] **Step 5: Verify module apps**

Run: `corepack pnpm --filter @esse-beauty/web test -- remaining-crud-routes.test.ts ui-polish-regression.test.ts encoding.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

Expected: selected tests and typecheck pass.

- [ ] **Step 6: Commit module apps**

```powershell
git add 'apps/web/app/(dashboard)/marketing' 'apps/web/app/(dashboard)/reviews' 'apps/web/app/(dashboard)/waitlist' 'apps/web/app/(dashboard)/inventory' 'apps/web/app/(dashboard)/accounting' 'apps/web/app/(dashboard)/reports' 'apps/web/app/(dashboard)/settings/loyalty' 'apps/web/app/(dashboard)/settings/documents' 'apps/web/app/(dashboard)/settings/packages' 'apps/web/app/(dashboard)/settings/audit' apps/web/remaining-crud-routes.test.ts apps/web/ui-polish-regression.test.ts
git commit -m "feat: restyle growth and control apps"
```

### Task 8: Impostazioni, responsive, accessibility and release verification

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/layout.tsx`
- Modify: `apps/web/app/(dashboard)/settings/page.tsx`
- Modify: remaining files under `apps/web/app/(dashboard)/settings/`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/ui-polish-regression.test.ts`
- Modify: `apps/web/encoding.test.ts`
- Modify: `apps/web/app-shell-contract.test.ts`

**Interfaces:**
- Consumes: complete app registry, shell and shared primitives.
- Produces: contextual settings navigation, consistent responsive behavior and verified release candidate.

- [ ] **Step 1: Add failing settings/responsive/accessibility assertions**

Require grouped settings tabs, no competing settings sidebar, 44 px interactive targets, mobile launcher/navigation selectors, reduced-motion CSS and correct accented labels.

- [ ] **Step 2: Run final contract subset and confirm RED**

Run: `corepack pnpm --filter @esse-beauty/web test -- app-shell-contract.test.ts ui-polish-regression.test.ts encoding.test.ts`

Expected: new settings or responsive assertions fail.

- [ ] **Step 3: Migrate all Settings pages**

Group routes under Salone, Team e accessi, Operatività, Comunicazioni and Moduli. Keep every existing page and pending-request badge reachable through contextual navigation.

- [ ] **Step 4: Complete responsive and accessibility styling**

Verify rail/table/form behavior at target breakpoints, add structured mobile list styles, focus states, `aria-current`, escape handling and `prefers-reduced-motion` overrides.

- [ ] **Step 5: Run full automated verification**

Run:

```powershell
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

Expected: all repository tests, typechecks and builds exit 0.

- [ ] **Step 6: Run visual verification**

Start the development stack, inspect `/`, `/calendar`, `/sales`, `/clients`, `/inventory`, `/marketing`, `/reports` and `/settings` at 1440×900 and 390×844, and record any layout defects in the same task before completion.

- [ ] **Step 7: Commit release polish**

```powershell
git add 'apps/web/app/(dashboard)/settings' apps/web/app/globals.css apps/web/app-shell-contract.test.ts apps/web/ui-polish-regression.test.ts apps/web/encoding.test.ts
git commit -m "feat: complete app-oriented dashboard restyling"
```

- [ ] **Step 8: Review final branch delta**

Run: `git diff --check origin/main...HEAD; git status --short --branch; git log --oneline origin/main..HEAD`

Expected: no whitespace errors, clean worktree and a sequence of focused reversible commits.
