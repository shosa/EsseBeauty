import type { ReactNode } from "react";

import { SectionCard } from "@esse-beauty/ui";

export function OperationalInbox({ action, children }: { action: ReactNode; children: ReactNode }) {
  return <SectionCard actions={action} className="border-[#dec4d2] bg-[#fffafd]" subtitle="Richieste, conferme e anomalie che richiedono attenzione." title="Da gestire">{children}</SectionCard>;
}
