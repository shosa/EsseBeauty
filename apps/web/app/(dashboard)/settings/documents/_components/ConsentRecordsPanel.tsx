"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { Button, Dialog, EmptyState, FormField, InlineError, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";
import {
  buildConsentFilters,
  buildConsentRequestBody,
  buildSigningHref,
  consentMutationError,
  consentStatusPresentation,
  nextConsentExpiry,
  type ConsentDeliveryChannel,
  type ConsentStatus,
} from "../consent-flow";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const pwa = process.env.NEXT_PUBLIC_PWA_URL ?? "";

interface ConsentTemplate {
  active: boolean;
  id: string;
  name: string;
  type: string;
  version: number;
}

interface CustomerConsent {
  appointment_id: string | null;
  created_at: string;
  customer_id: string;
  delivery_channel: ConsentDeliveryChannel | null;
  document_hash: string | null;
  expires_at: string | null;
  id: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  signed_at: string | null;
  signer_name: string | null;
  status: ConsentStatus;
  template_id: string;
}

interface MutationResponse {
  consent: CustomerConsent;
  signing_url: string;
}

type DialogMode = "request" | "resend" | "revoke" | "sign";

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
  const [consents, setConsents] = useState<CustomerConsent[]>([]);
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>();
  const [selectedConsent, setSelectedConsent] = useState<CustomerConsent>();
  const [templateId, setTemplateId] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState<ConsentDeliveryChannel>("in_person");
  const [expiresAt, setExpiresAt] = useState(() => nextConsentExpiry());
  const [signerName, setSignerName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const canEdit = hasPermission(PERMISSION_KEYS.CLIENTS_EDIT);
  const templateNames = useMemo(
    () => new Map(templates.map((template) => [template.id, `${template.name} · v${template.version}`])),
    [templates],
  );

  const load = useCallback(async () => {
    if (!salon?.id) return;
    setLoading(true);
    try {
      const consentResponse = await fetch(
        `${api}/api/salons/${salon.id}/customer-consents?${buildConsentFilters(customerId, appointmentId)}`,
        { credentials: "include" },
      );
      if (!consentResponse.ok) throw new Error("Consensi non disponibili.");
      setConsents(await consentResponse.json() as CustomerConsent[]);

      const templateResponse = await fetch(`${api}/api/salons/${salon.id}/consent-templates`, {
        credentials: "include",
      });
      setTemplates(templateResponse.ok
        ? (await templateResponse.json() as ConsentTemplate[]).filter((template) => template.active)
        : []);
      setLoadError("");
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Consensi non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, customerId, salon?.id]);

  useEffect(() => { void load(); }, [load]);

  function closeDialog() {
    if (mutating) return;
    setDialogMode(undefined);
    setSelectedConsent(undefined);
    setDialogError("");
  }

  function openRequest() {
    setTemplateId(templates[0]?.id ?? "");
    setDeliveryChannel("in_person");
    setExpiresAt(nextConsentExpiry());
    setDialogError("");
    setDialogMode("request");
  }

  function openResend(consent: CustomerConsent) {
    setSelectedConsent(consent);
    setDeliveryChannel(consent.delivery_channel ?? "in_person");
    setExpiresAt(nextConsentExpiry());
    setDialogError("");
    setDialogMode("resend");
  }

  function openSign(consent: CustomerConsent) {
    setSelectedConsent(consent);
    setSignerName("");
    setAccepted(false);
    setDialogError("");
    setDialogMode("sign");
  }

  function openRevoke(consent: CustomerConsent) {
    setSelectedConsent(consent);
    setRevocationReason("");
    setDialogError("");
    setDialogMode("revoke");
  }

  async function createOrResend() {
    if (!salon?.id) return;
    if (dialogMode === "request" && !templateId) {
      setDialogError("Seleziona un modello attivo.");
      return;
    }
    const parsedExpiry = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      setDialogError("Scegli una scadenza futura.");
      return;
    }
    setMutating(true);
    setDialogError("");
    try {
      const isResend = dialogMode === "resend" && selectedConsent;
      const response = await fetch(isResend
        ? `${api}/api/salons/${salon.id}/customer-consents/${selectedConsent.id}/resend`
        : `${api}/api/salons/${salon.id}/customer-consents`, {
        body: JSON.stringify(isResend ? {
          delivery_channel: deliveryChannel,
          expires_at: parsedExpiry.toISOString(),
        } : buildConsentRequestBody({
          appointmentId,
          customerId,
          deliveryChannel,
          expiresAt: parsedExpiry.toISOString(),
          templateId,
        })),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setDialogError(consentMutationError(await responseCode(response)));
        return;
      }
      const result = await response.json() as MutationResponse;
      setGeneratedLink(result.signing_url);
      setCopied(false);
      setDialogMode(undefined);
      setSelectedConsent(undefined);
      await load();
    } catch {
      setDialogError("Operazione non riuscita. Controlla la connessione e riprova.");
    } finally {
      setMutating(false);
    }
  }

  async function signInPerson() {
    if (!salon?.id || !selectedConsent) return;
    const value = signerName.trim();
    if (!accepted || !value) {
      setDialogError("Inserisci il nome del firmatario e conferma l'accettazione.");
      return;
    }
    setMutating(true);
    setDialogError("");
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
        setDialogError(consentMutationError(await responseCode(response)));
        return;
      }
      setDialogMode(undefined);
      setSelectedConsent(undefined);
      await load();
    } catch {
      setDialogError("Firma non registrata. Controlla la connessione e riprova.");
    } finally {
      setMutating(false);
    }
  }

  async function revoke() {
    if (!salon?.id || !selectedConsent) return;
    const reason = revocationReason.trim();
    if (reason.length < 3) {
      setDialogError("Il motivo della revoca deve contenere almeno 3 caratteri.");
      return;
    }
    setMutating(true);
    setDialogError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/customer-consents/${selectedConsent.id}/revoke`, {
        body: JSON.stringify({ reason }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setDialogError(consentMutationError(await responseCode(response)));
        return;
      }
      setDialogMode(undefined);
      setSelectedConsent(undefined);
      await load();
    } catch {
      setDialogError("Revoca non registrata. Controlla la connessione e riprova.");
    } finally {
      setMutating(false);
    }
  }

  async function downloadEvidence(consent: CustomerConsent) {
    if (!salon?.id) return;
    setOperationError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/customer-consents/${consent.id}/evidence`, {
        credentials: "include",
      });
      if (!response.ok) {
        setOperationError(consentMutationError(await responseCode(response)));
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `evidenza-consenso-${consent.id}.txt`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setOperationError("Evidenza non disponibile. Controlla la connessione e riprova.");
    }
  }

  async function copyGeneratedLink() {
    try {
      await navigator.clipboard.writeText(buildSigningHref(generatedLink, pwa));
      setCopied(true);
    } catch {
      setCopied(false);
    }
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
                    <p className="font-bold text-stone-950">{templateNames.get(consent.template_id) ?? `Documento ${consent.template_id.slice(0, 8)}`}</p>
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
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating} onClick={() => void createOrResend()} variant="primary">{mutating ? "Salvataggio…" : dialogMode === "resend" ? "Rigenera link" : "Crea richiesta"}</Button></>}
        onClose={closeDialog}
        open={dialogMode === "request" || dialogMode === "resend"}
        title={dialogMode === "resend" ? "Rigenera il link di firma" : "Richiedi consenso"}
      >
        <div className="grid gap-4">
          {dialogMode === "request" && <FormField label="Modello attivo"><select onChange={(event) => setTemplateId(event.target.value)} value={templateId}><option value="">Seleziona un modello</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></FormField>}
          <FormField label="Canale"><select onChange={(event) => setDeliveryChannel(event.target.value as ConsentDeliveryChannel)} value={deliveryChannel}><option value="in_person">In presenza</option><option value="email">Email (genera link)</option><option value="sms">SMS (genera link)</option></select></FormField>
          <FormField label="Scadenza"><input min={new Date().toISOString().slice(0, 16)} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /></FormField>
          <p className="text-xs leading-5 text-stone-500">Il sistema genera il link sicuro. La consegna tramite provider email o SMS non è automatica.</p>
          {dialogError && <InlineError>{dialogError}</InlineError>}
        </div>
      </Dialog>

      <Dialog
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating || !accepted || !signerName.trim()} onClick={() => void signInPerson()} variant="primary">{mutating ? "Registrazione…" : "Registra firma"}</Button></>}
        onClose={closeDialog}
        open={dialogMode === "sign"}
        title="Firma in presenza"
      >
        <div className="grid gap-4">
          <FormField label="Nome e cognome del firmatario"><input autoComplete="name" onChange={(event) => setSignerName(event.target.value)} value={signerName} /></FormField>
          <label className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 text-sm font-semibold"><input checked={accepted} className="mt-1 size-4" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" /><span>Il firmatario dichiara di aver letto e accettato il documento.</span></label>
          {dialogError && <InlineError>{dialogError}</InlineError>}
        </div>
      </Dialog>

      <Dialog
        footer={<><Button disabled={mutating} onClick={closeDialog} variant="outline">Annulla</Button><Button disabled={mutating || revocationReason.trim().length < 3} onClick={() => void revoke()} variant="destructive">{mutating ? "Revoca…" : "Conferma revoca"}</Button></>}
        onClose={closeDialog}
        open={dialogMode === "revoke"}
        title="Revoca consenso"
      >
        <div className="grid gap-4">
          <p className="text-sm leading-6 text-stone-600">La firma e l'evidenza restano conservate. Inserisci il motivo comunicato dal cliente.</p>
          <FormField label="Motivo obbligatorio"><textarea onChange={(event) => setRevocationReason(event.target.value)} rows={4} value={revocationReason} /></FormField>
          {dialogError && <InlineError>{dialogError}</InlineError>}
        </div>
      </Dialog>

      <Dialog footer={<Button onClick={() => setGeneratedLink("")} variant="primary">Chiudi</Button>} onClose={() => setGeneratedLink("")} open={Boolean(generatedLink)} title="Link di firma pronto">
        <p className="text-sm leading-6 text-stone-600">Condividi questo collegamento usando il canale scelto. Il token resta nel percorso e non viene salvato nei parametri di ricerca.</p>
        <div className="mt-4 break-all rounded-xl bg-stone-100 p-3 font-mono text-xs text-stone-700">{buildSigningHref(generatedLink, pwa)}</div>
        <Button className="mt-4 w-full" onClick={() => void copyGeneratedLink()} variant="outline">{copied ? "Link copiato" : "Copia link"}</Button>
        {!pwa && <p className="mt-3 text-xs text-amber-800">Il collegamento è relativo: configura NEXT_PUBLIC_PWA_URL per copiarne uno completo.</p>}
      </Dialog>
    </section>
  );
}
