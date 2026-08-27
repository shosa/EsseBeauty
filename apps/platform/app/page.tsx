"use client";

import { MODULE_KEYS, type ModuleKey } from "@esse-beauty/feature-flags";
import {
  Activity, AppWindow, ArrowRight, Boxes, Building2, CalendarClock, Check, ChevronRight,
  CircleAlert, CreditCard, FileText, Gauge, KeyRound, LayoutDashboard, LogOut, Mail,
  Menu, MessageSquareText, PackageOpen, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  Sparkles, Store, Trash2, UserRoundCog, UsersRound, X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { platformRequest } from "./api";
import type {
  ModuleState, PlatformAuditItem, PlatformModule, PlatformOverview, PlatformPlan,
  PlatformSalon, PlatformSession, PlatformTemplate, SalonOwner, TenantStatus, TenantTab, View,
} from "./types";

const moduleCatalog: Array<{ description: string; key: ModuleKey; label: string }> = [
  { key: MODULE_KEYS.REMINDERS, label: "Promemoria", description: "Automazioni prima degli appuntamenti" },
  { key: MODULE_KEYS.REVIEWS, label: "Recensioni", description: "Inviti, risposte e reputazione" },
  { key: MODULE_KEYS.WAITLIST, label: "Lista d'attesa", description: "Gestione intelligente degli slot" },
  { key: MODULE_KEYS.LOYALTY, label: "Fedeltà", description: "Punti, premi e riscatti" },
  { key: MODULE_KEYS.MARKETING, label: "Marketing", description: "Campagne e segmenti clienti" },
  { key: MODULE_KEYS.INVENTORY, label: "Magazzino", description: "Scorte, acquisti e inventari" },
  { key: MODULE_KEYS.STAFF_PERF, label: "Performance staff", description: "Risultati individuali e team" },
  { key: MODULE_KEYS.DOCUMENTS, label: "Documenti", description: "Consensi, firme ed evidenze" },
  { key: MODULE_KEYS.PACKAGES, label: "Pacchetti", description: "Percorsi e sedute prepagate" },
  { key: MODULE_KEYS.MULTI_LOCATION, label: "Multi-sede", description: "Sedi, cabine e risorse" },
  { key: MODULE_KEYS.AUDIT_COMPLIANCE, label: "Audit", description: "Controlli e tracciabilità" },
];

const nav: Array<{ icon: typeof Gauge; label: string; view: View }> = [
  { icon: LayoutDashboard, label: "Panoramica", view: "overview" },
  { icon: Building2, label: "Saloni", view: "tenants" },
  { icon: CreditCard, label: "Piani", view: "plans" },
  { icon: Boxes, label: "Moduli", view: "modules" },
  { icon: MessageSquareText, label: "Template", view: "templates" },
  { icon: Activity, label: "Registro attività", view: "audit" },
];

function emptyModules(): ModuleState {
  return Object.fromEntries(moduleCatalog.map((item) => [item.key, false])) as ModuleState;
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

function date(value?: string | null, withTime = false) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function Button({ children, className = "", disabled, onClick, type = "button", variant = "primary" }: {
  children: ReactNode; className?: string; disabled?: boolean; onClick?: () => void; type?: "button" | "submit"; variant?: "primary" | "secondary" | "danger";
}) {
  return <button className={`platform-button platform-button-${variant} ${className}`} disabled={disabled} onClick={onClick} type={type}>{children}</button>;
}

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return <label className="grid gap-1.5 text-[13px] font-semibold text-[#34413f]"><span>{label}</span>{children}{hint && <small className="font-normal leading-5 text-[#78827f]">{hint}</small>}</label>;
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return <button aria-checked={checked} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#16745c]" : "bg-[#cbd4d1]"}`} disabled={disabled} onClick={() => onChange(!checked)} role="switch" type="button"><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button>;
}

function Status({ status }: { status: TenantStatus }) {
  const options = {
    active: ["Operativo", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
    trial: ["In prova", "bg-sky-50 text-sky-700 ring-sky-200"],
    suspended: ["Sospeso", "bg-rose-50 text-rose-700 ring-rose-200"],
    churn_risk: ["Da seguire", "bg-amber-50 text-amber-700 ring-amber-200"],
  }[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${options[1]}`}>{options[0]}</span>;
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose(): void; title: string }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#10201d]/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="platform-view max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e1e7e4] bg-white px-6 py-4"><h2 className="text-xl font-extrabold">{title}</h2><button className="grid size-9 place-items-center rounded-lg border border-[#dce3e0] hover:bg-[#f3f5f4]" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="p-6">{children}</div></section></div>;
}

function Metric({ icon: Icon, label, value, detail }: { detail: string; icon: typeof Gauge; label: string; value: number }) {
  return <div className="platform-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#78827f]">{label}</p><strong className="mt-2 block text-3xl font-extrabold tracking-tight">{value.toLocaleString("it-IT")}</strong></div><span className="grid size-10 place-items-center rounded-xl bg-[#edf7f3] text-[#16745c]"><Icon className="size-5" /></span></div><p className="mt-3 text-xs text-[#78827f]">{detail}</p></div>;
}

export default function PlatformPage() {
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [globalModules, setGlobalModules] = useState<PlatformModule[]>([]);
  const [templates, setTemplates] = useState<PlatformTemplate[]>([]);
  const [audit, setAudit] = useState<PlatformAuditItem[]>([]);
  const [selected, setSelected] = useState<PlatformSalon | null>(null);
  const [tenantTab, setTenantTab] = useState<TenantTab>("profile");
  const [owner, setOwner] = useState<SalonOwner | null>(null);
  const [tenantModules, setTenantModules] = useState<ModuleState>(emptyModules);
  const [pendingModule, setPendingModule] = useState<ModuleKey | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [templateEditor, setTemplateEditor] = useState<PlatformTemplate | "new" | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const loadData = useCallback(async () => {
    const [salonRows, overviewData, planRows, modules, templateRows, auditRows] = await Promise.all([
      platformRequest<PlatformSalon[]>("/api/platform/salons"),
      platformRequest<PlatformOverview>("/api/platform/overview"),
      platformRequest<PlatformPlan[]>("/api/platform/plans"),
      platformRequest<PlatformModule[]>("/api/platform/module-catalog"),
      platformRequest<PlatformTemplate[]>("/api/platform/system-templates"),
      platformRequest<PlatformAuditItem[]>("/api/platform/audit-log"),
    ]);
    setSalons(salonRows); setOverview(overviewData); setPlans(planRows); setGlobalModules(modules); setTemplates(templateRows); setAudit(auditRows);
    setSelected((current) => current ? salonRows.find((item) => item.id === current.id) ?? null : null);
  }, []);

  useEffect(() => {
    void platformRequest<PlatformSession>("/api/platform/auth/me")
      .then(async (current) => { setSession(current); await loadData(); })
      .catch(async () => setBootstrapRequired((await platformRequest<{ required: boolean }>("/api/platform/auth/bootstrap/status")).required))
      .finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 2800); return () => window.clearTimeout(timer); }, [notice]);

  const filteredSalons = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return salons;
    return salons.filter((salon) => `${salon.name} ${salon.slug} ${salon.plan_id ?? ""}`.toLowerCase().includes(needle));
  }, [query, salons]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await platformRequest(`/api/platform/auth/${bootstrapRequired ? "bootstrap" : "login"}`, {
        body: JSON.stringify(bootstrapRequired ? { email: form.get("email"), full_name: form.get("full_name"), password: form.get("password") } : { email: form.get("email"), password: form.get("password") }), method: "POST",
      });
      setSession(await platformRequest<PlatformSession>("/api/platform/auth/me"));
      await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Accesso non riuscito."); }
  }

  async function refresh() {
    setRefreshing(true); setError("");
    try { await loadData(); setNotice("Dati aggiornati"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aggiornamento non riuscito."); } finally { setRefreshing(false); }
  }

  async function logout() {
    await platformRequest("/api/platform/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null);
  }

  async function openTenant(salon: PlatformSalon) {
    setSelected(salon); setTenantTab("profile"); setOwner(null); setDeleteConfirmation(""); setError("");
    try {
      const [ownerData, moduleRows] = await Promise.all([
        platformRequest<SalonOwner>(`/api/platform/salons/${salon.id}/owner-access`),
        platformRequest<Array<{ enabled: boolean; module_key: ModuleKey }>>(`/api/platform/salons/${salon.id}/modules`),
      ]);
      const state = emptyModules(); moduleRows.forEach((item) => { state[item.module_key] = item.enabled; });
      setOwner(ownerData); setTenantModules(state);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Dettaglio tenant non disponibile."); }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    try {
      const created = await platformRequest<PlatformSalon>("/api/platform/salons", { method: "POST", body: JSON.stringify({ name: form.get("name"), slug: form.get("slug") || slugify(String(form.get("name"))), timezone: form.get("timezone"), locale: "it-IT", owner: { full_name: form.get("owner_name"), email: form.get("owner_email"), password: form.get("owner_password") } }) });
      setNewTenantOpen(false); await loadData(); setNotice("Salone creato"); await openTenant({ ...created, created_at: new Date().toISOString(), modules_enabled: 0, onboarding_completed: false, onboarding_step: 1, platform_status: "trial", trial_ends_at: null, updated_at: new Date().toISOString() });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Creazione non riuscita."); }
  }

  async function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setError(""); const form = new FormData(event.currentTarget); const status = String(form.get("status")) as TenantStatus;
    try {
      await platformRequest(`/api/platform/salons/${selected.id}`, { method: "PATCH", body: JSON.stringify({ active: status !== "suspended", name: form.get("name"), slug: form.get("slug"), timezone: form.get("timezone"), locale: form.get("locale"), plan_id: form.get("plan_id") || null, platform_status: status, trial_ends_at: form.get("trial_ends_at") || null }) });
      await loadData(); setNotice("Tenant aggiornato");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Salvataggio non riuscito."); }
  }

  async function saveOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget);
    try {
      setOwner(await platformRequest<SalonOwner>(`/api/platform/salons/${selected.id}/owner-access`, { method: "PATCH", body: JSON.stringify({ active: form.get("active") === "on", email: form.get("email"), full_name: form.get("full_name") }) }));
      setNotice("Titolare aggiornato");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Salvataggio non riuscito."); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget);
    try { await platformRequest(`/api/platform/salons/${selected.id}/owner-access/reset-password`, { method: "POST", body: JSON.stringify({ password: form.get("password") }) }); event.currentTarget.reset(); setNotice("Password reimpostata e sessioni revocate"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Reset non riuscito."); }
  }

  async function toggleTenantModule(key: ModuleKey, enabled: boolean) {
    if (!selected) return; setPendingModule(key);
    try { await platformRequest(`/api/platform/salons/${selected.id}/modules/${key}`, { method: "PATCH", body: JSON.stringify({ enabled }) }); setTenantModules((current) => ({ ...current, [key]: enabled })); setNotice(`${enabled ? "Attivato" : "Disattivato"} ${moduleCatalog.find((item) => item.key === key)?.label}`); await loadData(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Modulo non aggiornato."); } finally { setPendingModule(null); }
  }

  async function removeTenant() {
    if (!selected) return;
    try { await platformRequest(`/api/platform/salons/${selected.id}?confirmation=${encodeURIComponent(deleteConfirmation.trim())}`, { method: "DELETE" }); setSelected(null); setDeleteConfirmation(""); await loadData(); setNotice("Salone eliminato definitivamente"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Eliminazione non riuscita."); }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await platformRequest("/api/platform/plans", { method: "POST", body: JSON.stringify({ name: form.get("name"), code: form.get("code"), description: form.get("description") }) }); setNewPlanOpen(false); await loadData(); setNotice("Piano creato"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Piano non creato."); }
  }

  async function toggleGlobalModule(item: PlatformModule) {
    try { await platformRequest("/api/platform/module-catalog", { method: "PUT", body: JSON.stringify({ module_key: item.moduleKey, name: item.name, description: item.description, default_enabled: item.defaultEnabled, globally_enabled: !item.globallyEnabled }) }); await loadData(); setNotice("Catalogo moduli aggiornato"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Modulo non aggiornato."); }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await platformRequest("/api/platform/system-templates", { method: "PUT", body: JSON.stringify({ active: form.get("active") === "on", key: form.get("key"), channel: form.get("channel"), subject: form.get("subject"), body: form.get("body") }) }); setTemplateEditor(null); await loadData(); setNotice("Template salvato"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Template non salvato."); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><div className="flex items-center gap-3 text-sm font-semibold text-[#66726f]"><RefreshCw className="size-5 animate-spin" /> Caricamento control plane</div></div>;

  if (!session) return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]"><section className="hidden overflow-hidden bg-[#102b27] p-14 text-white lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#25a77e] font-black">E</span><div><b className="block">EsseBeauty</b><span className="text-xs text-white/55">Platform control plane</span></div></div><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#68d4b2]">Amministrazione centrale</p><h1 className="mt-5 text-5xl font-extrabold leading-[1.04]">Ogni salone sotto controllo, senza rumore.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-white/65">Tenant, accessi, licenze, moduli e configurazione globale in uno spazio separato dal gestionale operativo.</p></div><div className="grid grid-cols-3 gap-3 text-xs text-white/55"><span>Isolato</span><span>Tracciato</span><span>Multi-tenant</span></div></section><section className="grid place-items-center bg-white p-6"><form className="w-full max-w-sm" onSubmit={authenticate}><span className="grid size-12 place-items-center rounded-xl bg-[#e8f5f0] text-[#16745c]"><ShieldCheck /></span><h1 className="mt-6 text-3xl font-extrabold">{bootstrapRequired ? "Configura Platform" : "Accedi a Platform"}</h1><p className="mt-2 text-sm leading-6 text-[#66726f]">Accesso riservato agli amministratori della piattaforma.</p>{error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<div className="mt-7 grid gap-4">{bootstrapRequired && <Field label="Nome amministratore"><input className="platform-input" name="full_name" required /></Field>}<Field label="Email"><input autoComplete="email" className="platform-input" name="email" required type="email" /></Field><Field label="Password"><input autoComplete="current-password" className="platform-input" minLength={10} name="password" required type="password" /></Field><Button className="mt-2 w-full" type="submit">{bootstrapRequired ? "Crea amministratore" : "Accedi"}<ArrowRight className="size-4" /></Button></div></form></section></main>;

  const currentTitle = nav.find((item) => item.view === view)?.label ?? "Platform";

  return <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
    {mobileNav && <button aria-label="Chiudi navigazione" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-[#132a26] text-white transition-transform lg:sticky lg:top-0 lg:h-screen ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}><div className="flex h-20 items-center gap-3 border-b border-white/10 px-5"><span className="grid size-10 place-items-center rounded-xl bg-[#2aa47f] font-black shadow-lg shadow-black/15">E</span><div><b className="block text-sm">EsseBeauty</b><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#71cbb0]">Platform</span></div></div><nav className="flex-1 space-y-1 p-3">{nav.map((item) => { const Icon = item.icon; const active = view === item.view; return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-white text-[#132a26] shadow" : "text-white/65 hover:bg-white/8 hover:text-white"}`} key={item.view} onClick={() => { setView(item.view); setMobileNav(false); }} type="button"><Icon className="size-[18px]" />{item.label}{active && <ChevronRight className="ml-auto size-4" />}</button>; })}</nav><div className="border-t border-white/10 p-4"><div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-white/10 text-xs font-black">{session.admin.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="min-w-0"><b className="block truncate text-xs">{session.admin.full_name}</b><span className="block truncate text-[10px] text-white/50">{session.admin.email}</span></div></div><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-white/55 hover:bg-white/8 hover:text-white" onClick={() => void logout()} type="button"><LogOut className="size-4" /> Esci</button></div></aside>
    <main className="min-w-0"><header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#dce3e0] bg-white/92 px-4 backdrop-blur lg:px-7"><button className="grid size-9 place-items-center rounded-lg border border-[#dce3e0] lg:hidden" onClick={() => setMobileNav(true)} type="button"><Menu className="size-4" /></button><div className="min-w-0"><h1 className="truncate text-lg font-extrabold">{currentTitle}</h1><p className="hidden text-[11px] text-[#78827f] sm:block">Control plane multi-tenant</p></div><div className="ml-auto flex items-center gap-2"><Button onClick={() => void refresh()} variant="secondary"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Aggiorna</span></Button><Button onClick={() => setNewTenantOpen(true)}><Plus className="size-4" /> Nuovo salone</Button></div></header>
      <div className="mx-auto max-w-[1500px] p-4 lg:p-7">{error && <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><CircleAlert className="size-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError("")}><X className="size-4" /></button></div>}
        {view === "overview" && <Overview overview={overview} salons={salons} onNew={() => setNewTenantOpen(true)} onOpen={(salon) => void openTenant(salon)} />}
        {view === "tenants" && <Tenants query={query} salons={filteredSalons} setQuery={setQuery} onOpen={(salon) => void openTenant(salon)} />}
        {view === "plans" && <Plans plans={plans} onNew={() => setNewPlanOpen(true)} />}
        {view === "modules" && <Modules items={globalModules} onToggle={(item) => void toggleGlobalModule(item)} />}
        {view === "templates" && <Templates items={templates} onEdit={setTemplateEditor} />}
        {view === "audit" && <Audit items={audit} />}
      </div>
    </main>
    {selected && <TenantDrawer confirmation={deleteConfirmation} modules={tenantModules} owner={owner} pendingModule={pendingModule} plans={plans} salon={selected} setConfirmation={setDeleteConfirmation} tab={tenantTab} onClose={() => setSelected(null)} onDelete={() => void removeTenant()} onResetPassword={resetPassword} onSave={saveTenant} onSaveOwner={saveOwner} onTab={setTenantTab} onToggleModule={(key, value) => void toggleTenantModule(key, value)} />}
    {newTenantOpen && <Modal onClose={() => setNewTenantOpen(false)} title="Crea un nuovo salone"><form className="grid gap-4 sm:grid-cols-2" onSubmit={createTenant}><Field label="Nome salone"><input className="platform-input" name="name" onChange={(event) => { const slug = event.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement | null; if (slug && !slug.dataset.edited) slug.value = slugify(event.currentTarget.value); }} required /></Field><Field hint="Identificativo pubblico univoco" label="Slug"><input className="platform-input" name="slug" onChange={(event) => { event.currentTarget.dataset.edited = "true"; }} required /></Field><Field label="Fuso orario"><input className="platform-input" defaultValue="Europe/Rome" name="timezone" required /></Field><div /><div className="mt-2 border-t border-[#e1e7e4] pt-5 sm:col-span-2"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#16745c]">Accesso titolare</p></div><Field label="Nome e cognome"><input className="platform-input" name="owner_name" required /></Field><Field label="Email"><input className="platform-input" name="owner_email" required type="email" /></Field><div className="sm:col-span-2"><Field hint="Minimo 10 caratteri; sarà richiesto il cambio al primo accesso" label="Password iniziale"><input className="platform-input" minLength={10} name="owner_password" required type="password" /></Field></div><div className="mt-2 flex justify-end gap-2 sm:col-span-2"><Button onClick={() => setNewTenantOpen(false)} variant="secondary">Annulla</Button><Button type="submit"><Plus className="size-4" /> Crea salone</Button></div></form></Modal>}
    {newPlanOpen && <Modal onClose={() => setNewPlanOpen(false)} title="Nuovo piano commerciale"><form className="grid gap-4" onSubmit={createPlan}><Field label="Nome"><input className="platform-input" name="name" required /></Field><Field hint="Codice breve, per esempio PRO" label="Codice"><input className="platform-input" name="code" required /></Field><Field label="Descrizione"><textarea className="platform-input" name="description" /></Field><div className="flex justify-end gap-2"><Button onClick={() => setNewPlanOpen(false)} variant="secondary">Annulla</Button><Button type="submit">Crea piano</Button></div></form></Modal>}
    {templateEditor && <TemplateModal item={templateEditor === "new" ? null : templateEditor} onClose={() => setTemplateEditor(null)} onSubmit={saveTemplate} />}
    {notice && <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-xl bg-[#123d34] px-4 py-3 text-sm font-semibold text-white shadow-xl"><Check className="size-4 text-[#7ee2c1]" />{notice}</div>}
  </div>;
}

function Overview({ onNew, onOpen, overview, salons }: { onNew(): void; onOpen(salon: PlatformSalon): void; overview: PlatformOverview | null; salons: PlatformSalon[] }) {
  const metrics = overview ?? { appointments: 0, campaigns: 0, module_usage: [], salons: { active: 0, churnRisk: 0, suspended: 0, total: 0, trial: 0 }, sessions: 0 };
  const attention = salons.filter((salon) => salon.platform_status === "suspended" || salon.platform_status === "churn_risk" || !salon.onboarding_completed);
  return <div className="platform-view space-y-6"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#16745c]">Situazione generale</p><h2 className="mt-2 text-3xl font-extrabold">Il polso della piattaforma</h2><p className="mt-2 text-sm text-[#66726f]">Tenant, utilizzo e segnali operativi aggiornati.</p></div><Button onClick={onNew}><Plus className="size-4" /> Attiva un tenant</Button></section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric detail={`${metrics.salons.active} operativi`} icon={Store} label="Saloni" value={metrics.salons.total} /><Metric detail="Sessioni utente aperte" icon={UsersRound} label="Sessioni" value={metrics.sessions} /><Metric detail="Volume complessivo" icon={CalendarClock} label="Appuntamenti" value={metrics.appointments} /><Metric detail="Campagne create" icon={Mail} label="Marketing" value={metrics.campaigns} /></div><div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="platform-card overflow-hidden"><header className="flex items-center justify-between border-b border-[#e1e7e4] px-5 py-4"><div><h3 className="font-extrabold">Tenant recenti</h3><p className="mt-1 text-xs text-[#78827f]">Accesso rapido alle configurazioni</p></div></header><div className="divide-y divide-[#edf0ef]">{salons.slice(0, 6).map((salon) => <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#f8faf9]" key={salon.id} onClick={() => onOpen(salon)}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf5f1] font-extrabold text-[#16745c]">{salon.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{salon.name}</b><span className="text-xs text-[#78827f]">{salon.plan_id || "Nessun piano"} · {salon.modules_enabled} moduli</span></div><Status status={salon.platform_status} /><ChevronRight className="size-4 text-[#9aa5a1]" /></button>)}{!salons.length && <p className="p-8 text-center text-sm text-[#78827f]">Nessun salone presente.</p>}</div></section><section className="platform-card p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert className="size-5" /></span><div><h3 className="font-extrabold">Da gestire</h3><p className="text-xs text-[#78827f]">Azioni che richiedono attenzione</p></div></div><div className="mt-5 space-y-3">{attention.slice(0, 5).map((salon) => <button className="flex w-full items-center gap-3 rounded-xl border border-[#e1e7e4] p-3 text-left hover:border-[#91afa6]" key={salon.id} onClick={() => onOpen(salon)}><div className="min-w-0 flex-1"><b className="block truncate text-sm">{salon.name}</b><span className="text-xs text-[#78827f]">{!salon.onboarding_completed ? `Onboarding ${salon.onboarding_step}/5` : "Controlla stato tenant"}</span></div><ChevronRight className="size-4" /></button>)}{!attention.length && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Nessuna criticità aperta.</div>}</div></section></div></div>;
}

function Tenants({ onOpen, query, salons, setQuery }: { onOpen(salon: PlatformSalon): void; query: string; salons: PlatformSalon[]; setQuery(value: string): void }) {
  return <div className="platform-view space-y-5"><div><h2 className="text-3xl font-extrabold">Saloni</h2><p className="mt-2 text-sm text-[#66726f]">Gestisci licenze, accessi e configurazione di ogni tenant.</p></div><div className="platform-card overflow-hidden"><div className="flex items-center gap-3 border-b border-[#e1e7e4] p-4"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b9692]" /><input className="platform-input pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca salone, slug o piano" value={query} /></div><span className="text-xs font-semibold text-[#78827f]">{salons.length} risultati</span></div><div className="platform-scrollbar overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left"><thead className="bg-[#f7f9f8] text-[10px] font-extrabold uppercase tracking-[.12em] text-[#78827f]"><tr><th className="px-5 py-3">Salone</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Piano</th><th className="px-4 py-3">Onboarding</th><th className="px-4 py-3">Moduli</th><th className="px-4 py-3">Aggiornato</th><th /></tr></thead><tbody className="divide-y divide-[#edf0ef]">{salons.map((salon) => <tr className="group hover:bg-[#f8faf9]" key={salon.id}><td className="px-5 py-4"><button className="text-left" onClick={() => onOpen(salon)}><b className="block text-sm">{salon.name}</b><span className="text-xs text-[#78827f]">/{salon.slug}</span></button></td><td className="px-4 py-4"><Status status={salon.platform_status} /></td><td className="px-4 py-4 text-sm font-semibold">{salon.plan_id || "—"}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e4e9e7]"><span className="block h-full bg-[#38a681]" style={{ width: `${salon.onboarding_completed ? 100 : salon.onboarding_step * 20}%` }} /></div><span className="text-xs text-[#78827f]">{salon.onboarding_completed ? "Completo" : `${salon.onboarding_step}/5`}</span></div></td><td className="px-4 py-4 text-sm">{salon.modules_enabled}</td><td className="px-4 py-4 text-xs text-[#66726f]">{date(salon.updated_at)}</td><td className="px-4 py-4"><button className="grid size-8 place-items-center rounded-lg text-[#78827f] group-hover:bg-white group-hover:text-[#16745c]" onClick={() => onOpen(salon)}><ChevronRight className="size-4" /></button></td></tr>)}</tbody></table>{!salons.length && <p className="p-12 text-center text-sm text-[#78827f]">Nessun salone corrisponde alla ricerca.</p>}</div></div></div>;
}

function Plans({ onNew, plans }: { onNew(): void; plans: PlatformPlan[] }) {
  return <div className="platform-view space-y-5"><div className="flex items-end justify-between gap-4"><div><h2 className="text-3xl font-extrabold">Piani commerciali</h2><p className="mt-2 text-sm text-[#66726f]">Offerta, limiti e moduli inclusi per i tenant.</p></div><Button onClick={onNew}><Plus className="size-4" /> Nuovo piano</Button></div><div className="grid gap-4 lg:grid-cols-3">{plans.map((plan) => <article className="platform-card flex min-h-56 flex-col p-5" key={plan.id}><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf7f3] text-[#16745c]"><CreditCard className="size-5" /></span><span className={`size-2.5 rounded-full ${plan.active ? "bg-emerald-500" : "bg-[#cbd4d1]"}`} /></div><h3 className="mt-5 text-xl font-extrabold">{plan.name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-[#16745c]">{plan.code}</p><p className="mt-3 flex-1 text-sm leading-6 text-[#66726f]">{plan.description || "Nessuna descrizione commerciale."}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf0ef] pt-4 text-xs"><span>{plan.includedModules.length} moduli inclusi</span><span className="font-semibold">{plan.active ? "Disponibile" : "Non attivo"}</span></div></article>)}{!plans.length && <button className="platform-card grid min-h-56 place-items-center border-dashed text-sm font-semibold text-[#66726f] hover:border-[#72a998]" onClick={onNew}><span className="grid justify-items-center gap-3"><Plus className="size-6" /> Crea il primo piano</span></button>}</div></div>;
}

function Modules({ items, onToggle }: { items: PlatformModule[]; onToggle(item: PlatformModule): void }) {
  const resolved = moduleCatalog.map((definition) => ({ definition, item: items.find((item) => item.moduleKey === definition.key) }));
  return <div className="platform-view space-y-5"><div><h2 className="text-3xl font-extrabold">Catalogo moduli</h2><p className="mt-2 text-sm text-[#66726f]">Disponibilità globale delle applicazioni vendute ai saloni.</p></div><div className="platform-card divide-y divide-[#edf0ef]">{resolved.map(({ definition, item }) => <div className="flex items-center gap-4 p-5" key={definition.key}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf7f3] text-[#16745c]"><AppWindow className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold">{item?.name || definition.label}</h3><p className="mt-1 text-xs text-[#78827f]">{item?.description || definition.description}</p></div><div className="hidden text-right sm:block"><span className="block text-xs font-semibold">Default tenant</span><span className="text-[11px] text-[#78827f]">{item?.defaultEnabled ? "Attivo" : "Non attivo"}</span></div><Toggle checked={item?.globallyEnabled ?? true} onChange={() => onToggle(item ?? { defaultEnabled: false, description: definition.description, globallyEnabled: true, moduleKey: definition.key, name: definition.label })} /></div>)}</div></div>;
}

function Templates({ items, onEdit }: { items: PlatformTemplate[]; onEdit(item: PlatformTemplate | "new"): void }) {
  return <div className="platform-view space-y-5"><div className="flex items-end justify-between gap-4"><div><h2 className="text-3xl font-extrabold">Template di sistema</h2><p className="mt-2 text-sm text-[#66726f]">Messaggi centrali per email, WhatsApp, push e notifiche in-app.</p></div><Button onClick={() => onEdit("new")}><Plus className="size-4" /> Nuovo template</Button></div><div className="platform-card overflow-hidden"><div className="divide-y divide-[#edf0ef]">{items.map((item) => <button className="flex w-full items-center gap-4 p-5 text-left hover:bg-[#f8faf9]" key={item.id} onClick={() => onEdit(item)}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0f4f2] text-[#52625e]"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="truncate text-sm">{item.key}</b><span className="rounded-md bg-[#edf7f3] px-2 py-0.5 text-[10px] font-bold uppercase text-[#16745c]">{item.channel}</span></div><p className="mt-1 truncate text-xs text-[#78827f]">{item.subject || item.body}</p></div><span className={`text-xs font-semibold ${item.active ? "text-emerald-700" : "text-[#9aa5a1]"}`}>{item.active ? "Attivo" : "Disattivo"}</span><ChevronRight className="size-4 text-[#9aa5a1]" /></button>)}{!items.length && <p className="p-12 text-center text-sm text-[#78827f]">Nessun template configurato.</p>}</div></div></div>;
}

function Audit({ items }: { items: PlatformAuditItem[] }) {
  return <div className="platform-view space-y-5"><div><h2 className="text-3xl font-extrabold">Registro attività</h2><p className="mt-2 text-sm text-[#66726f]">Traccia immutabile delle operazioni amministrative.</p></div><div className="platform-card overflow-hidden"><div className="divide-y divide-[#edf0ef]">{items.map((item) => <div className="flex gap-4 p-5" key={item.id}><span className="mt-1 size-2 shrink-0 rounded-full bg-[#38a681]" /><div className="min-w-0 flex-1"><b className="block text-sm">{item.summary}</b><p className="mt-1 text-xs text-[#78827f]">{item.action} · {item.targetType}</p></div><time className="shrink-0 text-xs text-[#78827f]">{date(item.createdAt, true)}</time></div>)}{!items.length && <p className="p-12 text-center text-sm text-[#78827f]">Nessuna attività registrata.</p>}</div></div></div>;
}

function TenantDrawer({ confirmation, modules, onClose, onDelete, onResetPassword, onSave, onSaveOwner, onTab, onToggleModule, owner, pendingModule, plans, salon, setConfirmation, tab }: {
  confirmation: string; modules: ModuleState; onClose(): void; onDelete(): void; onResetPassword(event: FormEvent<HTMLFormElement>): void; onSave(event: FormEvent<HTMLFormElement>): void; onSaveOwner(event: FormEvent<HTMLFormElement>): void; onTab(tab: TenantTab): void; onToggleModule(key: ModuleKey, enabled: boolean): void; owner: SalonOwner | null; pendingModule: ModuleKey | null; plans: PlatformPlan[]; salon: PlatformSalon; setConfirmation(value: string): void; tab: TenantTab;
}) {
  const tabs: Array<{ icon: typeof Gauge; label: string; value: TenantTab }> = [{ icon: Settings2, label: "Profilo", value: "profile" }, { icon: UserRoundCog, label: "Titolare", value: "owner" }, { icon: PackageOpen, label: "Moduli", value: "modules" }, { icon: Trash2, label: "Elimina", value: "danger" }];
  return <><button aria-label="Chiudi dettaglio tenant" className="fixed inset-0 z-40 bg-[#10201d]/35 backdrop-blur-[1px]" onClick={onClose} /><aside className="platform-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col bg-[#f5f7f6] shadow-2xl"><header className="border-b border-[#dce3e0] bg-white"><div className="flex items-start gap-4 px-6 py-5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e8f5f0] text-lg font-extrabold text-[#16745c]">{salon.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-extrabold">{salon.name}</h2><Status status={salon.platform_status} /></div><p className="mt-1 text-xs text-[#78827f]">/{salon.slug} · {salon.plan_id || "Nessun piano"}</p></div><button className="grid size-9 place-items-center rounded-lg border border-[#dce3e0] hover:bg-[#f3f5f4]" onClick={onClose}><X className="size-4" /></button></div><nav className="flex gap-1 overflow-x-auto px-5">{tabs.map((item) => { const Icon = item.icon; return <button className={`flex items-center gap-2 border-b-2 px-3 pb-3 text-xs font-bold ${tab === item.value ? "border-[#16745c] text-[#16745c]" : "border-transparent text-[#78827f]"}`} key={item.value} onClick={() => onTab(item.value)}><Icon className="size-4" />{item.label}</button>; })}</nav></header><div className="platform-scrollbar flex-1 overflow-y-auto p-5 lg:p-6">{tab === "profile" && <form className="platform-card grid gap-4 p-5 sm:grid-cols-2" key={salon.id} onSubmit={onSave}><div className="sm:col-span-2"><h3 className="text-lg font-extrabold">Configurazione tenant</h3><p className="mt-1 text-xs text-[#78827f]">Identità, licenza e ciclo di vita del salone.</p></div><Field label="Nome salone"><input className="platform-input" defaultValue={salon.name} name="name" required /></Field><Field label="Slug"><input className="platform-input" defaultValue={salon.slug} name="slug" required /></Field><Field label="Piano commerciale"><select className="platform-input" defaultValue={salon.plan_id ?? ""} name="plan_id"><option value="">Nessun piano</option>{plans.map((plan) => <option key={plan.id} value={plan.code}>{plan.name}</option>)}</select></Field><Field label="Stato tenant"><select className="platform-input" defaultValue={salon.platform_status} name="status"><option value="active">Operativo</option><option value="trial">In prova</option><option value="churn_risk">Da seguire</option><option value="suspended">Sospeso</option></select></Field><Field label="Fine prova"><input className="platform-input" defaultValue={salon.trial_ends_at?.slice(0, 10) ?? ""} name="trial_ends_at" type="date" /></Field><Field label="Fuso orario"><input className="platform-input" defaultValue={salon.timezone} name="timezone" required /></Field><Field label="Lingua"><select className="platform-input" defaultValue={salon.locale} name="locale"><option value="it-IT">Italiano</option><option value="en-GB">English</option></select></Field><div className="sm:col-span-2 flex justify-end border-t border-[#edf0ef] pt-4"><Button type="submit">Salva configurazione</Button></div></form>}{tab === "owner" && <div className="space-y-4">{owner ? <form className="platform-card grid gap-4 p-5 sm:grid-cols-2" key={owner.id} onSubmit={onSaveOwner}><div className="sm:col-span-2"><h3 className="text-lg font-extrabold">Account titolare</h3><p className="mt-1 text-xs text-[#78827f]">Ultimo accesso: {date(owner.last_login, true)}</p></div><Field label="Nome e cognome"><input className="platform-input" defaultValue={owner.full_name} name="full_name" required /></Field><Field label="Email"><input className="platform-input" defaultValue={owner.email} name="email" required type="email" /></Field><label className="flex items-center gap-3 text-sm font-semibold"><input defaultChecked={owner.active} name="active" type="checkbox" /> Account abilitato</label><div className="flex justify-end"><Button type="submit">Salva titolare</Button></div></form> : <div className="platform-card p-8 text-center text-sm text-[#78827f]">Caricamento titolare...</div>}<form className="platform-card grid gap-4 p-5" onSubmit={onResetPassword}><div><h3 className="text-lg font-extrabold">Reimposta password</h3><p className="mt-1 text-xs text-[#78827f]">Revoca tutte le sessioni e impone il cambio al prossimo accesso.</p></div><Field label="Password temporanea"><input className="platform-input" minLength={10} name="password" required type="password" /></Field><div className="flex justify-end"><Button type="submit" variant="secondary"><KeyRound className="size-4" /> Reimposta</Button></div></form></div>}{tab === "modules" && <div className="platform-card divide-y divide-[#edf0ef]">{moduleCatalog.map((item) => <div className="flex items-center gap-4 p-4" key={item.key}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf7f3] text-[#16745c]"><Sparkles className="size-4" /></span><div className="min-w-0 flex-1"><b className="block text-sm">{item.label}</b><span className="text-xs text-[#78827f]">{item.description}</span></div><Toggle checked={modules[item.key]} disabled={pendingModule === item.key} onChange={(value) => onToggleModule(item.key, value)} /></div>)}</div>}{tab === "danger" && <section className="platform-card border-rose-200 p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><Trash2 className="size-5" /></span><div><h3 className="text-lg font-extrabold text-rose-800">Elimina definitivamente il tenant</h3><p className="mt-2 text-sm leading-6 text-[#66726f]">Verranno eliminati il salone e tutti i dati collegati. L’operazione non è reversibile.</p></div></div><div className="mt-6"><Field hint={`Scrivi esattamente “${salon.slug}”`} label="Conferma eliminazione"><input autoComplete="off" className="platform-input" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></Field></div><div className="mt-4 flex justify-end"><Button disabled={confirmation !== salon.slug} onClick={onDelete} variant="danger"><Trash2 className="size-4" /> Elimina salone e dati</Button></div></section>}</div></aside></>;
}

function TemplateModal({ item, onClose, onSubmit }: { item: PlatformTemplate | null; onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return <Modal onClose={onClose} title={item ? "Modifica template" : "Nuovo template"}><form className="grid gap-4" key={item?.id ?? "new"} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Field label="Chiave"><input className="platform-input" defaultValue={item?.key ?? ""} name="key" readOnly={Boolean(item)} required /></Field><Field label="Canale"><select className="platform-input" defaultValue={item?.channel ?? "email"} name="channel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="push">Push</option><option value="in_app">In-app</option></select></Field></div><Field label="Oggetto"><input className="platform-input" defaultValue={item?.subject ?? ""} name="subject" /></Field><Field label="Contenuto"><textarea className="platform-input" defaultValue={item?.body ?? ""} name="body" required /></Field><label className="flex items-center gap-3 text-sm font-semibold"><input defaultChecked={item?.active ?? true} name="active" type="checkbox" /> Template attivo</label><div className="flex justify-end gap-2"><Button onClick={onClose} variant="secondary">Annulla</Button><Button type="submit">Salva template</Button></div></form></Modal>;
}
