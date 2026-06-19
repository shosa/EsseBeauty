"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PERMISSION_KEYS, type UserRole } from "@esse-beauty/shared";
import { AppPage, Badge, InlineError, PageHeader, PageTransition, Switch } from "@esse-beauty/ui";

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
    const response = await fetch(`${apiBaseUrl}/api/auth/users/${userId}`, {
      body: JSON.stringify({ active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) return;
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, active } : user));
  }

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageTransition>
        <PageHeader actions={canManageUsers ? <Link href="/settings/users/invite" className="rounded-xl bg-stone-950 px-5 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5">Invita utente</Link> : undefined} eyebrow="Accessi" title="Utenti e accessi" subtitle="Gestisci ruoli, stato account e permessi individuali." />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? (
          <p>Caricamento...</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm ring-1 ring-stone-950/5">
            <table className="w-full text-left">
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
                      <Switch aria-label={`Stato account ${user.full_name}`} checked={user.active} disabled={!canManageUsers} onCheckedChange={(active) => void setActive(user.id, active)} />
                    </td>
                    <td className="p-4 text-right">
                      {canManageUsers ? <Link className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold hover:border-[#792f59] hover:text-[#792f59]" href={`/settings/users/${user.id}`}>Apri scheda</Link> : <span className="text-sm text-neutral-400">Sola lettura</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageTransition>
    </AppPage>
  );
}
