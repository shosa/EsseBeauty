# Module-Aware Salon Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resumable onboarding that configures real locations, cabins, services, staff, and their assignments, with its steps and completion rules derived from active modules.

**Architecture:** Move step composition and readiness checks into pure API domain modules. Keep persistence in focused onboarding handlers that upsert entities by stable IDs and validate tenant ownership transactionally. Split the React wizard into typed state plus focused step components driven by the server manifest.

**Tech Stack:** TypeScript 5.8, Fastify 5, Drizzle ORM/PostgreSQL, Next.js 15, React 19, Tailwind CSS 4, Vitest 3, pnpm/Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-02-module-aware-salon-onboarding-design.md`

## Global Constraints

- Preserve existing data and stable IDs; never replace all services or staff to save an onboarding draft.
- Every received entity ID must be verified against the authenticated `salonId`.
- A non-Multi-sede salon may configure exactly one location; `multi_location` enables additional locations.
- Every active, online-bookable service must have at least one active staff assignment before completion.
- Cabins are optional unless explicitly assigned to a service; assigned resources must be active and belong to an active location.
- `onboardingStep` remains compatibility metadata only; readiness is the source of truth.
- Module activation after initial completion does not reopen the full onboarding.
- The UI must preserve drafts on network failure, expose text in addition to color for status, support keyboard navigation, and use interactive targets of at least 44px on mobile.
- Do not add per-location hours or multi-location staff availability in this version.

## File Map

- Create `apps/api/src/routes/onboarding/types.ts`: API/domain contracts shared by onboarding modules.
- Create `apps/api/src/routes/onboarding/definition.ts`: module-to-step registry and manifest composition.
- Create `apps/api/src/routes/onboarding/readiness.ts`: pure readiness evaluation.
- Create `apps/api/src/routes/onboarding/persistence.ts`: tenant-scoped transactional upserts for wizard collections.
- Modify `apps/api/src/routes/onboarding/index.ts`: HTTP parsing, orchestration, and response mapping only.
- Create `apps/api/src/routes/onboarding/definition.test.ts`: manifest unit tests.
- Create `apps/api/src/routes/onboarding/readiness.test.ts`: readiness unit tests.
- Create `apps/api/src/routes/onboarding/onboarding.postgres.test.ts`: persistence, tenant isolation, and completion tests.
- Create `apps/web/app/onboarding/types.ts`: browser-side payload and draft contracts.
- Create `apps/web/app/onboarding/useOnboardingWizard.ts`: loading, drafts, navigation, and save orchestration.
- Create `apps/web/app/onboarding/_components/OnboardingProgress.tsx`: responsive dynamic progress navigation.
- Create `apps/web/app/onboarding/_components/IdentityStep.tsx`: salon identity editor.
- Create `apps/web/app/onboarding/_components/LocationsStep.tsx`: primary/additional location editor.
- Create `apps/web/app/onboarding/_components/ResourcesStep.tsx`: cabin editor grouped by location.
- Create `apps/web/app/onboarding/_components/ServicesStep.tsx`: stable service/category editor.
- Create `apps/web/app/onboarding/_components/StaffStep.tsx`: staff, location, and working-hours editor.
- Create `apps/web/app/onboarding/_components/AssignmentsStep.tsx`: service/staff matrix and resource assignments.
- Create `apps/web/app/onboarding/_components/ReviewStep.tsx`: readiness report and correction links.
- Modify `apps/web/app/onboarding/page.tsx`: compose the wizard shell and step registry.
- Modify `apps/web/onboarding-ui.test.ts`: source-level regression contracts.
- Create `apps/web/onboarding-state.test.ts`: pure state/navigation tests.

---

### Task 1: Define the dynamic step manifest

**Files:**
- Create: `apps/api/src/routes/onboarding/types.ts`
- Create: `apps/api/src/routes/onboarding/definition.ts`
- Create: `apps/api/src/routes/onboarding/definition.test.ts`

**Interfaces:**
- Consumes: `ModuleKey` and `MODULE_KEYS` from `@esse-beauty/feature-flags`.
- Produces: `buildOnboardingSteps(enabledModules: ReadonlySet<string>, statuses: Readonly<Record<OnboardingStepKey, OnboardingStepStatus>>): OnboardingStep[]`.

- [ ] **Step 1: Write the failing manifest tests**

```ts
import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { buildOnboardingSteps } from "./definition.js";

