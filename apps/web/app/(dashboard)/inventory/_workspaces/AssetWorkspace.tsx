"use client";

import { AppPage, EmptyState, PageHeader } from "@esse-beauty/ui";

export function AssetWorkspace() {
  return (
    <AppPage>
      <PageHeader
        eyebrow="Magazzino"
        subtitle="Acquisti, posizione, garanzia e dismissione delle attrezzature durevoli."
        title="Attrezzature"
      />
      <EmptyState
        description="Le attrezzature acquistate resteranno consultabili anche dopo la dismissione."
        title="Nessuna attrezzatura inserita"
      />
    </AppPage>
  );
}
