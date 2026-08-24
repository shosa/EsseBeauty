import type { ReactNode } from "react";

export function DocumentsModuleGate({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return enabled ? children : null;
}