describe("buildOnboardingSteps", () => {
  it("keeps one location and omits resources without multi-location", () => {
    const steps = buildOnboardingSteps(new Set(), {});
    expect(steps.map((step) => step.key)).toEqual([
      "identity", "locations", "services", "staff", "assignments", "review",
    ]);
    expect(steps.find((step) => step.key === "locations")?.mode).toBe("single");
  });

  it("adds resources and multiple-location mode for multi_location", () => {
    const steps = buildOnboardingSteps(new Set([MODULE_KEYS.MULTI_LOCATION]), {});
    expect(steps.map((step) => step.key)).toEqual([
      "identity", "locations", "resources", "services", "staff", "assignments", "review",
    ]);
    expect(steps.find((step) => step.key === "locations")?.mode).toBe("multiple");
  });

  it("does not create empty steps for modules with usable defaults", () => {
    const steps = buildOnboardingSteps(new Set([MODULE_KEYS.REMINDERS, MODULE_KEYS.INVENTORY]), {});
    expect(steps.map((step) => step.key)).not.toContain("module_setup");
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/definition.test.ts`

Expected: FAIL because `definition.ts` does not exist.

- [ ] **Step 3: Add stable contracts and registry implementation**

```ts
export type OnboardingStepKey = "identity" | "locations" | "resources" | "services" | "staff" | "assignments" | "review";
export type OnboardingStepStatus = "not_started" | "in_progress" | "complete" | "needs_attention";
export interface OnboardingIssue { code: string; entity_id?: string; message: string; step_key: OnboardingStepKey; }
export interface OnboardingStep {
  description: string;
  issues: OnboardingIssue[];
  key: OnboardingStepKey;
  label: string;
  mode?: "single" | "multiple";
  module_key?: string;
  required: boolean;
  status: OnboardingStepStatus;
}
```

Implement `definition.ts` with a fixed base registry and insert `resources` only when `MODULE_KEYS.MULTI_LOCATION` is enabled. Map supplied status values and default missing entries to `not_started`; initialize `issues` as an empty array.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/definition.test.ts`

Expected: PASS, 3 tests.

Run: `pnpm --filter @esse-beauty/api typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit the manifest unit**

```powershell
git add apps/api/src/routes/onboarding/types.ts apps/api/src/routes/onboarding/definition.ts apps/api/src/routes/onboarding/definition.test.ts
git commit -m "feat(api): define module-aware onboarding steps"
```

### Task 2: Calculate onboarding readiness from real data

**Files:**
- Create: `apps/api/src/routes/onboarding/readiness.ts`
- Create: `apps/api/src/routes/onboarding/readiness.test.ts`
- Modify: `apps/api/src/routes/onboarding/types.ts`

**Interfaces:**
- Consumes: normalized entity snapshots, `OnboardingStepKey`, and enabled module keys.
- Produces: `evaluateOnboardingReadiness(input: OnboardingReadinessInput): OnboardingReadiness` containing `ready`, `issues`, and per-step `statuses`.

- [ ] **Step 1: Write failing tests for blocking and non-blocking rules**

```ts
const valid = {
  enabledModules: new Set<string>(),
  locations: [{ active: true, id: "location-1" }],
  resources: [],
  services: [{ active: true, id: "service-1", onlineBookingEnabled: true }],
  staff: [{ active: true, id: "staff-1", locationId: "location-1" }],
  serviceStaff: [{ serviceId: "service-1", staffId: "staff-1" }],
  serviceResources: [],
};

it("accepts the minimum usable configuration", () => {
  expect(evaluateOnboardingReadiness(valid)).toMatchObject({ ready: true, issues: [] });
});

it("blocks a bookable service without active staff", () => {
  const result = evaluateOnboardingReadiness({ ...valid, serviceStaff: [] });
  expect(result.ready).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({ code: "SERVICE_WITHOUT_STAFF", entity_id: "service-1", step_key: "assignments" }));
});

it("blocks assigned resources whose location is inactive", () => {
  const result = evaluateOnboardingReadiness({
    ...valid,
    locations: [{ active: false, id: "location-1" }],
    resources: [{ active: true, id: "room-1", locationId: "location-1" }],
    serviceResources: [{ resourceId: "room-1", serviceId: "service-1" }],
  });
  expect(result.issues.map((issue) => issue.code)).toContain("RESOURCE_LOCATION_INACTIVE");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/readiness.test.ts`

Expected: FAIL because `evaluateOnboardingReadiness` is missing.

- [ ] **Step 3: Implement pure set-based validation**

Build maps of active locations, resources, services, and staff. Emit exact issues for `NO_ACTIVE_LOCATION`, `NO_ACTIVE_SERVICE`, `NO_ACTIVE_STAFF`, `STAFF_LOCATION_INVALID`, `SERVICE_WITHOUT_STAFF`, `RESOURCE_INACTIVE`, and `RESOURCE_LOCATION_INACTIVE`. Mark each affected step `needs_attention`; otherwise mark populated steps `complete` and empty optional resources `not_started`.

```ts
export function evaluateOnboardingReadiness(input: OnboardingReadinessInput): OnboardingReadiness {
  const issues: OnboardingIssue[] = [];
  // Populate maps, validate each invariant, then derive statuses.
  return { issues, ready: issues.length === 0, statuses: deriveStatuses(input, issues) };
}
```

- [ ] **Step 4: Run focused and full API unit tests**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/readiness.test.ts src/routes/onboarding/definition.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit readiness calculation**

```powershell
git add apps/api/src/routes/onboarding/types.ts apps/api/src/routes/onboarding/readiness.ts apps/api/src/routes/onboarding/readiness.test.ts
git commit -m "feat(api): calculate onboarding readiness"
```

### Task 3: Return manifest, modules, relations, and primary location

**Files:**
- Create: `apps/api/src/routes/onboarding/persistence.ts`
- Modify: `apps/api/src/routes/onboarding/index.ts`
- Create: `apps/api/src/routes/onboarding/onboarding.postgres.test.ts`

**Interfaces:**
- Consumes: `buildOnboardingSteps`, `evaluateOnboardingReadiness`, Drizzle transaction.
- Produces: `ensurePrimaryLocation(db, salon): Promise<SalonLocation>` and expanded `GET /api/onboarding` response.

- [ ] **Step 1: Add PostgreSQL integration tests**

Use the same setup as `apps/api/src/routes/inventory/counts.postgres.test.ts`: `testDatabaseUrl()`, conditional `describe`, `createDatabase`, `createApp`, a real owner/session cookie, `try/finally` cleanup, and `clearPermissionCache()`. Cover these observable assertions:

```ts
expect(response.statusCode).toBe(200);
expect(response.json()).toMatchObject({
  modules: [],
  readiness: { ready: false },
  steps: expect.arrayContaining([expect.objectContaining({ key: "locations" })]),
});
expect(body.locations).toHaveLength(1);
expect(body.locations[0]).toMatchObject({ name: salon.name, address: salon.address, active: true });
```

Add a second test enabling `MODULE_KEYS.MULTI_LOCATION` in `salonModules` and assert the `resources` step is present.

- [ ] **Step 2: Run the integration test and verify the response mismatch**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts`

Expected: FAIL because the current payload lacks `modules`, `readiness`, `steps`, `locations`, and assignments.

- [ ] **Step 3: Implement `ensurePrimaryLocation` transactionally**

Select the first location by `displayOrder`; if absent, insert one using salon name, address, phone, email, and timezone. Protect concurrent requests by catching the salon/name unique conflict and reselecting. Do not create extra locations when one exists.

- [ ] **Step 4: Expand the GET query and map the response**

Fetch `salonModules`, `salonLocations`, `salonResources`, `serviceStaff`, and `serviceResources` together with existing rows. Evaluate readiness, build steps, attach matching issues to each step, and retain current fields for backward compatibility.

```ts
const readiness = evaluateOnboardingReadiness(snapshot);
const steps = buildOnboardingSteps(enabledModules, readiness.statuses).map((step) => ({
  ...step,
  issues: readiness.issues.filter((issue) => issue.step_key === step.key),
}));
```

- [ ] **Step 5: Run onboarding and security tests**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts src/onboarding-security.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit expanded bootstrap**

```powershell
git add apps/api/src/routes/onboarding/persistence.ts apps/api/src/routes/onboarding/index.ts apps/api/src/routes/onboarding/onboarding.postgres.test.ts
git commit -m "feat(api): expose onboarding operational state"
```

### Task 4: Save locations, resources, and catalog with stable IDs

**Files:**
- Modify: `apps/api/src/routes/onboarding/persistence.ts`
- Modify: `apps/api/src/routes/onboarding/index.ts`
- Modify: `apps/api/src/routes/onboarding/onboarding.postgres.test.ts`

**Interfaces:**
- Produces: `saveLocations`, `saveResources`, and `saveCatalog`, each accepting a transaction, `salonId`, and typed drafts.
- HTTP endpoints: `PATCH /api/onboarding/locations`, `/resources`, and `/services`.

- [ ] **Step 1: Add failing persistence tests**

Test that updating a service by ID retains the same ID and its existing `serviceStaff` row. Test that a location ID from another tenant returns `400 INVALID_LOCATION`. Test that a second location without Multi-sede returns `409 MULTI_LOCATION_REQUIRED`. Test resource IDs and `location_id` ownership the same way.

```ts
expect(updatedService.id).toBe(originalService.id);
expect(await db.select().from(serviceStaff).where(eq(serviceStaff.serviceId, originalService.id))).toHaveLength(1);
```

- [ ] **Step 2: Run focused tests and confirm current destructive-save failure**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts`

Expected: FAIL because services are deleted/recreated and the new endpoints do not exist.

- [ ] **Step 3: Implement tenant-scoped collection synchronization**

For each collection:

1. select existing rows for the tenant;
2. reject supplied IDs not in that set;
3. update rows carrying IDs;
4. insert drafts without IDs;
5. soft-disable omitted rows that are already referenced; delete only new/unreferenced drafts when safe;
6. perform the entire operation in one transaction.

`saveCatalog` upserts categories first, resolves local category keys to persisted IDs, then upserts services. It never deletes all services or categories.

- [ ] **Step 4: Add route validation and module limit**

Accept exact DTOs with `active`, stable optional `id`, and location/resource relationships. Before `saveLocations`, query `multi_location`; when disabled, reject more than one location. Return `{ saved, readiness }` after each save.

- [ ] **Step 5: Run integration tests and typecheck**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts`

Expected: PASS.

Run: `pnpm --filter @esse-beauty/api typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit stable operational persistence**

```powershell
git add apps/api/src/routes/onboarding/persistence.ts apps/api/src/routes/onboarding/index.ts apps/api/src/routes/onboarding/onboarding.postgres.test.ts
git commit -m "feat(api): persist onboarding locations and resources"
```

### Task 5: Save staff and assignments safely

**Files:**
- Modify: `apps/api/src/routes/onboarding/persistence.ts`
- Modify: `apps/api/src/routes/onboarding/index.ts`
- Modify: `apps/api/src/routes/onboarding/onboarding.postgres.test.ts`

**Interfaces:**
- Produces: `saveStaff(tx, salonId, ownerUserId, drafts)` and `saveAssignments(tx, salonId, input)`.
- HTTP endpoints: extended `PATCH /api/onboarding/staff` and new `PUT /api/onboarding/assignments`.

- [ ] **Step 1: Add failing tenant and relationship tests**

Test stable staff IDs, owner linkage, cross-tenant rejection for `staff_id`, `service_id`, `resource_id`, and `location_id`, duplicate pair normalization, and transactional rollback when one pair is invalid.

```ts
const response = await owner.inject({
  method: "PUT",
  url: "/api/onboarding/assignments",
  payload: { service_staff: [{ service_id: ownService.id, staff_id: foreignStaff.id }], service_resources: [] },
});
expect(response.statusCode).toBe(400);
expect(response.json()).toEqual({ error: "INVALID_STAFF_ASSIGNMENT" });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts`

Expected: FAIL at the new assignment cases.

- [ ] **Step 3: Replace destructive staff persistence**

Upsert by stable ID, validate `location_id`, link the owner only to the selected draft, and soft-disable omitted persisted members. Preserve existing user accounts and appointment history.

- [ ] **Step 4: Implement assignment replacement after ownership validation**

Load valid tenant IDs into sets. Validate the complete payload before deleting any relationship. Inside one transaction, replace the tenant's onboarding-managed `serviceStaff` and `serviceResources` rows with de-duplicated pairs.

- [ ] **Step 5: Run API suite**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts src/onboarding-security.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit staff and assignment persistence**

```powershell
git add apps/api/src/routes/onboarding/persistence.ts apps/api/src/routes/onboarding/index.ts apps/api/src/routes/onboarding/onboarding.postgres.test.ts
git commit -m "feat(api): persist onboarding staff assignments"
```

### Task 6: Enforce server-side completion readiness

**Files:**
- Modify: `apps/api/src/routes/onboarding/index.ts`
- Modify: `apps/api/src/routes/onboarding/onboarding.postgres.test.ts`

**Interfaces:**
- Consumes: the same snapshot loader and `evaluateOnboardingReadiness` used by GET.
- Produces: `POST /api/onboarding/complete` returning either `{ completed: true }` or `{ error: "ONBOARDING_INCOMPLETE", issues }`.

- [ ] **Step 1: Add failing completion tests**

Verify `409` for no location, a bookable service without staff, invalid resource coverage, and a staff member pointing to an inactive location. Verify `200` for the minimum usable snapshot and assert `onboardingCompletedAt` is written only then.

- [ ] **Step 2: Run tests and confirm the old count-only rule fails**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding/onboarding.postgres.test.ts -t completion`

Expected: FAIL because current completion only counts services and staff.

- [ ] **Step 3: Reuse the snapshot/readiness path in completion**

```ts
const snapshot = await loadOnboardingSnapshot(app.db, request.salonId);
const readiness = evaluateOnboardingReadiness(snapshot);
if (!readiness.ready) {
  return reply.code(409).send({ error: "ONBOARDING_INCOMPLETE", issues: readiness.issues });
}
```

Set `onboardingCompletedAt` and compatibility step only after this guard.

- [ ] **Step 4: Run the full onboarding API tests**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding`

Expected: PASS.

- [ ] **Step 5: Commit completion enforcement**

```powershell
git add apps/api/src/routes/onboarding/index.ts apps/api/src/routes/onboarding/onboarding.postgres.test.ts
git commit -m "feat(api): enforce onboarding readiness"
```

### Task 7: Build typed, manifest-driven wizard state

**Files:**
- Create: `apps/web/app/onboarding/types.ts`
- Create: `apps/web/app/onboarding/useOnboardingWizard.ts`
- Create: `apps/web/onboarding-state.test.ts`
- Modify: `apps/web/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: expanded `GET /api/onboarding` and section save responses.
- Produces: `useOnboardingWizard()` returning `data`, `draft`, `activeStep`, `goToStep`, `saveCurrentStep`, `busy`, and `error`.

- [ ] **Step 1: Add failing navigation/state tests**

Extract and test pure helpers exported by the hook module:

```ts
it("resumes at the first incomplete required step", () => {
  expect(firstActionableStep([
    { key: "identity", required: true, status: "complete" },
    { key: "locations", required: true, status: "needs_attention" },
    { key: "review", required: true, status: "not_started" },
  ])).toBe("locations");
});

it("keeps the current draft when a save fails", () => {
  expect(applySaveFailure(draft, "Sede non salvata")).toEqual({ draft, error: "Sede non salvata" });
});
```

- [ ] **Step 2: Run tests and verify missing helpers**

Run: `pnpm --filter @esse-beauty/web test -- onboarding-state.test.ts`

Expected: FAIL because the state module does not exist.

- [ ] **Step 3: Define client contracts matching API snake_case fields**

Include `OnboardingPayload`, `OnboardingStep`, drafts for location/resource/service/staff, relationship pair types, and structured issue types. Do not duplicate server runtime imports into the browser bundle.

- [ ] **Step 4: Implement fetch, resume, save, and correction navigation**

Keep drafts in state until a successful response. Use stable step keys, not numeric indexes. On success refetch the canonical payload; on failure preserve draft and focus the error summary. `goToStep(stepKey, entityId?)` stores the entity focus used by correction links.

- [ ] **Step 5: Reduce `page.tsx` to shell composition**

Remove the fixed `labels` array and numeric `next()` switch. Render from `data.steps`, resolve the active component through a typed map, and keep authentication/logout behavior unchanged.

- [ ] **Step 6: Run state tests and web typecheck**

Run: `pnpm --filter @esse-beauty/web test -- onboarding-state.test.ts`

Expected: PASS.

Run: `pnpm --filter @esse-beauty/web typecheck`

Expected: exit 0.

- [ ] **Step 7: Commit manifest-driven state**

```powershell
git add apps/web/app/onboarding/types.ts apps/web/app/onboarding/useOnboardingWizard.ts apps/web/app/onboarding/page.tsx apps/web/onboarding-state.test.ts
git commit -m "refactor(web): drive onboarding from server manifest"
```

### Task 8: Implement focused onboarding step components

**Files:**
- Create: all files under `apps/web/app/onboarding/_components/` listed in File Map.
- Modify: `apps/web/app/onboarding/page.tsx`
- Modify: `apps/web/onboarding-ui.test.ts`

**Interfaces:**
- Consumes: typed drafts and callbacks from `useOnboardingWizard`.
- Produces: accessible editors that call only their parent callbacks and never fetch independently.

- [ ] **Step 1: Extend the source-level UI contract tests**

Assert the page imports each focused component, does not contain `const labels =`, renders progress from `data.steps`, retains logout, and includes an `aria-live="polite"` save/error region. Assert `AssignmentsStep.tsx` includes staff/service checkboxes, “Seleziona tutto”, “Copia assegnazioni”, and resource assignment controls.

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `pnpm --filter @esse-beauty/web test -- onboarding-ui.test.ts`

Expected: FAIL until the components exist and the fixed wizard is removed.

- [ ] **Step 3: Implement progress, identity, and location components**

`OnboardingProgress` renders “N passaggi completati su M”, status text, and buttons with `aria-current="step"`. `LocationsStep` always supports one primary location and only renders “Aggiungi sede” when its manifest mode is `multiple`.

- [ ] **Step 4: Implement resources, services, and staff components**

Group resources by location. Preserve category/service IDs in every edit. Include buffer and online booking controls. Staff rows include role, primary location, working hours, and owner-link selection. Reuse `FormField`, `ScheduleEditor`, `Switch`, and `Button` from `@esse-beauty/ui`.

- [ ] **Step 5: Implement assignments matrix**

Render services as rows and staff as columns at desktop widths; on compact widths render one service card at a time with labeled staff checkboxes. All checkboxes expose the service and staff names in their accessible label. Add bulk selection and copy actions by transforming draft pairs locally.

- [ ] **Step 6: Implement review and error focus**

Group issues by step, include status text, and call `goToStep(issue.step_key, issue.entity_id)` from “Correggi”. When issues arrive after save or completion, focus a summary with `tabIndex={-1}` and announce it through the live region.

- [ ] **Step 7: Run web tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- onboarding-ui.test.ts onboarding-state.test.ts`

Expected: PASS.

Run: `pnpm --filter @esse-beauty/web typecheck`

Expected: exit 0.

- [ ] **Step 8: Commit the complete UI**

```powershell
git add apps/web/app/onboarding apps/web/onboarding-ui.test.ts apps/web/onboarding-state.test.ts
git commit -m "feat(web): complete operational salon onboarding"
```

### Task 9: Verify regression boundaries and end-to-end build

**Files:**
- Modify only if a failing regression directly requires an onboarding-scoped correction.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified repository state; no new public interface.

- [ ] **Step 1: Run targeted API tests**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/onboarding src/onboarding-security.test.ts`

Expected: PASS.

- [ ] **Step 2: Run targeted web tests**

Run: `pnpm --filter @esse-beauty/web test -- onboarding-ui.test.ts onboarding-state.test.ts`

Expected: PASS.

- [ ] **Step 3: Run workspace typechecks**

Run: `pnpm typecheck`

Expected: all packages exit 0.

- [ ] **Step 4: Run full workspace tests**

Run: `pnpm test`

Expected: all packages pass. If an unrelated pre-existing failure occurs, record the exact command and output without changing unrelated code.

- [ ] **Step 5: Run the production build**

Run: `pnpm build`

Expected: Turbo reports successful API and Next.js builds.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only onboarding-scoped files from this plan plus pre-existing user changes are present.

- [ ] **Step 7: Commit any final onboarding-only correction**

If Task 9 changed onboarding files, stage each changed path explicitly after checking `git status --short`, then run `git commit -m "fix: finalize salon onboarding integration"`. Skip this step when Task 9 requires no correction; never stage unrelated pre-existing changes.
