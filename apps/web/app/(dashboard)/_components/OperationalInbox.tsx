import type { ReactNode } from "react";

import { SectionCard } from "@esse-beauty/ui";

export function OperationalInbox({ action, children }: { action: ReactNode; children: ReactNode }) {
  return <SectionCard actions={action} subtitle="Richieste, conferme e anomalie che richiedono attenzione." title="Da gestire">{children}</SectionCard>;
}
