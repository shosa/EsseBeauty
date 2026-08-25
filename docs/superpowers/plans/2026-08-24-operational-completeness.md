# Operational Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every exposed EsseBeauty workflow durable, permission-safe and behaviorally tested, including documents, reviews, communications and the schema-only product capabilities.

**Architecture:** Deliver vertical slices from database through API, workers and UI. Shared runtime schemas, provider adapters, secure public tokens and status aggregation form the foundation; domain routes consume those contracts without duplicating validation or external-service code.

**Tech Stack:** TypeScript 5.9, Fastify 5, Drizzle/PostgreSQL, BullMQ/Redis, Next.js 15 App Router, React 19, Vitest, Playwright-compatible browser tests, Resend and Twilio adapters.

**Spec:** `docs/superpowers/specs/2026-08-24-operational-completeness-design.md`

## Global Constraints

- Preserve existing public dashboard routes and stored records.
- Every new migration is forward-only and retains user data.
- Every mutation receives runtime validation and stable application error codes.
- Every query and mutation is scoped by salon and applicable user/role.
- Provider-dependent operations fail with `PROVIDER_NOT_CONFIGURED` when credentials are absent.
- CI and local automated tests never send live email or SMS.
- Italian user-facing text must be valid UTF-8 with correct accents.
- Each task follows red-green-refactor and ends in a focused commit.
- `main` remains untouched; work stays on `codex/app-oriented-ui-implementation`.

---

### Task 1: Runtime validation, secure tokens and internal route integrity

**Files:**
- Create: `apps/api/src/lib/http-validation.ts`
- Create: `apps/api/src/lib/public-tokens.ts`
- Create: `apps/api/src/lib/http-validation.test.ts`
- Create: `apps/api/src/lib/public-tokens.test.ts`
- Create: `apps/web/internal-route-integrity.test.ts`
- Modify: `apps/api/src/routes/auth/index.ts`
- Modify: `apps/api/src/routes/shell/index.ts`
- Modify: `apps/web/app/(dashboard)/page.tsx`
- Modify: `apps/web/encoding.test.ts`

**Interfaces:**
- Produces `parseBody<T>(schema, request, reply): T | undefined`, `issuePublicToken(purpose, entityId, expiresAt)` and `verifyPublicToken(raw, purpose)`.
- Produces a route-integrity test that fails whenever an API-generated internal href lacks a Next page or documented redirect.

- [ ] **Step 1: Write failing validation, token and route tests**

```ts
it("rejects a missing login email as INVALID_REQUEST", async () => {
  const response = await app.inject({ method: "POST", url: "/api/auth/login", payload: { password: "stefanosolidoro" } });
  expect(response.statusCode).toBe(400);
  expect(response.json().error).toBe("INVALID_REQUEST");
});

it("rejects expired and wrong-purpose public tokens", () => {
  const token = issuePublicToken("review", "entity-id", new Date(Date.now() - 1));
  expect(verifyPublicToken(token.raw, "consent")).toEqual({ ok: false, error: "TOKEN_INVALID" });
});

expect(internalHrefs).not.toContain("/services/:id");
expect(internalHrefs).not.toContain("/staff/:id");
```

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/http-validation.test.ts src/lib/public-tokens.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run internal-route-integrity.test.ts encoding.test.ts`

Expected: missing modules, malformed login returns 500, broken search href assertions fail, and the encoding scan finds `Ã`/`Â`.

- [ ] **Step 3: Implement the shared contracts and immediate correctness fixes**

Use explicit schema objects with `safeParse` semantics and return `{ error: "INVALID_REQUEST", fields }`. Hash public tokens with SHA-256 before persistence. Change search hrefs to `/settings/services/${id}` and `/settings/staff/${id}`. Render notifications lacking `href` as `InboxItem`, not `Link`. Expand encoding scanning to every `.tsx`, `.ts`, `.md` user-facing source under `apps/`.

- [ ] **Step 4: Verify GREEN and existing auth/shell suites**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/http-validation.test.ts src/lib/public-tokens.test.ts src/routes/auth src/routes/shell && corepack pnpm --filter @esse-beauty/web exec vitest run internal-route-integrity.test.ts encoding.test.ts home-workspace-contract.test.ts`

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/lib apps/api/src/routes/auth apps/api/src/routes/shell apps/web/internal-route-integrity.test.ts apps/web/encoding.test.ts 'apps/web/app/(dashboard)/page.tsx'
git commit -m "fix: establish validated secure application contracts"
```

### Task 2: Tenant-safe notifications and permission-aware app navigation

**Files:**
- Modify: `apps/api/src/routes/shell/index.ts`
- Modify: `apps/api/src/routes/shell/index.test.ts`
- Modify: `apps/web/lib/auth-context.tsx`
- Modify: `apps/web/app/(dashboard)/_components/app-registry.ts`
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/app-registry.test.ts`

