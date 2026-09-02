# Staff Detail Page Restyling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `apps/web/app/(dashboard)/settings/staff/[staffId]/page.tsx` (mounted at both `/settings/staff/:staffId` and `/staff/:staffId`) to use the hero-header + stat-strip + tab pattern already shipped on `apps/web/app/(dashboard)/clients/[customerId]/page.tsx`.

**Architecture:** Pure markup/state restructuring of one existing page component. No API, schema, or route changes. Reuses the existing `staffStatusAction` helper and `ConfirmDialog` pattern already proven in `settings/staff/page.tsx` to wire a new "Disattiva/Riattiva collaboratore" hero action. Reuses `WEEK_DAYS_IT` from `@esse-beauty/shared` to compute a "working days" stat without hardcoding a day-key array (the existing regression suite explicitly forbids that literal in this file).

**Tech Stack:** Next.js 15 / React 19 client component, Tailwind CSS 4, `@esse-beauty/ui` design system, `lucide-react` icons, Vitest for the source-assertion regression suite.

---

## Context for the engineer

- Reference pattern to copy: `apps/web/app/(dashboard)/clients/[customerId]/page.tsx` — hero card (avatar + title + meta row + actions), 4-cell stat strip, horizontal pill tabs, `article` content cards (`rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm`).
- Target file: `apps/web/app/(dashboard)/settings/staff/[staffId]/page.tsx`. Two re-export shims point at it and must NOT be touched: `apps/web/app/(dashboard)/staff/[staffId]/page.tsx` and (list page, unrelated) `apps/web/app/(dashboard)/staff/manage/page.tsx`.
- `apps/web/ui-polish-regression.test.ts` is a source-string assertion suite (no `@testing-library`, no DOM rendering — the app has neither installed). It already asserts things about this exact file (see the `"supports staff PWA access, visible availability blocks, salon closures, and Italian weekdays"` test at the bottom of that file) and **forbids** the literal array `["mon", "tue", "wed", "thu", "fri", "sat", "sun"]` from appearing in this file. Any day-list logic must go through `WEEK_DAYS_IT` from `@esse-beauty/shared` (`packages/shared/index.ts:54`), which exports `{ key, label, shortLabel }` objects.
- Staff-level activate/deactivate already exists and is proven in `apps/web/app/(dashboard)/settings/staff/page.tsx`: `PATCH /api/salons/:id/staff/:staffId` with body `{ active }`, gated by `staffStatusAction(active)` from `apps/web/app/(dashboard)/settings/staff/staff-status-action.ts` (returns `{ confirmationRequired, label: "Disattiva" | "Riattiva", nextActive }`). The detail page's `GET /api/salons/:id/staff` response already includes `active` per collaborator — it's just not in the page's local `Member` type yet.
- No component test file exists for this page and none should be added (the codebase's convention for page components is the source-assertion suite, not rendering tests).

---

### Task 1: Lock in the new pattern with a failing regression assertion

**Files:**
- Modify: `apps/web/ui-polish-regression.test.ts:460-482` (end of file, inside the existing `describe` block, right after the `"supports staff PWA access..."` test)

- [ ] **Step 1: Add the failing assertion block**

Insert this new `it(...)` immediately after the closing `});` of the `"supports staff PWA access, visible availability blocks, salon closures, and Italian weekdays"` test (i.e. right before the final `});` that closes the `describe(...)` block):

```typescript
  it("mirrors the client detail hero and tab pattern in the staff detail page", () => {
    const staffDetail = readFileSync(join(dashboardRoot, "settings", "staff", "[staffId]", "page.tsx"), "utf8");
    expect(staffDetail).not.toContain("SectionCard");
    expect(staffDetail).not.toContain("PageHeader");
    expect(staffDetail).toContain("PageTransition");
    expect(staffDetail).toContain('Breadcrumbs items={[{ href: "/staff", label: "Staff" }');
    expect(staffDetail).toContain('useState<TabKey>("profile")');
    expect(staffDetail).toContain("staffStatusAction(member.active)");
    expect(staffDetail).toContain("ConfirmDialog");
    expect(staffDetail).toContain("Servizi abilitati");
    expect(staffDetail).toContain("Giorni lavorativi");
    expect(staffDetail).toContain("WEEK_DAYS_IT");
  });
```

- [ ] **Step 2: Run the suite and confirm this new assertion fails**

Run: `pnpm --filter @esse-beauty/web test -- ui-polish-regression`
Expected: FAIL on the new `"mirrors the client detail hero and tab pattern in the staff detail page"` test (e.g. `expected ... not to include 'SectionCard'` or similar, since the current file still uses `SectionCard`/`PageHeader` and has none of the new strings). Other tests in the file must still PASS.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/ui-polish-regression.test.ts
git commit -m "test: lock in staff detail hero/tab restyle pattern"
```

---

### Task 2: Rewrite the staff detail page

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/staff/[staffId]/page.tsx` (full rewrite of imports, types, state, and the returned JSX; `load`, `save`, `saveAccess`, `saveCapabilities` business logic is unchanged)

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Ban, CalendarClock, Check, ChevronDown, MapPinned, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { WEEK_DAYS_IT, type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, designTokens, FormField, PageTransition, SaveActionButton, SaveToast, ScheduleEditor } from "@esse-beauty/ui";
import { useAuth } from "../../../../../lib/auth-context";
import { staffStatusAction } from "../staff-status-action";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type TabKey = "profile" | "access" | "location" | "hours";

interface Member {
  active: boolean;
  id: string;
  displayName: string;
  bio?: string;
  color: string;
  specializations: string[];
  workingHours: WorkingHours;
}

interface StaffAccess {
  active: boolean;
  email: string;
  role?: "owner" | "manager" | "receptionist" | "employee" | null;
  user_id?: string | null;
}

interface StaffService {
  active: boolean;
  category: string;
  enabled: boolean;
  id: string;
  name: string;
}

interface Location {
  active: boolean;
  address?: string | null;
  id: string;
  name: string;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

const tabs: Array<{ icon: typeof UserRound; key: TabKey; label: string }> = [
  { icon: UserRound, key: "profile", label: "Profilo" },
  { icon: Smartphone, key: "access", label: "Accesso App Staff" },
  { icon: MapPinned, key: "location", label: "Sede & Servizi" },
  { icon: CalendarClock, key: "hours", label: "Orari" },
];

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useAuth();
  const [member, setMember] = useState<Member>();
  const [salonHours, setSalonHours] = useState<WorkingHours>();
  const [access, setAccess] = useState<StaffAccess>({ active: true, email: "", role: null, user_id: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [services, setServices] = useState<StaffService[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savedAccess, setSavedAccess] = useState(false);
  const [savingCapabilities, setSavingCapabilities] = useState(false);
  const [savedCapabilities, setSavedCapabilities] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<TabKey>("profile");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const load = async () => {
    if (!salon) return;
    const [staffRows, accessResponse, settingsResponse, capabilityResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff-default-hours`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/services`, { credentials: "include" }),
    ]);
    setMember(staffRows.find((item: Member) => item.id === staffId));
    if (accessResponse.ok) setAccess(await accessResponse.json() as StaffAccess);
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json() as { opening_hours?: WorkingHours };
      setSalonHours(settings.opening_hours);
    }
    if (capabilityResponse.ok) {
      const data = await capabilityResponse.json() as {
        location_id?: string | null;
        locations: Location[];
        services: StaffService[];
      };
      setServices(data.services);
      setLocations(data.locations);
      setLocationId(data.location_id ?? null);
    }
  };

  useEffect(() => {
    void load();
  }, [salon?.id, staffId]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

  async function save() {
    if (!member || !salon) return;
    setSavingProfile(true);
    setSavedProfile(false);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: member.displayName,
        bio: member.bio,
        color: member.color,
        specializations: member.specializations,
        working_hours: member.workingHours,
      }),
    });
    setMessage(response.ok ? "Profilo staff salvato." : "");
    setError(response.ok ? "" : "Profilo non salvato.");
    setSavedProfile(response.ok);
    setSavingProfile(false);
  }

  async function saveAccess(data: FormData) {
    if (!salon) return;
    setSavingAccess(true);
    setSavedAccess(false);
    const password = String(data.get("password") ?? "");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        active: data.get("active") === "on",
        email: data.get("email"),
        ...(password ? { password } : {}),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "ACCESS_NOT_SAVED" }));
      setError(payload.error === "PASSWORD_REQUIRED" ? "Inserisci una password per creare il primo accesso." : "Accesso App Staff non salvato.");
      setSavingAccess(false);
      return;
    }
    setAccess(await response.json() as StaffAccess);
    setMessage("Accesso App Staff salvato.");
    setSavedAccess(true);
    setSavingAccess(false);
  }

  async function saveCapabilities() {
    if (!salon) return;
    const serviceIds = services.filter((service) => service.enabled).map((service) => service.id);
    if (serviceIds.length === 0) {
      setError("Abilita almeno un servizio per il collaboratore.");
      return;
    }
    setSavingCapabilities(true);
    setSavedCapabilities(false);
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/services`, {
      body: JSON.stringify({ location_id: locationId, service_ids: serviceIds }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    setMessage(response.ok ? "Sede e competenze salvate." : "");
    setError(response.ok ? "" : "Sede e competenze non salvate.");
    setSavedCapabilities(response.ok);
    setSavingCapabilities(false);
  }

  async function toggleActive() {
    if (!salon || !member) return;
    setTogglingActive(true);
    const nextActive = staffStatusAction(member.active).nextActive;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    setConfirmDeactivate(false);
    if (!response.ok) {
      setError(`Il collaboratore non è stato ${nextActive ? "riattivato" : "disattivato"}.`);
      setTogglingActive(false);
      return;
    }
    setMember({ ...member, active: nextActive });
    setMessage(nextActive ? "Collaboratore riattivato." : "Collaboratore disattivato.");
    setTogglingActive(false);
  }

  function requestStatusChange() {
    if (!member) return;
    const action = staffStatusAction(member.active);
    if (action.confirmationRequired) {
      setConfirmDeactivate(true);
      return;
    }
    void toggleActive();
  }

  const enabledServiceCount = useMemo(() => services.filter((service) => service.enabled).length, [services]);
  const workingDayCount = useMemo(
    () => WEEK_DAYS_IT.filter((day) => (member?.workingHours[day.key]?.length ?? 0) > 0).length,
    [member],
  );
  const currentLocationName = useMemo(
    () => locations.find((location) => location.id === locationId)?.name ?? "Non assegnata",
    [locations, locationId],
  );
  const accessStatusLabel = access.user_id ? (access.active ? "Attivo" : "Disattivato") : "Non configurato";

  if (!member) return <AppPage maxWidth="max-w-[1600px]"><div className="h-72 animate-pulse rounded-2xl bg-stone-100" /></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast visible={Boolean(message || error)} variant={error ? "error" : "success"}>{error || message}</SaveToast>
        <Breadcrumbs items={[{ href: "/staff", label: "Staff" }, { label: member.displayName }]} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full text-lg font-black text-white" style={{ background: member.color }}>{initials(member.displayName)}</span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-stone-950">{member.displayName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-stone-600">
                <span className="flex items-center gap-1.5"><Smartphone aria-hidden="true" className="size-3.5 text-stone-400" />{access.email || "Accesso non configurato"}</span>
                <span className="flex items-center gap-1.5"><MapPinned aria-hidden="true" className="size-3.5 text-stone-400" />{currentLocationName}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={togglingActive} onClick={requestStatusChange} variant="outline">
              {member.active ? <Ban aria-hidden="true" className="size-4" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
              {staffStatusAction(member.active).label} collaboratore
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] md:grid-cols-4">
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{enabledServiceCount}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Servizi abilitati</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{workingDayCount}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Giorni lavorativi</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{accessStatusLabel}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Accesso App Staff</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{currentLocationName}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Sede</span></div>
        </div>

        <nav aria-label="Sezioni scheda collaboratore" className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-200">
          {tabs.map((item) => {
            const count = item.key === "location" ? enabledServiceCount : undefined;
            const active = tab === item.key;
            return (
              <button
                aria-selected={active}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-bold transition ${active ? "border-stone-200 bg-white text-[#792f59]" : "border-transparent bg-stone-100 text-stone-500 hover:bg-stone-50 hover:text-stone-800"}`}
                key={item.key}
                onClick={() => setTab(item.key)}
                role="tab"
                type="button"
              >
                <item.icon aria-hidden="true" className="size-4" />
                {item.label}
                {Boolean(count) && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? "bg-[#f3e2eb] text-[#792f59]" : "bg-white text-stone-500"}`}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          {tab === "profile" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold text-stone-950"><UserRound aria-hidden="true" className="size-4 text-[#792f59]" />Profilo</h2>
              <p className="mt-1 text-xs text-stone-500">Dati visibili nel gestionale e nelle aree collegate al collaboratore.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_170px]">
                <FormField label="Nome collaboratore" required>
                  <input className="w-full" value={member.displayName} onChange={(event) => setMember({ ...member, displayName: event.target.value })} />
                </FormField>
                <FormField label="Colore">
                  <div className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-[#fffafd] px-3">
                    <label className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(214_211_209)]" style={{ backgroundColor: member.color }}>
                      <span className="sr-only">Scegli colore collaboratore</span>
                      <input aria-label="Colore collaboratore" className="absolute inset-0 size-full cursor-pointer opacity-0" type="color" value={member.color} onChange={(event) => setMember({ ...member, color: event.target.value })} />
                    </label>
                    <span className="text-sm font-bold uppercase text-stone-500">{member.color}</span>
                  </div>
                </FormField>
                <FormField label="Biografia" description="Nota interna o breve presentazione del collaboratore." className="sm:col-span-2">
                  <textarea className="min-h-28 w-full resize-y" value={member.bio ?? ""} onChange={(event) => setMember({ ...member, bio: event.target.value })} />
                </FormField>
              </div>
              <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
                <SaveActionButton busy={savingProfile} idleLabel="Salva profilo" onClick={() => void save()} saved={savedProfile} />
              </div>
            </article>
          )}

          {tab === "access" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold text-stone-950"><Smartphone aria-hidden="true" className="size-4 text-[#792f59]" />Accesso App Staff</h2>
              <p className="mt-1 text-xs text-stone-500">Credenziali usate dal collaboratore per accedere alla propria app operativa.</p>
              <form action={saveAccess} className="mt-4">
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField label="Email dipendente" required>
                    <input className="w-full" name="email" type="email" required value={access.email} onChange={(event) => setAccess({ ...access, email: event.target.value })} />
                  </FormField>
                  <FormField label={access.user_id ? "Reimposta password" : "Password iniziale"} description={access.user_id ? "Lascia vuoto per mantenere la password attuale. Minimo 10 caratteri." : "Minimo 10 caratteri."}>
                    <input className="w-full" name="password" type="password" minLength={10} />
                  </FormField>
                  <div className="md:col-span-2">
                    <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-[#fbfaf8] px-4">
                      <span>
                        <strong className="block text-sm text-stone-900">Accesso App Staff attivo</strong>
                        <span className="mt-1 block text-xs text-stone-500">Consente al collaboratore di accedere alla propria agenda.</span>
                      </span>
                      <input disabled={access.role === "owner"} name="active" type="checkbox" checked={access.active} onChange={(event) => setAccess({ ...access, active: event.target.checked })} />
                    </label>
                  </div>
                </div>
                {access.role === "owner" && (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                    Questo profilo è collegato al titolare. L’accesso all’App Staff usa lo stesso account senza modificarne ruolo o stato.
                  </p>
                )}
                <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
                  <SaveActionButton busy={savingAccess} idleLabel="Salva accesso App Staff" saved={savedAccess} type="submit" />
                </div>
              </form>
            </article>
          )}

          {tab === "location" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold text-stone-950"><MapPinned aria-hidden="true" className="size-4 text-[#792f59]" />Sede & Servizi</h2>
              <p className="mt-1 text-xs text-stone-500">Determina dove può lavorare il collaboratore e quali prenotazioni può ricevere dall’App Clienti.</p>
              <div className="mt-4">
                {locations.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-stone-900">Sede di lavoro</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {locations.filter((location) => location.active).map((location) => (
                        <button
                          aria-pressed={locationId === location.id}
                          className={`rounded-xl border p-4 text-left transition ${locationId === location.id ? "border-[#9d4f78] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`}
                          key={location.id}
                          onClick={() => setLocationId(location.id)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="block">{location.name}</strong>
                            {locationId === location.id && <Check aria-hidden="true" className="size-4 shrink-0 text-[#9d4f78]" />}
                          </div>
                          <span className="mt-1 block text-xs text-stone-500">{location.address || "Indirizzo non specificato"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className={locations.length > 0 ? "mt-6 border-t border-stone-100 pt-6" : ""}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-stone-900">Competenze operative</p>
                      <p className="mt-1 text-xs text-stone-500">I servizi non abilitati non compariranno tra le scelte disponibili per questo collaboratore.</p>
                    </div>
                    <Button onClick={() => setServices(services.map((service) => ({ ...service, enabled: service.active })))} size="sm" variant="outline">Seleziona tutti</Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {Array.from(new Set(services.map((service) => service.category))).map((category) => {
                      const categoryServices = services.filter((service) => service.category === category);
                      const enabledCount = categoryServices.filter((service) => service.enabled).length;
                      const isOpen = Boolean(openCategories[category]);
                      const panelId = `services-category-${category.toLowerCase().replace(/\s+/g, "-")}`;
                      return (
                        <div className="overflow-hidden rounded-xl border border-stone-200" key={category}>
                          <button
                            aria-controls={panelId}
                            aria-expanded={isOpen}
                            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20"
                            onClick={() => setOpenCategories((current) => ({ ...current, [category]: !isOpen }))}
                            type="button"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-stone-900">{category}</span>
                              <span className="mt-0.5 block text-xs text-stone-500">{enabledCount}/{categoryServices.length} abilitati</span>
                            </span>
                            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-stone-500 transition-transform ${isOpen ? "rotate-180 text-[#792f59]" : ""}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                animate={{ height: "auto", opacity: 1 }}
                                className="overflow-hidden"
                                exit={{ height: 0, opacity: 0 }}
                                id={panelId}
                                initial={{ height: 0, opacity: 0 }}
                                transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.standard }}
                              >
                                <div className="flex flex-wrap gap-2 border-t border-stone-100 p-4">
                                  {categoryServices.map((service) => (
                                    <button
                                      aria-pressed={service.enabled}
                                      className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-bold transition ${service.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-stone-200 bg-white text-stone-500"}`}
                                      disabled={!service.active}
                                      key={service.id}
                                      onClick={() => setServices(services.map((item) => item.id === service.id ? { ...item, enabled: !item.enabled } : item))}
                                      type="button"
                                    >
                                      {service.enabled && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                                      {service.name}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
                <SaveActionButton busy={savingCapabilities} idleLabel="Salva sede e competenze" onClick={() => void saveCapabilities()} saved={savedCapabilities} />
              </div>
            </article>
          )}

          {tab === "hours" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold text-stone-950"><CalendarClock aria-hidden="true" className="size-4 text-[#792f59]" />Orari settimanali</h2>
              <p className="mt-1 text-xs text-stone-500">Puoi aggiungere più fasce nello stesso giorno, ad esempio 09:00–13:00 e 15:00–19:00.</p>
              <div className="mt-4 mb-5 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4">
                <div>
                  <strong className="block text-sm text-stone-900">Orario base del salone</strong>
                  <span className="mt-1 block text-xs text-stone-500">Sostituisce le fasce sottostanti con gli orari di apertura attuali.</span>
                </div>
                <Button className="self-start" disabled={!salonHours} onClick={() => salonHours && setMember({ ...member, workingHours: structuredClone(salonHours) })} size="sm" variant="outline">Carica orari salone</Button>
              </div>
              <ScheduleEditor
                onChange={(workingHours) => setMember({ ...member, workingHours })}
                value={member.workingHours}
              />
              <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
                <SaveActionButton busy={savingProfile} idleLabel="Salva orari" onClick={() => void save()} saved={savedProfile} />
              </div>
            </article>
          )}
        </div>
      </PageTransition>

      <ConfirmDialog
        confirmLabel="Disattiva"
        destructive
        description="Il collaboratore verrà escluso dalle configurazioni attive senza eliminare lo storico."
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => void toggleActive()}
        open={confirmDeactivate}
        title={`Disattivare ${member.displayName}?`}
      />
    </AppPage>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @esse-beauty/web typecheck`
Expected: no errors. If `WEEK_DAYS_IT` or `WorkingHours["mon"]` typing complains, confirm `WorkingHours` (from `@esse-beauty/shared`) is keyed by the same `"mon" | "tue" | ...` literals as `WEEK_DAYS_IT[number]["key"]` — both already come from the same package, so no cast should be needed.

- [ ] **Step 3: Run the full web regression suite and confirm everything passes**

Run: `pnpm --filter @esse-beauty/web test -- ui-polish-regression`
Expected: PASS, including the new `"mirrors the client detail hero and tab pattern in the staff detail page"` test and the pre-existing `"supports staff PWA access..."` test (`Accesso App Staff`, `/access`, `ScheduleEditor` all still present; no `["mon", "tue", "wed", "thu", "fri", "sat", "sun"]` literal introduced).

- [ ] **Step 4: Run the full web test suite**

Run: `pnpm --filter @esse-beauty/web test`
Expected: PASS (no unrelated suite broken by the removed `SectionCard`/`PageHeader` imports or the interface change).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(dashboard)/settings/staff/[staffId]/page.tsx"
git commit -m "feat(web): restyle staff detail page with hero and tab layout"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev stack**

Run: `pnpm run dev` (or `pnpm --filter @esse-beauty/web dev` if the API/DB are already running)

- [ ] **Step 2: Walk the page**

Open a collaborator via both `/staff/:staffId` and `/settings/staff/:staffId` and confirm:
- hero shows correct avatar color/initials, email or "Accesso non configurato", sede or "Non assegnata";
- stat strip numbers match reality (enabled services count, working days count, access status, sede);
- all four tabs render their existing content unchanged in behavior;
- "Salva profilo" / "Salva accesso App Staff" / "Salva sede e competenze" / "Salva orari" each still persist correctly (reload page after each to confirm);
- clicking "Disattiva collaboratore" opens the confirm dialog with the same copy as `settings/staff/page.tsx`, and confirming flips the hero button to "Riattiva collaboratore" and updates the stat strip's access-independent state without a full reload;
- clicking "Riattiva collaboratore" (no confirmation) re-activates immediately;
- breadcrumb "Staff" link returns to `/staff`.

- [ ] **Step 3: Report findings**

If anything above doesn't hold, note it — this step is not automatable and must be confirmed by a human or a browser-driving agent before considering the task complete.

---

## Self-review notes

- **Spec coverage:** hero (avatar/name/meta/action) ✓, stat strip (4 cells) ✓, tabs (Profilo/Accesso/Sede & Servizi/Orari with icons) ✓, article-based tab content replacing `SectionCard` ✓, independent per-tab `SaveActionButton`s preserved ✓, disattiva/riattiva wiring reusing `staffStatusAction` + `ConfirmDialog` ✓, no API/schema changes ✓.
- **Placeholder scan:** none — all steps contain full code or exact commands.
- **Type consistency:** `Member.active`, `staffStatusAction(member.active)`, `toggleActive`/`requestStatusChange` names match between the implementation task and the regression-test assertions in Task 1.
