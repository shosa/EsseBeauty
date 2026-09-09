"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchStaffSession, staffLogin, staffLogout, type StaffSession } from "../../lib/staff-auth";

interface StaffAuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  session?: StaffSession;
  status: "loading" | "authenticated" | "anonymous";
}

const StaffAuthContext = createContext<StaffAuthState | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession>();
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");

  const refresh = useCallback(async () => {
    const next = await fetchStaffSession();
    setSession(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const ok = await staffLogin(email, password);
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  const logout = useCallback(async () => {
    await staffLogout();
    setSession(undefined);
    setStatus("anonymous");
  }, []);

  return (
    <StaffAuthContext.Provider value={{ login, logout, refresh, session, status }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth(): StaffAuthState {
  const context = useContext(StaffAuthContext);
  if (!context) throw new Error("useStaffAuth must be used within StaffAuthProvider");
  return context;
}