**Interfaces:**
- Extends `AppDefinition` with `permissions?: readonly PermissionKey[]`.
- Produces `visibleApps(enabledModules, grantedPermissions)` and a shared `visibleNotification(request, notification)` SQL predicate.

- [ ] **Step 1: Write failing permission and mutation-isolation tests**

```ts
expect(visibleApps(modules, new Set([PERMISSION_KEYS.CLIENTS_VIEW])).map((app) => app.key)).not.toContain("sales");

it("cannot archive another user's notification", async () => {
  const response = await employee.inject({ method: "DELETE", url: `/api/salons/${salonId}/notifications/${ownerNotificationId}` });
  expect(response.statusCode).toBe(404);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/shell/index.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run app-registry.test.ts`

- [ ] **Step 3: Implement permission-aware registry and notification predicates**

Expose resolved permission keys from `/api/auth/me`, store them in auth context, define app requirements and apply the same user/role predicate to list/read/archive notification operations.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/shell src/middleware/auth.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run app-registry.test.ts app-shell-contract.test.ts`

```powershell
git add apps/api/src/routes/shell apps/web/lib/auth-context.tsx 'apps/web/app/(dashboard)/_components'
git commit -m "fix: enforce permissions across apps and notifications"
```

### Task 3: Complete consent template and assignment model

**Files:**
- Create: `packages/db/migrations/0019_operational_documents.sql`
- Create: `apps/api/src/lib/consent-evidence.ts`
- Create: `apps/api/src/lib/consent-evidence.test.ts`
- Modify: `packages/db/schema.ts`
- Modify: `apps/api/src/routes/enterprise/index.ts`
- Create: `apps/api/src/routes/enterprise/documents.test.ts`

**Interfaces:**
- Adds immutable template versions and consent request fields: `tokenHash`, `expiresAt`, `documentHash`, `signerName`, `revokedAt`, `revokedByUserId`, `revocationReason`, `deliveryChannel`.
- Produces `createConsentRequest`, `signConsent`, `revokeConsent` and `renderConsentEvidence` service functions.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("creates a new version instead of editing a signed template", async () => {
  const next = await versionTemplate(db, usedTemplate.id, { body: "Nuovo testo" });
  expect(next.version).toBe(usedTemplate.version + 1);
  expect(await storedBody(usedTemplate.id)).toBe("Testo firmato originale");
});

it("signs once and persists the exact document hash", async () => {
  const signed = await signConsent(db, token, { signerName: "Mario Rossi", accepted: true, signature: { type: "typed", value: "Mario Rossi" } });
  expect(signed.documentHash).toMatch(/^[a-f0-9]{64}$/);
  await expect(signConsent(db, token, input)).rejects.toThrow("TOKEN_CONSUMED");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/consent-evidence.test.ts src/routes/enterprise/documents.test.ts`

- [ ] **Step 3: Add migration, services and validated APIs**

Implement template create/version/archive, request create/re-send, public token resolve/sign, operator in-person sign, revoke and evidence export endpoints. Verify customer, appointment, template and service all belong to `request.salonId` inside the same transaction.

- [ ] **Step 4: Apply migration and verify GREEN**

Run: `corepack pnpm --filter @esse-beauty/db db:migrate && corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/consent-evidence.test.ts src/routes/enterprise/documents.test.ts`

- [ ] **Step 5: Commit**

```powershell
git add packages/db apps/api/src/lib/consent-evidence* apps/api/src/routes/enterprise
git commit -m "feat: implement durable consent lifecycle"
```

### Task 4: Documents dashboard, customer records and public signing

**Files:**
- Rewrite: `apps/web/app/(dashboard)/settings/documents/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/documents/[templateId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/clients/[customerId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/calendar/_components/AppointmentDetailPanel.tsx`
- Create: `apps/pwa/app/consents/[token]/page.tsx`
- Create: `apps/web/documents-flow.test.ts`
- Create: `apps/pwa/consent-signing.test.ts`

