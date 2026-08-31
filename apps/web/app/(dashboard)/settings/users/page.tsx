"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PERMISSION_KEYS, type UserRole } from "@esse-beauty/shared";
import { AppPage, Badge, EmptyState, InlineError, PageHeader, PageTransition, SaveToast, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

interface PermissionOverride {
  granted: boolean;
  permission_key: string;
}

interface UserListItem {
  active: boolean;
  email: string;
  full_name: string;
  id: string;
  last_login: string | null;
  permission_overrides: PermissionOverride[];
  role: UserRole;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const canManageUsers = hasPermission(PERMISSION_KEYS.SETTINGS_USERS);

  async function loadUsers() {
    setLoading(true);
    setError("");
    const response = await fetch(`${apiBaseUrl}/api/auth/users`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare gli utenti.");
      setLoading(false);
      return;
    }
    setUsers(await response.json() as UserListItem[]);
    setLoading(false);
  }

  useEffect(() => { void loadUsers(); }, []);

  async function setActive(userId: string, active: boolean) {
    setUpdatingId(userId);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/users/${userId}`, {
        body: JSON.stringify({ active }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error("UPDATE_FAILED");
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, active } : user));
      setMessage(`Account ${active ? "attivato" : "disattivato"}.`);
    } catch {
      setError("Aggiornamento stato non riuscito. Riprova.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast visible={Boolean(message)}>{message}</SaveToast>
        <PageHeader actions={canManageUsers ? <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#792f59] px-4 py-2.5 font-semibold text-white hover:bg-[#66264b]" href="/settings/users/invite">Invita utente</Link> : undefined} eyebrow="Accessi" title="Utenti e accessi" subtitle="Gestisci ruoli, stato account e permessi individuali." />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        <p aria-live="polite" className="sr-only">{updatingId ? "Aggiornamento stato account in corso" : message}</p>
        {loading ? (
          <div aria-label="Caricamento utenti" className="h-56 animate-pulse rounded-2xl bg-stone-100" role="status" />
        ) : users.length === 0 ? (
          <EmptyState description="Invita il primo collaboratore per configurare accessi e permessi." title="Nessun utente configurato" />
        ) : (
          <div className="rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
            <div className="grid gap-3 p-3 md:hidden">
              {users.map((user) => (
                <article className="rounded-xl border border-stone-200 p-4" key={user.id}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-stone-950">{user.full_name}</h2><p className="truncate text-sm text-stone-500">{user.email}</p></div><Badge variant="muted">{user.role}</Badge></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-stone-500">Ultimo accesso</dt><dd className="mt-1 font-medium">{user.last_login ? new Date(user.last_login).toLocaleString("it-IT") : "Mai"}</dd></div><div><dt className="text-stone-500">Stato account</dt><dd className="mt-1">{user.active ? "Attivo" : "Disattivato"}</dd></div></dl>
                  <div className="mt-4 flex min-h-11 items-center justify-between border-t border-stone-100 pt-3"><Switch aria-label={`Stato account ${user.full_name}`} checked={user.active} disabled={!canManageUsers || updatingId === user.id} onCheckedChange={(active) => void setActive(user.id, active)} />{canManageUsers ? <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[#6f3556] hover:bg-[#faf3f7]" href={`/settings/users/${user.id}`}>Apri scheda</Link> : <span className="text-sm text-stone-500">Sola lettura</span>}</div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left">
              <thead className="bg-neutral-50 text-sm text-neutral-600">
                <tr>
                  <th className="p-4">Nome</th>
                  <th className="p-4">Ruolo</th>
                  <th className="p-4">Ultimo accesso</th>
                  <th className="p-4">Attivo</th>
                  <th className="p-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr className="border-t border-neutral-200 hover:bg-stone-50" key={user.id}>
                    <td className="p-4">
                      <div className="font-bold">{user.full_name}</div>
                      <div className="text-sm text-neutral-500">{user.email}</div>
                    </td>
                    <td className="p-4"><Badge variant="muted">{user.role}</Badge></td>
                    <td className="p-4 text-sm text-neutral-600">{user.last_login ? new Date(user.last_login).toLocaleString("it-IT") : "Mai"}</td>
                    <td className="p-4">
                      <Switch aria-label={`Stato account ${user.full_name}`} checked={user.active} disabled={!canManageUsers || updatingId === user.id} onCheckedChange={(active) => void setActive(user.id, active)} />
                    </td>
                    <td className="p-4 text-right">
                      {canManageUsers ? <Link className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold hover:border-[#792f59] hover:text-[#792f59]" href={`/settings/users/${user.id}`}>Apri scheda</Link> : <span className="text-sm text-neutral-400">Sola lettura</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </PageTransition>
    </AppPage>
  );
}
