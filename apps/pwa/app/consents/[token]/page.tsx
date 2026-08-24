"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { apiBaseUrl } from "../../../lib/api";
import {
  buildPublicConsentPath,
  buildTypedSignaturePayload,
  publicConsentErrorMessage,
} from "../consent-signing";

interface PublicConsentView {
  consent: {
    body: string;
    expires_at: string | null;
    id: string;
    name: string;
    status: "pending";
    type: string;
    version: number;
  };
  salon: { name: string };
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  return publicConsentErrorMessage(body?.error);
}

export default function ConsentSigningPage() {
  const { token } = useParams<{ token: string }>();
  const [documentView, setDocumentView] = useState<PublicConsentView>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void fetch(buildPublicConsentPath(apiBaseUrl(), token), {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
      setDocumentView(await response.json() as PublicConsentView);
    }).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setLoadError(reason instanceof Error ? reason.message : publicConsentErrorMessage());
      }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  async function sign() {
    const value = signerName.trim();
    if (!value || !accepted) {
      setSubmitError("Inserisci il tuo nome e conferma l'accettazione.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(buildPublicConsentPath(apiBaseUrl(), token, "sign"), {
        body: JSON.stringify(buildTypedSignaturePayload(value)),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        setSubmitError(await responseError(response));
        return;
      }
      setSigned(true);
    } catch {
      setSubmitError("Firma non registrata. Controlla la connessione e riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  if (signed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f1f4] p-5">
        <section className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-800">✓</div>
          <h1 className="mt-5 text-3xl font-bold text-stone-950">Documento firmato</h1>
          <p className="mt-3 leading-6 text-stone-600">La firma è stata registrata. Puoi chiudere questa pagina.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f1f4] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-xl">
        <header className="bg-[#321c2a] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8b9d3]">{documentView?.salon.name ?? "Documento di consenso"}</p>
          <h1 className="mt-3 text-3xl font-bold">{documentView?.consent.name ?? (loading ? "Caricamento…" : "Documento non disponibile")}</h1>
          {documentView && <p className="mt-3 text-sm text-stone-300">Versione {documentView.consent.version} · Scade {documentView.consent.expires_at ? new Date(documentView.consent.expires_at).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" }) : "senza data"}</p>}
        </header>

        <div className="p-6 sm:p-8">
          {loading && <div className="space-y-3"><div className="h-5 animate-pulse rounded bg-stone-100" /><div className="h-5 animate-pulse rounded bg-stone-100" /><div className="h-40 animate-pulse rounded bg-stone-100" /></div>}
          {loadError && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-800" role="alert">{loadError}</div>}
          {documentView && (
            <>
              <article aria-label="Testo del documento" className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm leading-7 text-stone-700 sm:p-6">
                {documentView.consent.body}
              </article>
              <div className="mt-6 grid gap-4">
                <label className="text-sm font-bold text-stone-700">Nome e cognome
                  <input autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 font-normal text-stone-950 outline-none focus:border-[#792f59] focus:ring-4 focus:ring-[#792f59]/10" onChange={(event) => setSignerName(event.target.value)} value={signerName} />
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-[#e7cedb] bg-[#fff8fc] p-4 text-sm font-semibold leading-6 text-stone-800">
                  <input checked={accepted} className="mt-1 size-5 shrink-0 accent-[#792f59]" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
                  <span>Accetto il documento e confermo di averne letto integralmente il contenuto.</span>
                </label>
                {submitError && <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{submitError}</p>}
                <button className="min-h-13 rounded-xl bg-[#792f59] px-5 font-bold text-white shadow-[0_10px_24px_rgb(45_29_39_/_0.16)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={submitting || !accepted || !signerName.trim()} onClick={() => void sign()} type="button">
                  {submitting ? "Registrazione in corso…" : "Firma e conferma"}
                </button>
                <p className="text-center text-xs leading-5 text-stone-500">La firma può essere registrata una sola volta. Il salone conserverà il testo accettato e la relativa evidenza.</p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
