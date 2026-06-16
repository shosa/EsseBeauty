"use client";

import { useEffect, useState } from "react";

import {
  AppPage,
  EmptyState,
  InlineError,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface AuditItem {
  action: string;
  createdAt?: string;
  entityId?: string | null;
  entityType?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
}

export default function AuditSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/audit-log`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Registro attivitÃ  non disponibile.");
        setItems(await response.json());
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Registro attivitÃ  non disponibile."));
  }, [salon?.id]);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Controllo"
        meta={<StatusBadge status="active">{items.length} eventi</StatusBadge>}
        subtitle="Traccia le operazioni rilevanti del salone per responsabilitÃ , sicurezza e controllo interno."
        title="Audit e compliance"
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <SectionCard title="Registro attivitÃ " subtitle="Gli eventi sono ordinati dal piÃ¹ recente. Le informazioni tecniche restano sintetizzate in metadati leggibili.">
        {items.length === 0 ? <EmptyState title="Nessun evento" description="Quando il team eseguirÃ  attivitÃ  tracciate, appariranno in questo registro." /> : (
          <div className="relative border-l-2 border-[#e8bfd4] pl-5">
            {items.map((item) => (
              <article className="relative border-b border-stone-100 py-4 last:border-0" key={item.id}>
                <span className="absolute -left-[27px] top-6 size-3 rounded-full bg-[#792f59] ring-4 ring-[#faf3f7]" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-stone-950">{item.action.replaceAll("_", " ")}</h3>
                    <p className="mt-1 text-sm text-stone-500">{item.entityType ?? "Sistema"} {item.entityId ? `Â· ${item.entityId}` : ""}</p>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{item.createdAt ? new Date(item.createdAt).toLocaleString("it-IT") : "Ora non disponibile"}</span>
                </div>
                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <pre className="mt-3 max-h-36 overflow-auto rounded-2xl bg-stone-950 p-3 text-xs leading-5 text-stone-100">{JSON.stringify(item.metadata, null, 2)}</pre>
                )}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppPage>
  );
}


