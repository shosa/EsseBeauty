# WhatsApp Communications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace operational SMS with official WhatsApp Cloud API delivery and provide a persistent topbar chat workspace.

**Architecture:** Tenant-scoped encrypted provider accounts feed a durable message/outbox pipeline. Signed Meta webhooks update conversations and delivery state; REST plus authenticated SSE powers a dashboard-level chat drawer.

**Tech Stack:** TypeScript, Fastify, Drizzle/PostgreSQL, BullMQ/Redis, Next.js/React, Vitest, Meta Graph API.

**Spec:** `docs/superpowers/specs/2026-08-24-whatsapp-communications-design.md`

## Global Constraints

- Use only the official Meta WhatsApp Business Cloud API; never iframe, scrape or automate WhatsApp Web.
- Migration number is `0030` after Task 9 migration `0029` is committed.
- Password recovery remains email-only and its injected test seam must stay intact.
- Secrets and raw signed payloads must never appear in API responses, logs or audit diffs.
- New marketing delivery requires explicit WhatsApp marketing consent and an approved marketing template.
- Historical SMS records remain readable during rollout; no destructive rewrite.

---

### Task 1: Provider accounts, encryption, permissions and consent

**Files:**
- Create: `packages/db/migrations/0030_whatsapp_communications.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Modify: `packages/db/schema.ts`
- Modify: `packages/shared/permissions.ts`
- Create: `apps/api/src/lib/provider-credentials.ts`
- Create: `apps/api/src/lib/provider-credentials.test.ts`
- Create: `apps/api/src/routes/communications/settings.ts`
- Create: `apps/api/src/routes/communications/settings.test.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/web/app/(dashboard)/settings/communications/page.tsx`

**Interfaces:**
- Produces `encryptProviderSecret(secret, context): EncryptedSecret` and `decryptProviderSecret(row, context): string` using AES-256-GCM with salon/account/provider AAD.
- Produces masked provider settings routes under `/api/salons/:id/communications/provider` and permissions `communications.view`, `communications.reply`, `communications.manage_provider`.

- [ ] **Step 1: Write failing crypto, tenant, redaction and permission tests**

```ts
expect(decryptProviderSecret(encryptProviderSecret("token", ctx), ctx)).toBe("token");
expect(() => decryptProviderSecret(row, { ...ctx, salonId: otherSalon })).toThrow();
expect(JSON.stringify(await getProviderSettings())).not.toContain("token");
expect((await updateProviderAsReceptionist()).statusCode).toBe(403);
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/provider-credentials.test.ts src/routes/communications/settings.test.ts`

- [ ] **Step 3: Add migration/schema, encryption and settings UI**

Create account/secret/consent/conversation/message/outbox/webhook/user-state tables with salon foreign keys, unique provider identifiers, idempotency indexes and non-negative attempt checks. Settings writes encrypt the token and return only credential presence, masked number, readiness and safe errors.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/lib/provider-credentials.test.ts src/routes/communications/settings.test.ts && corepack pnpm --filter @esse-beauty/api typecheck && corepack pnpm --filter @esse-beauty/web typecheck`

Commit: `feat: add secure WhatsApp provider accounts`

### Task 2: Cloud provider, signed webhook and durable outbox

**Files:**
- Modify: `apps/api/src/providers/communications.ts`
- Create: `apps/api/src/providers/whatsapp-cloud-provider.ts`
- Create: `apps/api/src/providers/whatsapp-cloud-provider.test.ts`
- Create: `apps/api/src/routes/webhooks/whatsapp.ts`
- Create: `apps/api/src/routes/webhooks/whatsapp.test.ts`
- Create: `apps/api/src/jobs/communications.ts`
- Create: `apps/api/src/jobs/communications.test.ts`
- Modify: `apps/api/src/jobs/queues.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces `sendWhatsApp({ salonId, kind, template, session, idempotencyKey }): Promise<DeliveryReceipt>`.
- Produces `GET|POST /api/webhooks/whatsapp/:webhookKey`; POST verifies the raw-body HMAC before persistence.
- Produces `enqueueCommunication()` which transactionally creates message and outbox rows before BullMQ wake-up.

- [ ] **Step 1: Write failing provider, signature, dedupe and recovery tests**

```ts
expect((await unsignedWebhook()).statusCode).toBe(401);
expect(await deliverTwiceWithSameKey()).toMatchObject({ providerCalls: 1 });
expect(await recoverExpiredLease()).toMatchObject({ status: "accepted" });
expect(await sendOutsideWindowWithoutTemplate()).toMatchObject({ code: "TEMPLATE_REQUIRED" });
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/providers/whatsapp-cloud-provider.test.ts src/routes/webhooks/whatsapp.test.ts src/jobs/communications.test.ts`

- [ ] **Step 3: Implement Graph adapter, webhook processing and outbox worker**

Normalize Meta errors without response bodies, map template/session payloads, persist provider IDs and monotonic lifecycle states, acknowledge verified webhooks quickly, deduplicate events and recover expired outbox leases with a bounded attempt ceiling.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/providers src/routes/webhooks src/jobs/communications.test.ts && corepack pnpm --filter @esse-beauty/api build`

Commit: `feat: deliver durable WhatsApp communications`

### Task 3: Conversation API, realtime stream and global chat drawer

