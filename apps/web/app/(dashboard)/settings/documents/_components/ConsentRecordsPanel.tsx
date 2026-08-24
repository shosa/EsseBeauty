"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { Button, Dialog, EmptyState, FormField, InlineError, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";
import {
  consentDialogReducer,
  copySigningLink,
  downloadEvidenceRecord,
  initialConsentDialogState,
  loadConsentRecords,
  type ConsentTemplateOption,
  type CustomerConsentRecord,
} from "../consent-controller";
import {
  buildConsentFilters,
  buildConsentRequestBody,
  buildSigningHref,
  consentMutationError,
  consentStatusPresentation,
  nextConsentExpiry,
  type ConsentDeliveryChannel,
} from "../consent-flow";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const pwa = process.env.NEXT_PUBLIC_PWA_URL ?? "";

interface MutationResponse {
  consent: CustomerConsentRecord;
  signing_url: string;
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function responseCode(response: Response): Promise<string | undefined> {
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  return body?.error;
}

function saveBrowserBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function ConsentRecordsPanel({
  appointmentId,
  customerId,
  title = "Consensi del cliente",
}: {
  appointmentId?: string;
  customerId: string;
  title?: string;
}) {
  const { hasPermission, salon } = useAuth();
  const [consents, setConsents] = useState<CustomerConsentRecord[]>([]);
  const [templates, setTemplates] = useState<ConsentTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [dialog, dispatchDialog] = useReducer(
    consentDialogReducer,
    initialConsentDialogState(nextConsentExpiry()),
  );
  const [selectedConsent, setSelectedConsent] = useState<CustomerConsentRecord>();
  const [mutating, setMutating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [clipboardError, setClipboardError] = useState("");

  const canEdit = hasPermission(PERMISSION_KEYS.CLIENTS_EDIT);

  const load = useCallback(async () => {
    if (!salon?.id) return;
    setLoading(true);
    try {
      const result = await loadConsentRecords(
        fetch,
        `${api}/api/salons/${salon.id}/customer-consents?${buildConsentFilters(customerId, appointmentId)}`,
        canEdit ? `${api}/api/salons/${salon.id}/consent-template-options` : undefined,
      );
      if (!result.ok) {
        setConsents([]);
        setTemplates([]);
        setLoadError(result.error);
        return;
      }
      setConsents(result.consents);
      setTemplates(result.templates);
      setLoadError("");
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Consensi non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, canEdit, customerId, salon?.id]);

  useEffect(() => { void load(); }, [load]);

  function closeDialog() {
    if (mutating) return;
    dispatchDialog({ type: "close" });
    setSelectedConsent(undefined);
  }

  function openRequest() {
    dispatchDialog({ expiresAt: nextConsentExpiry(), templateId: templates[0]?.id ?? "", type: "open_request" });
  }

  function openResend(consent: CustomerConsentRecord) {
    setSelectedConsent(consent);
    dispatchDialog({ deliveryChannel: consent.delivery_channel ?? "in_person", expiresAt: nextConsentExpiry(), type: "open_resend" });
  }

  function openSign(consent: CustomerConsentRecord) {
    setSelectedConsent(consent);
    dispatchDialog({ type: "open_sign" });
  }

  function openRevoke(consent: CustomerConsentRecord) {
    setSelectedConsent(consent);
    dispatchDialog({ type: "open_revoke" });
  }

  async function createOrResend() {
    if (!salon?.id) return;
    if (dialog.mode === "request" && !dialog.templateId) {
      dispatchDialog({ error: "Seleziona un modello attivo.", type: "failure" });
      return;
    }
    const parsedExpiry = new Date(dialog.expiresAt);
    if (!dialog.expiresAt || Number.isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      dispatchDialog({ error: "Scegli una scadenza futura.", type: "failure" });
      return;
    }
    setMutating(true);
    try {
      const isResend = dialog.mode === "resend" && selectedConsent;
      const response = await fetch(isResend
        ? `${api}/api/salons/${salon.id}/customer-consents/${selectedConsent.id}/resend`
        : `${api}/api/salons/${salon.id}/customer-consents`, {
        body: JSON.stringify(isResend ? {
          delivery_channel: dialog.deliveryChannel,
          expires_at: parsedExpiry.toISOString(),
        } : buildConsentRequestBody({
          appointmentId,
          customerId,
          deliveryChannel: dialog.deliveryChannel,
          expiresAt: parsedExpiry.toISOString(),
          templateId: dialog.templateId,
        })),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        dispatchDialog({ error: consentMutationError(await responseCode(response)), type: "failure" });
        return;
      }
      const result = await response.json() as MutationResponse;
      setGeneratedLink(result.signing_url);
      setCopied(false);
      setClipboardError("");
      dispatchDialog({ type: "success" });
      setSelectedConsent(undefined);
      await load();
    } catch {
      dispatchDialog({ error: "Operazione non riuscita. Controlla la connessione e riprova.", type: "failure" });
    } finally {
      setMutating(false);
    }
  }

  async function signInPerson() {
    if (!salon?.id || !selectedConsent) return;
    const value = dialog.signerName.trim();
    if (!dialog.accepted || !value) {
      dispatchDialog({ error: "Inserisci il nome del firmatario e conferma l'accettazione.", type: "failure" });
      return;
    }
    setMutating(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/customer-consents/${selectedConsent.id}/sign`, {
        body: JSON.stringify({
          accepted: true,
          signature: { type: "typed", value },
          signer_name: value,
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        dispatchDialog({ error: consentMutationError(await responseCode(response)), type: "failure" });
        return;
      }
      dispatchDialog({ type: "success" });
      setSelectedConsent(undefined);
      await load();
    } catch {
      dispatchDialog({ error: "Firma non registrata. Controlla la connessione e riprova.", type: "failure" });
    } finally {
      setMutating(false);
    }
  }

  async function revoke() {
    if (!salon?.id || !selectedConsent) return;
    const reason = dialog.revocationReason.trim();
    if (reason.length < 3) {
      dispatchDialog({ error: "Il motivo della revoca deve contenere almeno 3 caratteri.", type: "failure" });
      return;
    }
    setMutating(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/customer-consents/${selectedConsent.id}/revoke`, {
        body: JSON.stringify({ reason }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        dispatchDialog({ error: consentMutationError(await responseCode(response)), type: "failure" });
        return;
      }
      dispatchDialog({ type: "success" });
      setSelectedConsent(undefined);
      await load();
    } catch {
      dispatchDialog({ error: "Revoca non registrata. Controlla la connessione e riprova.", type: "failure" });
    } finally {
      setMutating(false);
    }
  }

  async function downloadEvidence(consent: CustomerConsentRecord) {
    if (!salon?.id) return;
    setOperationError("");
    setOperationError(await downloadEvidenceRecord({
      fetcher: fetch,
      filename: `evidenza-consenso-${consent.id}.txt`,
      save: saveBrowserBlob,
      url: `${api}/api/salons/${salon.id}/customer-consents/${consent.id}/evidence`,
    }));
  }

  async function copyGeneratedLink() {
    const result = await copySigningLink(navigator.clipboard, buildSigningHref(generatedLink, pwa));
    setCopied(result.copied);
    setClipboardError(result.error);
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-1 text-xs text-stone-500">Richieste, firme, revoche ed evidenze generate dal registro del server.</p>
        </div>
        {canEdit && <Button disabled={loading} onClick={openRequest} variant="primary">Richiedi consenso</Button>}
      </div>
      {loadError && <InlineError className="mt-4">{loadError}</InlineError>}
      {operationError && <InlineError className="mt-4">{operationError}</InlineError>}
      {loading ? <div className="mt-4 h-28 animate-pulse rounded-xl bg-stone-100" /> : consents.length === 0 ? (
        <div className="mt-4"><EmptyState description="Crea una richiesta per iniziare il flusso di firma." title="Nessun consenso collegato" /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {consents.map((consent) => {
            const presentation = consentStatusPresentation(consent.status);
            const canRegenerate = consent.status === "pending" || consent.status === "expired";
            const hasEvidence = consent.status === "signed" || consent.status === "revoked";
            return (
              <article className="rounded-xl border border-stone-200 p-4" key={consent.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-stone-950">{consent.template_name} · v{consent.template_version}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Creato {displayDate(consent.created_at)} · Scade {displayDate(consent.expires_at)}
                    </p>
                  </div>
                  <StatusBadge status={presentation.badge}>{presentation.label}</StatusBadge>
                </div>
                {consent.signer_name && <p className="mt-3 text-sm text-stone-600">Firmato da <strong>{consent.signer_name}</strong> il {displayDate(consent.signed_at)}</p>}
                {consent.revocation_reason && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Revoca: {consent.revocation_reason}</p>}
                {consent.document_hash && <p className="mt-2 break-all font-mono text-[10px] text-stone-400">SHA-256 {consent.document_hash}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {canEdit && consent.status === "pending" && <Button onClick={() => openSign(consent)} variant="outline">Firma in presenza</Button>}
                  {canEdit && canRegenerate && <Button onClick={() => openResend(consent)} variant="outline">Rigenera link</Button>}
                  {hasEvidence && <Button onClick={() => void downloadEvidence(consent)} variant="outline">Scarica evidenza</Button>}
                  {canEdit && consent.status === "signed" && <Button onClick={() => openRevoke(consent)} variant="destructive">Revoca consenso</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating} onClick={() => void createOrResend()} variant="primary">{mutating ? "Salvataggio…" : dialog.mode === "resend" ? "Rigenera link" : "Crea richiesta"}</Button></>}
        onClose={closeDialog}
        open={dialog.mode === "request" || dialog.mode === "resend"}
        title={dialog.mode === "resend" ? "Rigenera il link di firma" : "Richiedi consenso"}
      >
        <div className="grid gap-4">
          {dialog.mode === "request" && <FormField label="Modello attivo"><select onChange={(event) => dispatchDialog({ field: "templateId", type: "change", value: event.target.value })} value={dialog.templateId}><option value="">Seleziona un modello</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></FormField>}
          <FormField label="Canale"><select onChange={(event) => dispatchDialog({ field: "deliveryChannel", type: "change", value: event.target.value as ConsentDeliveryChannel })} value={dialog.deliveryChannel}><option value="in_person">In presenza</option><option value="email">Email (genera link)</option><option value="sms">SMS (genera link)</option></select></FormField>
          <FormField label="Scadenza"><input min={new Date().toISOString().slice(0, 16)} onChange={(event) => dispatchDialog({ field: "expiresAt", type: "change", value: event.target.value })} type="datetime-local" value={dialog.expiresAt} /></FormField>
          <p className="text-xs leading-5 text-stone-500">Il sistema genera il link sicuro. La consegna tramite provider email o SMS non è automatica.</p>
          {dialog.error && <InlineError>{dialog.error}</InlineError>}
        </div>
      </Dialog>

      <Dialog
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating || !dialog.accepted || !dialog.signerName.trim()} onClick={() => void signInPerson()} variant="primary">{mutating ? "Registrazione…" : "Registra firma"}</Button></>}
        onClose={closeDialog}
        open={dialog.mode === "sign"}
        title="Firma in presenza"
      >
        <div className="grid gap-4">
          <FormField label="Nome e cognome del firmatario"><input autoComplete="name" onChange={(event) => dispatchDialog({ field: "signerName", type: "change", value: event.target.value })} value={dialog.signerName} /></FormField>
          <label className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 text-sm font-semibold"><input checked={dialog.accepted} className="mt-1 size-4" onChange={(event) => dispatchDialog({ field: "accepted", type: "change", value: event.target.checked })} type="checkbox" /><span>Il firmatario dichiara di aver letto e accettato il documento.</span></label>
          {dialog.error && <InlineError>{dialog.error}</InlineError>}
        </div>
      </Dialog>

      <Dialog
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating || dialog.revocationReason.trim().length < 3} onClick={() => void revoke()} variant="destructive">{mutating ? "Revoca…" : "Conferma revoca"}</Button></>}
        onClose={closeDialog}
        open={dialog.mode === "revoke"}
        title="Revoca consenso"
      >
        <div className="grid gap-4">
          <p className="text-sm leading-6 text-stone-600">La firma e l'evidenza restano conservate. Inserisci il motivo comunicato dal cliente.</p>
          <FormField label="Motivo obbligatorio"><textarea onChange={(event) => dispatchDialog({ field: "revocationReason", type: "change", value: event.target.value })} rows={4} value={dialog.revocationReason} /></FormField>
          {dialog.error && <InlineError>{dialog.error}</InlineError>}
        </div>
      </Dialog>

      <Dialog footer={<Button onClick={() => setGeneratedLink("")} variant="primary">Chiudi</Button>} onClose={() => setGeneratedLink("")} open={Boolean(generatedLink)} title="Link di firma pronto">
        <p className="text-sm leading-6 text-stone-600">Condividi questo collegamento usando il canale scelto. Il token resta nel percorso e non viene salvato nei parametri di ricerca.</p>
        <div className="mt-4 break-all rounded-xl bg-stone-100 p-3 font-mono text-xs text-stone-700">{buildSigningHref(generatedLink, pwa)}</div>
        <Button className="mt-4 w-full" onClick={() => void copyGeneratedLink()} variant="outline">{copied ? "Link copiato" : "Copia link"}</Button>
        {clipboardError && <InlineError className="mt-3">{clipboardError}</InlineError>}
        {!pwa && <p className="mt-3 text-xs text-amber-800">Il collegamento è relativo: configura NEXT_PUBLIC_PWA_URL per copiarne uno completo.</p>}
      </Dialog>
    </section>
  );
}
