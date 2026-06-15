"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ModuleKey } from "./keys.js";

type ModuleState = Readonly<Partial<Record<ModuleKey, boolean>>>;

interface ModuleProviderProps {
  apiBaseUrl?: string;
  children: ReactNode;
  salonId: string;
}

const ModuleContext = createContext<ModuleState>({});

export function ModuleProvider({
  apiBaseUrl = "",
  children,
  salonId,
}: ModuleProviderProps) {
  const [modules, setModules] = useState<ModuleState>({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadModules(): Promise<void> {
      const response = await fetch(
        `${apiBaseUrl}/api/salons/${salonId}/modules`,
        {
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Unable to load modules: ${response.status}`);
      }

      const rows = (await response.json()) as Array<{
        enabled: boolean;
        module_key: ModuleKey;
      }>;
      const nextModules: Partial<Record<ModuleKey, boolean>> = {};

      for (const row of rows) {
        nextModules[row.module_key] = row.enabled;
      }
      setModules(nextModules);
    }

    void loadModules().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, salonId]);

  const value = useMemo(() => modules, [modules]);

  return (
    <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
  );
}

export function useModuleEnabled(moduleKey: ModuleKey): boolean {
  return useContext(ModuleContext)[moduleKey] ?? false;
}