**Interfaces:**
- Consumes Task 3 document APIs.
- Produces template archive/version UI, request/send/sign/revoke operations, and evidence links from customer and appointment pages.

- [ ] **Step 1: Write failing UI behavior contracts**

```ts
expect(documentsSource).toContain("Crea nuova versione");
expect(customerSource).toContain("Consensi del cliente");
expect(appointmentSource).toContain("Richiedi consenso");
expect(publicSource).toContain("Accetto il documento");
expect(publicSource).not.toMatch(/[ÃÂ�]/);
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run documents-flow.test.ts && corepack pnpm --filter @esse-beauty/pwa exec vitest run consent-signing.test.ts`

- [ ] **Step 3: Implement complete UI with honest errors**

Keep mutation dialogs open on failure, show pending/signed/expired/revoked states, require a revocation reason, and print the evidence record from server data. Do not place signature payloads in query strings or client logs.

- [ ] **Step 4: Verify GREEN, typecheck and commit**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run documents-flow.test.ts critical-crud-routes.test.ts && corepack pnpm --filter @esse-beauty/pwa exec vitest run consent-signing.test.ts && corepack pnpm --filter @esse-beauty/web typecheck && corepack pnpm --filter @esse-beauty/pwa typecheck`

```powershell
git add apps/web apps/pwa
git commit -m "feat: complete document signing experience"
```

### Task 5: Secure review invitations and review management

**Files:**
- Create: `packages/db/migrations/0020_secure_review_invitations.sql`
- Modify: `packages/db/schema.ts`
- Modify: `apps/api/src/jobs/reviews.ts`
- Modify: `apps/api/src/jobs/appointment-events.ts`
- Modify: `apps/api/src/routes/reviews/index.ts`
- Create: `apps/api/src/routes/reviews/review-flow.test.ts`
- Rewrite: `apps/pwa/app/review/[appointmentId]/page.tsx` as `apps/pwa/app/review/[token]/page.tsx`
- Modify: `apps/web/app/(dashboard)/reviews/page.tsx`
- Create: `apps/web/reviews-flow.test.ts`

**Interfaces:**
- Adds `reviewInvitations` with hashed token, appointment, channel, expiry, consumed time, delivery status and attempts.
- Public API becomes `GET/POST /api/public/reviews/token/:token`; appointment UUID is never sufficient.

- [ ] **Step 1: Write failing security and idempotency tests**

```ts
it("does not expose a review by appointment UUID", async () => {
  expect((await app.inject({ url: `/api/public/reviews/${appointmentId}` })).statusCode).toBe(404);
});

