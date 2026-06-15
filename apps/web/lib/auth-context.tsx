"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  PermissionKey,
  UserRole,
} from "@esse-beauty/shared";

interface AuthUser {
  active: boolean;
  email: string;
  full_name: string;
  id: string;
  role: UserRole;
  salon_id: string;
}

interface Salon {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextValue {
  hasPermission(permission: PermissionKey): boolean;
  loading: boolean;
  permissions: PermissionKey[];
  salon: Salon | null;
  user: AuthUser | null;
}

interface MeResponse {
  permissions: PermissionKey[];
  salon: Salon;
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession(): Promise<void> {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        setSession(null);
        return;
      }
      setSession((await response.json()) as MeResponse);
    }

    void loadSession()
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const permissionSet = useMemo(
    () => new Set(session?.permissions ?? []),
    [session?.permissions],
  );
  const hasPermission = useCallback(
    (permission: PermissionKey) => permissionSet.has(permission),
    [permissionSet],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      hasPermission,
      loading,
      permissions: session?.permissions ?? [],
      salon: session?.salon ?? null,
      user: session?.user ?? null,
    }),
    [hasPermission, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
