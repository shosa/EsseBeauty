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
  const canManageUsers = hasPermission(PERMISSION_KEYS.SETTINGS_USERS);

  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/auth/users`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load users");
        }
        setUsers((await response.json()) as UserListItem[]);
      })
      .finally(() => setLoading(false));
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Utenti e accessi</h1>
        <p className="mt-2 text-neutral-600">
          Gestisci ruoli, stato account e permessi individuali.
        </p>
      </div>

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
    </main>
  );
}