**Files:**
- Create: `apps/api/src/routes/communications/index.ts`
- Create: `apps/api/src/routes/communications/index.test.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/web/app/(dashboard)/_components/CommunicationWorkspaceProvider.tsx`
- Create: `apps/web/app/(dashboard)/_components/WhatsAppChatDrawer.tsx`
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/app/(dashboard)/_components/WorkspaceTopbar.tsx`
- Modify: `apps/web/app/(dashboard)/_components/Icons.tsx`
- Create: `apps/web/whatsapp-chat.test.ts`

**Interfaces:**
- Produces list/thread/send/read/user-state endpoints and authenticated `/events` SSE scoped by salon/user permission.
- Produces `CommunicationWorkspaceProvider` with persistent selected conversation, draft and unread state.

- [ ] **Step 1: Write failing tenant, permission, stable-state and drawer tests**

```ts
expect((await readOtherSalonThread()).statusCode).toBe(404);
expect((await sendWithoutReplyPermission()).statusCode).toBe(403);
expect(renderShell()).toContain("WhatsAppChatDrawer");
expect(restoreWorkspaceState()).toMatchObject({ selectedConversationId, draft });
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/communications/index.test.ts && corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-chat.test.ts`

- [ ] **Step 3: Implement paginated chat, SSE reconnect and accessible offcanvas**

Mount the provider/drawer in the dashboard shell, add a topbar unread badge, focus trap and mobile layout, persist read cursors/drafts server-side, reconnect SSE with polling fallback, require templates outside the service window and label the external WhatsApp Web link as non-authoritative.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/communications && corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-chat.test.ts && corepack pnpm --filter @esse-beauty/web build`

Commit: `feat: add persistent WhatsApp chat workspace`

### Task 4: Replace active SMS product flows

**Files:**
- Modify: `apps/api/src/jobs/notifications.ts`
- Modify: `apps/api/src/jobs/reminders.ts`
- Modify: `apps/api/src/jobs/reviews.ts`
- Modify: `apps/api/src/jobs/appointment-events.ts`
- Modify: `apps/api/src/jobs/marketing.ts`
- Modify: `apps/api/src/routes/marketing/index.ts`
- Modify: `apps/api/src/routes/reminders/index.ts`
- Modify: `apps/web/app/(dashboard)/settings/reminders/page.tsx`
- Modify: `apps/web/app/(dashboard)/marketing/new/page.tsx`
- Modify: `apps/web/app/(dashboard)/marketing/[campaignId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/marketing/templates/page.tsx`

**Interfaces:**
- Consumes Task 2 durable send contract and Task 1 communication consent.
- New reminders, reviews, waitlist notices and campaigns create WhatsApp template messages; historical SMS remains read-only.

- [ ] **Step 1: Write failing flow tests**

```ts
expect(await campaignPreview(noWhatsappConsent)).toMatchObject({ included: 0 });
expect(await completeAppointment()).toMatchObject({ reviewChannel: "whatsapp" });
expect(await sendReminder()).toMatchObject({ kind: "template", channel: "whatsapp" });
expect(JSON.stringify(renderMarketing())).not.toContain("SMS");
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/reviews* src/jobs/reminders* src/jobs/marketing* src/routes/marketing && corepack pnpm --filter @esse-beauty/web exec vitest run marketing-flow.test.ts`

- [ ] **Step 3: Migrate behavior and copy truthfully**

Require ready provider plus applicable opt-in/template, preserve retry/idempotency/source links, remove 160-character SMS assumptions, show excluded recipients and provider-not-configured errors, and leave password reset email-only.

- [ ] **Step 4: Run GREEN and commit**

Run: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs src/routes/marketing src/routes/reminders && corepack pnpm --filter @esse-beauty/web exec vitest run marketing-flow.test.ts && corepack pnpm --filter @esse-beauty/api typecheck && corepack pnpm --filter @esse-beauty/web typecheck`

Commit: `feat: replace SMS workflows with WhatsApp`

### Task 5: Rollout cleanup, configuration and regression verification

**Files:**
- Modify: `.env.example`
- Modify: `compose.yaml`
- Modify: `DOCKER.md`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `apps/api/src/providers/twilio-provider.ts`
- Create: `apps/api/src/routes/communications/operational.test.ts`

**Interfaces:**
- Produces documented Meta app/encryption/public-origin deployment contract and removes Twilio only after no active code path imports it.

- [ ] **Step 1: Add failing configuration and source-scan tests**

```ts
expect(validateWhatsAppRuntime(completeEnv)).toEqual({ ready: true });
expect(scanProductionSources()).not.toMatch(/Twilio|sendSms|channel:\s*["']sms/);
```

- [ ] **Step 2: Remove Twilio, document onboarding and verify configuration**

Document secret generation, HTTPS webhook setup, Meta subscription/test-message round trip, number ownership/coexistence preflight and rollback. Remove dependency/env/provider only after the production source scan is clean.

- [ ] **Step 3: Run essential regression suite and commit**

Run: `corepack pnpm --filter @esse-beauty/api test && corepack pnpm --filter @esse-beauty/web test && corepack pnpm --filter @esse-beauty/api build && corepack pnpm --filter @esse-beauty/web build && corepack pnpm typecheck`

Commit: `chore: complete WhatsApp communications rollout`

