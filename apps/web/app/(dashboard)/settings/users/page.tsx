"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  PERMISSION_KEYS,
  type UserRole,
} from "@esse-beauty/shared";
import { Badge, Switch } from "@esse-beauty/ui";

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const canManageUsers = hasPermission(PERMISSION_KEYS.SETTINGS_USERS);

  async function loadUsers() {
    setLoading(true);
    setError("");
    await fetch(`${apiBaseUrl}/api/auth/users`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Impossibile caricare gli utenti.");
        }
        setUsers((await response.json()) as UserListItem[]);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void loadUsers(); }, []);

  async function invite(formData: FormData) {
    setError("");
    setTemporaryPassword("");
    const response = await fetch(`${apiBaseUrl}/api/auth/invite`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        full_name: formData.get("full_name"),
        role: formData.get("role"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError("L'utente non è stato creato. Verifica che l'email non sia già in uso.");
      return;
    }
    setTemporaryPassword(result.temporary_password ?? "");
    setInviteOpen(false);
    await loadUsers();
  }

  async function setActive(userId: string, active: boolean) {
    const response = await fetch(
      `${apiBaseUrl}/api/auth/users/${userId}`,
      {
        body: JSON.stringify({ active }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    if (!response.ok) {
      return;
    }
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, active } : user,
      ),
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Utenti e accessi</h1>
        <p className="mt-2 text-neutral-600">Gestisci ruoli, stato account e permessi individuali.</p></div>
        <button disabled={!canManageUsers} onClick={() => setInviteOpen(true)} className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">Invita utente</button>
      </div>
      {error && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {temporaryPassword && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><b>Utente creato.</b> Password temporanea: <code className="ml-1 rounded bg-white px-2 py-1 font-bold">{temporaryPassword}</code><p className="mt-2">Copiala ora: viene mostrata una sola volta.</p></div>}

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
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
                <tr className="border-t border-neutral-200" key={user.id}>
                  <td className="p-4">
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-neutral-500">{user.email}</div>
                  </td>
                  <td className="p-4">
                    <Badge variant="muted">{user.role}</Badge>
                  </td>
                  <td className="p-4 text-sm text-neutral-600">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleString("it-IT")
                      : "Mai"}
                  </td>
                  <td className="p-4">
                    <Switch
                      aria-label={`Stato account ${user.full_name}`}
                      checked={user.active}
                      disabled={!canManageUsers}
                      onCheckedChange={(active) =>
                        void setActive(user.id, active)
                      }
                    />
                  </td>
                  <td className="p-4 text-right">
                    {canManageUsers ? (
                      <Link
                        className="font-medium underline"
                        href={`/settings/users/${user.id}`}
                      >
                        Modifica
                      </Link>
                    ) : (
                      <span className="text-sm text-neutral-400">
                        Sola lettura
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inviteOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"><form action={invite} className="grid w-full max-w-lg gap-4 rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#792f59]">Nuovo accesso</p><h2 className="mt-1 text-xl font-bold">Invita un utente</h2></div><button type="button" onClick={() => setInviteOpen(false)}>Chiudi</button></div><label className="text-sm font-semibold">Nome completo<input required name="full_name" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Email<input required type="email" name="email" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Ruolo<select name="role" defaultValue="employee" className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"><option value="manager">Manager</option><option value="receptionist">Receptionist</option><option value="employee">Dipendente</option></select></label><button className="min-h-11 rounded-xl bg-[#402334] font-bold text-white">Crea utente</button></form></div>}
    </main>
  );
}