it("creates one invitation for repeated completion events", async () => {
  await publishCompletedTwice(appointmentId);
  expect(await invitationCount(appointmentId)).toBe(1);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/reviews/review-flow.test.ts src/jobs/appointment-events.test.ts`

- [ ] **Step 3: Implement invitation/token lifecycle and dashboard error states**

Create invitation transactionally, send its raw token only through the provider adapter, consume it once on submission, return minimal public context, and require permissions for reply/publication. Dashboard mutations check response status before closing.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/reviews src/jobs/reviews* src/jobs/appointment-events.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run reviews-flow.test.ts && corepack pnpm --filter @esse-beauty/pwa typecheck`

```powershell
git add packages/db apps/api/src/jobs apps/api/src/routes/reviews apps/web apps/pwa
git commit -m "feat: secure and complete review workflows"
```

### Task 6: Provider adapters and truthful campaign state

**Files:**
- Create: `apps/api/src/providers/communications.ts`
- Create: `apps/api/src/providers/resend-provider.ts`
- Create: `apps/api/src/providers/twilio-provider.ts`
- Create: `apps/api/src/providers/communications.test.ts`
- Create: `packages/db/migrations/0021_campaign_delivery_state.sql`
- Modify: `packages/db/schema.ts`
- Modify: `apps/api/src/jobs/notifications.ts`
- Modify: `apps/api/src/jobs/marketing.ts`
- Modify: `apps/api/src/routes/marketing/index.ts`
- Create: `apps/api/src/routes/marketing/campaign-lifecycle.test.ts`

**Interfaces:**
- Produces `CommunicationProvider.send(message): Promise<DeliveryReceipt>` and injected provider registry.
- Produces `aggregateCampaignStatus(recipients): CampaignStatus` and routes for readiness, test send, schedule, cancel and retry failures.

- [ ] **Step 1: Write failing provider and aggregation tests**

```ts
expect(providerStatus(emptyEnv)).toEqual({ email: "not_configured", sms: "not_configured" });
expect(aggregateCampaignStatus([{ status: "sent" }, { status: "failed" }])).toBe("partial");
expect(aggregateCampaignStatus([{ status: "queued" }])).toBe("queued");
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/providers/communications.test.ts src/routes/marketing/campaign-lifecycle.test.ts`

- [ ] **Step 3: Implement adapters, durable statuses and retry/cancel**

Move Resend/Twilio construction behind adapters, retain provider message IDs, set a campaign to queued/scheduled before work, aggregate after each batch, retry only failed recipients and refuse cancellation once processing begins.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/providers src/routes/marketing src/jobs/marketing*`

```powershell
git add packages/db apps/api/src/providers apps/api/src/jobs apps/api/src/routes/marketing
git commit -m "feat: deliver communications with truthful status"
```

### Task 7: Campaign authoring, templates and monitoring UI

**Files:**
- Modify: `apps/web/app/(dashboard)/marketing/page.tsx`
- Modify: `apps/web/app/(dashboard)/marketing/new/page.tsx`
- Modify: `apps/web/app/(dashboard)/marketing/[campaignId]/page.tsx`
- Create: `apps/web/app/(dashboard)/marketing/templates/page.tsx`
- Create: `apps/web/marketing-flow.test.ts`
- Modify: `apps/api/src/routes/marketing/index.ts`
- Modify: `packages/db/schema.ts`

**Interfaces:**
- Consumes Task 6 readiness, preview, test-send, schedule, cancel and retry APIs.
- Activates existing `campaignTemplates` storage with CRUD/archive/apply semantics.

- [ ] **Step 1: Write failing campaign behavior tests**

```ts
expect(newCampaign).toContain("Anteprima destinatari");
expect(detail).toContain("Riprova falliti");
expect(detail).toContain("Annulla pianificazione");
expect(detail).toContain("Provider non configurato");
expect(templates).toContain("Nuovo modello");
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run marketing-flow.test.ts`

- [ ] **Step 3: Implement preview, confirmation, templates and monitoring**

Require a recipient preview before the send confirmation, separate test delivery from campaign delivery, show excluded destinations and poll only while queued/processing. Applying a template copies its content into the campaign draft.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run marketing-flow.test.ts remaining-crud-routes.test.ts && corepack pnpm --filter @esse-beauty/web typecheck`

```powershell
git add apps/web/app/'(dashboard)'/marketing apps/web/marketing-flow.test.ts apps/api/src/routes/marketing packages/db/schema.ts
git commit -m "feat: complete campaign authoring and monitoring"
```

### Task 8: Password recovery and login activity

**Files:**
- Modify: `apps/api/src/routes/auth/index.ts`
- Create: `apps/api/src/routes/auth/password-recovery.test.ts`
- Create: `apps/web/app/forgot-password/page.tsx`
- Create: `apps/web/app/reset-password/[token]/page.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Create: `apps/web/password-recovery.test.ts`

**Interfaces:**
- Activates existing `passwordResetTokens` and `loginActivity` tables.
- Adds `POST /api/auth/password-reset/request` and `POST /api/auth/password-reset/complete` with enumeration-safe responses.

- [ ] **Step 1: Write failing token/session tests**

```ts
expect(await requestReset("existing@example.it")).toEqual(await requestReset("missing@example.it"));
await completeReset(token, "nuova-password-sicura");
expect(await activeSessionCount(userId)).toBe(0);
expect(await reuseToken(token)).toMatchObject({ statusCode: 410 });
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/auth/password-recovery.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run password-recovery.test.ts`

- [ ] **Step 3: Implement recovery, activity recording and UI**

Hash reset tokens, expire after 30 minutes, revoke sessions on completion, record successful/failed login metadata, and return the same request response for known and unknown emails.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/auth && corepack pnpm --filter @esse-beauty/web exec vitest run password-recovery.test.ts middleware.test.ts`

```powershell
git add apps/api/src/routes/auth apps/web/app/login apps/web/app/forgot-password apps/web/app/reset-password apps/web/password-recovery.test.ts
git commit -m "feat: add secure password recovery"
```

### Task 9: Saved views and loyalty tiers

**Files:**
- Create: `apps/api/src/routes/saved-views/index.ts`
- Create: `apps/api/src/routes/saved-views/index.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/loyalty/index.ts`
- Create: `apps/api/src/routes/loyalty/tiers.test.ts`
- Modify: `apps/web/app/(dashboard)/calendar/page.tsx`
- Modify: `apps/web/app/(dashboard)/clients/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/loyalty/page.tsx`
- Create: `apps/web/saved-views-loyalty.test.ts`

**Interfaces:**
- Activates `savedViews` with owner-only CRUD by `userId + salonId + surface`.
- Activates `loyaltyTiers` with ordered thresholds and includes `current_tier`/`next_tier` in loyalty summaries.

- [ ] **Step 1: Write failing ownership and threshold tests**

```ts
expect((await deleteOtherUsersView()).statusCode).toBe(404);
expect((await createTiers([100, 100])).statusCode).toBe(400);
expect(resolveTier(250, [{ threshold: 100 }, { threshold: 200 }]).threshold).toBe(200);
```

- [ ] **Step 2: Run RED, implement APIs/UI, run GREEN**

Run RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/saved-views src/routes/loyalty/tiers.test.ts`

Implement per-user calendar/client filter persistence and tier CRUD/summary without changing point history.

Run GREEN: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/saved-views src/routes/loyalty && corepack pnpm --filter @esse-beauty/web exec vitest run saved-views-loyalty.test.ts`

- [ ] **Step 3: Commit**

```powershell
git add apps/api/src/routes/saved-views apps/api/src/routes/loyalty apps/api/src/app.ts apps/web
git commit -m "feat: activate saved views and loyalty tiers"
```

### Task 10: Inventory reorder lifecycle

**Files:**
- Modify: `apps/api/src/routes/inventory/index.ts`
- Create: `apps/api/src/routes/inventory/reorders.test.ts`
- Modify: `apps/web/app/(dashboard)/inventory/page.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/[productId]/page.tsx`
- Create: `apps/web/inventory-reorders.test.ts`

**Interfaces:**
- Activates `inventoryReorderRequests` with `draft`, `ordered`, `received`, `cancelled` transitions.
- Receiving atomically creates one `inventoryMovement` and rejects replay.

- [ ] **Step 1: Write failing transition and idempotency tests**

```ts
expect(await transition("draft", "received")).toMatchObject({ statusCode: 409 });
await receive(reorderId);
expect((await receive(reorderId)).statusCode).toBe(409);
expect(await movementCount(reorderId)).toBe(1);
```

- [ ] **Step 2: Run RED, implement and run GREEN**

Run RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/inventory/reorders.test.ts`

Implement tenant-scoped endpoints and product/reorder UI with quantity, supplier note and explicit transitions.

Run GREEN: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/inventory && corepack pnpm --filter @esse-beauty/web exec vitest run inventory-reorders.test.ts`

- [ ] **Step 3: Commit**

```powershell
git add apps/api/src/routes/inventory apps/web/app/'(dashboard)'/inventory apps/web/inventory-reorders.test.ts
git commit -m "feat: implement inventory reorder operations"
```

### Task 11: Integration, data exchange and notification settings

**Files:**
- Modify: `apps/api/src/routes/settings/index.ts`
- Create: `apps/api/src/routes/settings/operational-settings.test.ts`
- Create: `apps/web/app/(dashboard)/settings/integrations/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/data-exchange/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/notifications/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/layout.tsx`
- Create: `apps/web/operational-settings.test.ts`

**Interfaces:**
- Completes existing integration/data-exchange/notification preference APIs.
- Secrets are write-only and API responses expose `configured: boolean`, never secret values.
- Import contract is preview token followed by explicit commit; export is tenant-scoped and audited.

- [ ] **Step 1: Write failing secret, preview and preference tests**

```ts
expect(JSON.stringify(await getIntegration())).not.toContain("secret-value");
expect((await commitImportWithoutPreview()).statusCode).toBe(409);
expect(await quietHoursSuppress(messageAt("23:30"))).toBe(true);
```

- [ ] **Step 2: Run RED, implement and run GREEN**

Run RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/settings/operational-settings.test.ts`

Implement safe metadata responses, CSV preview/commit, scoped exports and worker enforcement of category/channel/role/quiet hours. Add grouped settings tabs and explicit provider readiness.

Run GREEN: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/settings src/jobs && corepack pnpm --filter @esse-beauty/web exec vitest run operational-settings.test.ts`

- [ ] **Step 3: Commit**

```powershell
git add apps/api/src/routes/settings apps/api/src/jobs apps/web/app/'(dashboard)'/settings apps/web/operational-settings.test.ts
git commit -m "feat: complete operational settings surfaces"
```

### Task 12: Shell cleanup, accessibility and dependency hardening

**Files:**
- Create: `apps/web/app/(dashboard)/_components/CommandPalette.tsx`
- Create: `apps/web/app/(dashboard)/_components/NotificationCenter.tsx`
- Modify: `apps/web/app/(dashboard)/_components/AppLauncher.tsx`
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/app-shell-contract.test.ts`
- Modify: all workspace `package.json` files and `pnpm-lock.yaml`

**Interfaces:**
- Removes `UnifiedSideNavigation`, `navigationCollapsed`, `moreOpen`, `sectionLinks` and unused shell preference requests.
- Focused overlays trap/restore focus and close via Escape.
- Runtime dependencies resolve to patched compatible versions.

- [ ] **Step 1: Write failing shell cleanup/accessibility tests**

```ts
expect(shell).not.toContain("UnifiedSideNavigation");
expect(shell).not.toContain("navigationCollapsed");
expect(launcher).toContain("useFocusTrap");
expect(commandPalette).toContain('aria-modal="true"');
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run app-shell-contract.test.ts`

- [ ] **Step 3: Extract overlays, delete dead shell code and update dependencies**

Upgrade Next to at least `15.5.21`, Drizzle ORM to at least `0.45.2`, `fast-uri` to a patched resolution, Sharp to at least `0.35.0` where compatible and PostCSS to at least `8.5.23`. Replace `next-pwa` if its production tree cannot be made free of high-severity advisories without unsupported overrides.

- [ ] **Step 4: Verify shell and production audit**

Run: `corepack pnpm --filter @esse-beauty/web exec vitest run app-shell-contract.test.ts ui-polish-regression.test.ts && corepack pnpm audit --prod`

Expected: shell tests pass and no runtime-reachable direct dependency has a high-severity advisory.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/app/'(dashboard)'/_components apps/web/app-shell-contract.test.ts package.json apps packages pnpm-lock.yaml
git commit -m "chore: harden dependencies and simplify app shell"
```

### Task 13: End-to-end release verification

**Files:**
- Create: `apps/e2e/package.json`
- Create: `apps/e2e/playwright.config.ts`
- Create: `apps/e2e/tests/owner-critical-flows.spec.ts`
- Create: `apps/e2e/tests/employee-permissions.spec.ts`
- Create: `apps/e2e/tests/public-consent-review.spec.ts`
- Create: `apps/e2e/tests/communications.spec.ts`
- Modify: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`

**Interfaces:**
- Produces deterministic PostgreSQL/Redis-backed browser verification with fake communication providers.
- Covers owner and restricted employee sessions, public tokens, queue completion and mobile navigation.

- [ ] **Step 1: Add a failing smoke flow**

```ts
test("owner completes document, review and campaign workflows", async ({ page }) => {
  await loginAsOwner(page);
  await createAndSignConsent(page);
  await completeAppointmentAndSubmitReview(page);
  await sendCampaignWithFakeProvider(page);
  await expect(page.getByText("Completata")).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `corepack pnpm --filter @esse-beauty/e2e test`

Expected: package/setup helpers or unimplemented flows fail.

- [ ] **Step 3: Add deterministic fixtures and complete browser suites**

Seed unique salons per test, inject fake Resend/Twilio adapters, drain BullMQ jobs, and verify desktop 1440×900 plus mobile 390×844. Employee tests assert prohibited apps are absent and direct API calls return 403.

- [ ] **Step 4: Run full verification**

```powershell
corepack pnpm -r --if-present test
corepack pnpm -r --if-present typecheck
corepack pnpm -r --if-present build
corepack pnpm --filter @esse-beauty/e2e test
corepack pnpm audit --prod
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: all commands exit 0, E2E covers the four critical workflows, audit meets Task 12 policy, diff check is clean and the worktree has no uncommitted files.

- [ ] **Step 5: Commit**

```powershell
git add apps/e2e package.json pnpm-workspace.yaml turbo.json
git commit -m "test: verify complete operational workflows"
```
