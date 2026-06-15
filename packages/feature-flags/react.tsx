"use client";

import {
  useCallback,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ModuleKey } from "./keys.js";

type ModuleState = Readonly<Partial<Record<ModuleKey, boolean>>>;
interface ModuleContextValue {
  modules: ModuleState;
  refresh(): Promise<void>;
  setModule(moduleKey: ModuleKey, enabled: boolean): void;
}

interface ModuleProviderProps {
  apiBaseUrl?: string;
  children: ReactNode;
  salonId: string;
}

const ModuleContext = createContext<ModuleContextValue>({
  modules: {},
  async refresh() {},
  setModule() {},
});

export function ModuleProvider({
  apiBaseUrl = "",
  children,
  salonId,
}: ModuleProviderProps) {
  const [modules, setModules] = useState<ModuleState>({});

  const loadModules = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const response = await fetch(
        `${apiBaseUrl}/api/salons/${salonId}/modules`,
        {
          credentials: "include",
          signal,
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
    },
    [apiBaseUrl, salonId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadModules(controller.signal).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadModules]);

  const setModule = useCallback((moduleKey: ModuleKey, enabled: boolean) => {
    setModules((current) => ({ ...current, [moduleKey]: enabled }));
  }, []);
  const value = useMemo(
    () => ({ modules, refresh: () => loadModules(), setModule }),
    [loadModules, modules, setModule],
  );

  return (
    <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
  );
}

export function useModuleEnabled(moduleKey: ModuleKey): boolean {
  return useContext(ModuleContext).modules[moduleKey] ?? false;
}

export function useModules(): ModuleContextValue {
  return useContext(ModuleContext);
}
