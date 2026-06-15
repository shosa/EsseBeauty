"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_PERMISSIONS,
  PERMISSION_KEYS,
  type PermissionKey,
  type UserRole,
} from "@esse-beauty/shared";
import { Badge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

interface PermissionOverride {
  granted: boolean;
  permission_key: string;
}

interface UserItem {
  active: boolean;
  email: string;
  full_name: string;
  id: string;
  permission_overrides: PermissionOverride[];
  role: UserRole;
}

interface PermissionDefinition {
  description: string;
  key: PermissionKey;
  label: string;
}

function permissionDefinitions(
  entries: Array<[PermissionKey, string, string]>,
): PermissionDefinition[] {
  return entries.map(([key, label, description]) => ({
    description,
    key,
    label,
  }));
}

const groups: Array<{
  name: string;
  permissions: PermissionDefinition[];
}> = [
  {
    name: "Calendario",
    permissions: permissionDefinitions([
      [PERMISSION_KEYS.CALENDAR_VIEW_OWN, "Vede il proprio calendario", "Visualizza gli appuntamenti assegnati"],
      [PERMISSION_KEYS.CALENDAR_MANAGE_OWN, "Gestisce il proprio calendario", "Crea, modifica e annulla i propri appuntamenti"],
      [PERMISSION_KEYS.CALENDAR_VIEW_OTHERS, "Vede gli altri calendari", "Consulta gli appuntamenti degli altri collaboratori"],
      [PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS, "Gestisce gli altri calendari", "Crea e modifica appuntamenti per altri collaboratori"],
      [PERMISSION_KEYS.CALENDAR_DELETE, "Elimina appuntamenti", "Rimuove definitivamente qualsiasi appuntamento"],
    ]),
  },
  {
    name: "Clienti",
    permissions: permissionDefinitions([
      [PERMISSION_KEYS.CLIENTS_VIEW, "Visualizza clienti", "Apre elenco e profili cliente"],
      [PERMISSION_KEYS.CLIENTS_EDIT, "Modifica clienti", "Aggiorna dettagli e note"],
      [PERMISSION_KEYS.CLIENTS_BLOCK, "Blocca clienti", "Blocca e sblocca prenotazioni"],
    ]),
  },
  {
    name: "Report",
    permissions: permissionDefinitions([
      [PERMISSION_KEYS.REPORTS_VIEW_OWN, "Visualizza i propri report", "Consulta le proprie statistiche"],
      [PERMISSION_KEYS.REPORTS_VIEW_ALL, "Visualizza tutti i report", "Consulta dati staff e salone"],
      [PERMISSION_KEYS.REPORTS_EXPORT, "Esporta report", "Scarica dati in formato CSV"],
    ]),
  },
  {
    name: "Impostazioni",
    permissions: permissionDefinitions([
      [PERMISSION_KEYS.SETTINGS_SALON, "Impostazioni salone", "Modifica dettagli e politiche"],
      [PERMISSION_KEYS.SETTINGS_SERVICES, "Servizi e categorie", "Gestisce il catalogo servizi"],
      [PERMISSION_KEYS.SETTINGS_STAFF, "Profili staff", "Gestisce collaboratori e profili"],
      [PERMISSION_KEYS.SETTINGS_USERS, "Account e permessi", "Gestisce accessi e autorizzazioni"],
      [PERMISSION_KEYS.SETTINGS_MODULES, "Moduli", "Abilita e disabilita moduli"],
    ]),
  },
  {
    name: "Moduli",
    permissions: permissionDefinitions([
      [PERMISSION_KEYS.REVIEWS_REPLY, "Risponde alle recensioni", "Pubblica risposte alle recensioni"],
      [PERMISSION_KEYS.MARKETING_SEND, "Invia campagne", "Invia campagne email o SMS"],
      [PERMISSION_KEYS.INVENTORY_MANAGE, "Gestisce inventario", "Aggiorna prodotti e movimenti"],
      [PERMISSION_KEYS.WAITLIST_MANAGE, "Gestisce lista d'attesa", "Aggiorna e notifica le richieste"],
      [PERMISSION_KEYS.LOYALTY_MANAGE, "Gestisce punti fedelta", "Assegna o sottrae punti manualmente"],
    ]),
  },
];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function UserPermissionsPage() {
  const { hasPermission } = useAuth();
  const params = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserItem | null>(null);
  const canManageUsers = hasPermission(PERMISSION_KEYS.SETTINGS_USERS);

  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/auth/users`, {
      credentials: "include",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load user");
      }
      const users = (await response.json()) as UserItem[];
      setUser(users.find((item) => item.id === params.userId) ?? null);
    });
  }, [params.userId]);

  const overrides = useMemo(
    () =>
      new Map(
        user?.permission_overrides.map((override) => [
          override.permission_key,
          override.granted,
        ]) ?? [],
      ),
    [user],
  );

  async function updatePermission(
    permission: PermissionKey,
    granted: boolean,
  ) {
    if (!user) {
      return;
    }
    const response = await fetch(
      `${apiBaseUrl}/api/auth/users/${user.id}/permissions`,
      {
        body: JSON.stringify({
          granted,
          permission_key: permission,
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    if (!response.ok) {
      return;
    }
    setUser({
      ...user,
      permission_overrides: [
        ...user.permission_overrides.filter(
          (override) => override.permission_key !== permission,
        ),
        { granted, permission_key: permission },
      ],
    });
  }

  if (!user) {
    return <main className="p-8">Caricamento...</main>;
  }

  const defaults = new Set(DEFAULT_PERMISSIONS[user.role]);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{user.full_name}</h1>
          <p className="mt-2 text-neutral-600">{user.email}</p>
        </div>
        <Badge variant="muted">{user.role}</Badge>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section
            className="rounded-xl border border-neutral-200 bg-white"
            key={group.name}
          >
            <h2 className="border-b border-neutral-200 px-5 py-4 text-lg font-semibold">
              {group.name}
            </h2>
            <div className="divide-y divide-neutral-100">
              {group.permissions.map((permission) => {
                const override = overrides.get(permission.key);
                const isOverride = override !== undefined;
                const checked = isOverride
                  ? override
                  : defaults.has(permission.key);

                return (
                  <div
                    className={`flex items-center justify-between gap-6 p-5 ${
                      isOverride ? "" : "text-neutral-500"
                    }`}
                    key={permission.key}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{permission.label}</h3>
                        <Badge variant={isOverride ? "override" : "muted"}>
                          {isOverride ? "Override" : "Default"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm">{permission.description}</p>
                    </div>
                    <Switch
                      aria-label={permission.label}
                      checked={checked}
                      disabled={!canManageUsers}
                      onCheckedChange={(granted) =>
                        void updatePermission(permission.key, granted)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
