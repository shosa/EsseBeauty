"use client";

import Link from "next/link";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, EmptyState } from "@esse-beauty/ui";
import { SupplierWorkspace } from "../_workspaces/SupplierWorkspace";

export default function SupplierPage() {
  const inventoryEnabled = useModuleEnabled(MODULE_KEYS.INVENTORY);

  if (!inventoryEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <EmptyState
          action={<Link className="font-bold text-[#792f59]" href="/apps">Vai ad App e moduli</Link>}
          description="Attiva il modulo Magazzino dalla pagina App e moduli per accedere a questa sezione."
          title="Modulo Magazzino non attivo"
        />
      </AppPage>
    );
  }

  return <SupplierWorkspace />;
}
