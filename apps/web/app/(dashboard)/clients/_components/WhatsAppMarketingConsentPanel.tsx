"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, History, MessageCircle, ShieldCheck } from "lucide-react";
import { Button, StatusBadge } from "@esse-beauty/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type ConsentStatus = "granted" | "revoked";

interface ConsentHistoryItem {
  at: string;
  note?: string | null;
  source?: string;
  status: ConsentStatus;
}

interface ConsentRecord {
  captured_at: string | null;
  captured_source: string | null;
  evidence_note: string | null;
  history: ConsentHistoryItem[];
  revoked_at: string | null;
  status: ConsentStatus;
}

const sourceLabels: Record<string, string> = {
  customer_request: "Richiesta del cliente",
  import_verified: "Importazione verificata",
  in_person: "Acquisito in salone",
  manual_admin: "Inserimento amministrativo",
  web_form: "Modulo online",
};

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "Non registrata";
}

export function WhatsAppMarketingConsentPanel({ customerId, phone, salonId }: { customerId: string; phone: string | null; salonId: string }) {
  const [record, setRecord] = useState<ConsentRecord>();
  const [source, setSource] = useState("in_person");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${api}/api/salons/${salonId}/customers/${customerId}/communication-consents/whatsapp-marketing`, {
      credentials: "include",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Consenso WhatsApp non disponibile.");
      const data = await response.json() as ConsentRecord;
      setRecord(data);
      setSource(data.captured_source ?? "in_person");
      setNote(data.evidence_note ?? "");
    }).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Consenso non disponibile.");
    });
    return () => controller.abort();
  }, [customerId, salonId]);

  async function updateConsent(status: ConsentStatus) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${api}/api/salons/${salonId}/customers/${customerId}/communication-consents/whatsapp-marketing`, {
        body: JSON.stringify({ evidence_note: note, source, status }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("Aggiornamento del consenso non riuscito.");
      setRecord(await response.json() as ConsentRecord);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  const granted = record?.status === "granted";
  const revocations = [...(record?.history ?? [])].filter((item) => item.status === "revoked").reverse();

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 p-5">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><MessageCircle size={20} /></span>
          <div><h2 className="font-bold text-stone-950">Consensi comunicazioni</h2><p className="mt-1 text-xs text-stone-600">Autorizzazione per campagne marketing via WhatsApp.</p></div>
        </div>
        <StatusBadge status={granted ? "active" : "inactive"}>{granted ? "Concesso" : "Non concesso"}</StatusBadge>
      </div>

      <div className="space-y-4 p-5">
        {!phone && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Aggiungi un numero di telefono prima di acquisire il consenso WhatsApp.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-stone-700">Fonte di acquisizione
            <select className="mt-2 w-full rounded-xl border border-stone-200 bg-white p-3 font-normal" onChange={(event) => setSource(event.target.value)} value={source}>
              {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-stone-200 p-3 text-sm">
            <span className="block text-xs font-bold uppercase text-stone-400">Ultima acquisizione</span>
            <strong className="mt-1 block">{displayDate(record?.captured_at ?? null)}</strong>
            {record?.captured_source && <span className="mt-1 block text-xs text-stone-500">{sourceLabels[record.captured_source] ?? record.captured_source}</span>}
          </div>
        </div>
        <label className="block text-sm font-bold text-stone-700">Nota o evidenza
          <textarea className="mt-2 w-full resize-y rounded-xl border border-stone-200 p-3 font-normal" onChange={(event) => setNote(event.target.value)} placeholder="Es. consenso espresso in reception, modulo o richiesta del cliente" rows={3} value={note} />
        </label>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {granted ? (
            <Button disabled={saving} onClick={() => void updateConsent("revoked")} variant="destructive">Revoca consenso</Button>
          ) : (
            <Button disabled={saving || !phone} onClick={() => void updateConsent("granted")} variant="primary"><ShieldCheck className="mr-2" size={17} />Concedi consenso</Button>
          )}
          {record && <span className="text-xs text-stone-500">{granted ? <><CheckCircle2 className="mr-1 inline text-emerald-600" size={15} />Utilizzabile per campagne</> : `Revocato: ${displayDate(record.revoked_at)}`}</span>}
        </div>

        {revocations.length > 0 && <details className="rounded-xl border border-stone-200 p-4">
          <summary className="cursor-pointer list-none text-sm font-bold"><History className="mr-2 inline" size={16} />Storico revoche ({revocations.length})</summary>
          <div className="mt-4 space-y-3 border-l-2 border-stone-200 pl-4">
            {revocations.map((item, index) => <div key={`${item.at}-${index}`} className="text-sm"><strong>{displayDate(item.at)}</strong><p className="text-xs text-stone-500">{sourceLabels[item.source ?? ""] ?? item.source ?? "Fonte non indicata"}{item.note ? ` · ${item.note}` : ""}</p></div>)}
          </div>
        </details>}
      </div>
    </article>
  );
}
