"use client";

import { AppPage, EmptyState, PageHeader } from "@esse-beauty/ui";

export function ExpenseWorkspace() {
  return (
    <AppPage>
      <PageHeader
        eyebrow="Magazzino"
        subtitle="Spese operative, uscite di cassa e riferimenti documentali collegati."
        title="Spese"
      />
      <EmptyState
        description="Le spese registrate saranno visibili qui con categoria, pagamento e documento sorgente."
        title="Nessuna spesa registrata"
      />
    </AppPage>
  );
}
