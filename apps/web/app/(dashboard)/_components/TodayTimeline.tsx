import type { ReactNode } from "react";

import { SectionCard } from "@esse-beauty/ui";

export function TodayTimeline({ action, children }: { action: ReactNode; children: ReactNode }) {
  return <SectionCard actions={action} subtitle="Appuntamenti e attività in ordine cronologico." title="Oggi nel salone">{children}</SectionCard>;
}
