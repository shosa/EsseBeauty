"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

import { customerLogout, fetchCustomerMe, type CustomerProfile } from "../../../lib/customer-auth";

interface CustomerAuthState {
  customer?: CustomerProfile;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setCustomer: (customer: CustomerProfile) => void;
  status: "loading" | "authenticated" | "anonymous";
}

const CustomerAuthContext = createContext<CustomerAuthState | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [customer, setCustomerState] = useState<CustomerProfile>();
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");

  const refresh = useCallback(async () => {
    const profile = await fetchCustomerMe(slug);
    setCustomerState(profile);
    setStatus(profile ? "authenticated" : "anonymous");
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCustomer = useCallback((profile: CustomerProfile) => {
    setCustomerState(profile);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await customerLogout(slug);
    setCustomerState(undefined);
    setStatus("anonymous");
  }, [slug]);

  return (
    <CustomerAuthContext.Provider value={{ customer, logout, refresh, setCustomer, status }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthState {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return context;
}
