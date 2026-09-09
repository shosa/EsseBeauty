"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams } from "next/navigation";

import { apiBaseUrl } from "../../lib/api";
import {
  buildPublicConsentPath,
  buildTypedSignaturePayload,
  initialPublicSigningState,
  loadPublicConsentView,
  publicSigningReducer,
  publicConsentErrorMessage,
  type PublicConsentView,
} from "./consent-signing";

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  return publicConsentErrorMessage(body?.error);
}

export function ConsentSigningView() {
  const { token } = useParams<{ token: string }>();
  const [documentView, setDocumentView] = useState<PublicConsentView>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signing, dispatchSigning] = useReducer(publicSigningReducer, initialPublicSigningState);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void loadPublicConsentView(fetch, buildPublicConsentPath(apiBaseUrl(), token), controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok) setDocumentView(result.documentView);
        else setLoadError(result.error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  async function sign() {
    const value = signing.signerName.trim();
    if (!value || !signing.accepted) {
      dispatchSigning({ error: "Inserisci il tuo nome e conferma l'accettazione.", type: "failure" });
      return;
    }
    dispatchSigning({ type: "submit" });
    try {
      const response = await fetch(buildPublicConsentPath(apiBaseUrl(), token, "sign"), {
        body: JSON.stringify(buildTypedSignaturePayload(value)),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        dispatchSigning({ error: await responseError(response), type: "failure" });
        return;
      }
      dispatchSigning({ type: "success" });
    } catch {
      dispatchSigning({ error: "Firma non registrata. Controlla la connessione e riprova.", type: "failure" });
    }
  }

  if (signing.signed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5">
        <section className="animate-reveal w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-800">✓</div>
          <h1 className="mt-5 text-3xl font-bold text-stone-950">Documento firmato</h1>
          <p className="mt-3 leading-6 text-stone-500">La firma è stata registrata. Puoi chiudere questa pagina.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] px-4 py-8 lg:px-10 lg:py-10">
      <section className="animate-reveal mx-auto max-w-2xl">
        <header>
          <p className="text-xs font-black uppercase tracking-[.24em] text-stone-500">{documentView?.salon.name ?? "Documento di consenso"}</p>
          <h1 className="mt-2 text-[1.7rem] font-bold text-stone-950">{documentView?.consent.name ?? (loading ? "Caricamento…" : "Documento non disponibile")}</h1>
          {documentView && <p className="mt-2 text-sm text-stone-500">Versione {documentView.consent.version} · Scade {documentView.consent.expires_at ? new Date(documentView.consent.expires_at).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" }) : "senza data"}</p>}
        </header>

        <div className="mt-6">
          {loading && <div className="space-y-3"><div className="h-5 animate-pulse rounded-xl bg-stone-100" /><div className="h-5 animate-pulse rounded-xl bg-stone-100" /><div className="h-40 animate-pulse rounded-2xl bg-stone-100" /></div>}
          {loadError && <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700" role="alert">{loadError}</div>}
          {documentView && (
            <>
              <article aria-label="Testo del documento" className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-3xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600 sm:p-6">
                {documentView.consent.body}
              </article>
              <div className="mt-6 grid gap-4">
                <label className="block text-sm font-black text-stone-800">Nome e cognome
                  <input autoComplete="name" className="mt-2 w-full" onChange={(event) => dispatchSigning({ field: "signerName", type: "change", value: event.target.value })} value={signing.signerName} />
                </label>
                <label className="flex items-start gap-3 rounded-3xl border border-stone-200 bg-white p-4 text-sm font-semibold leading-6 text-stone-800">
                  <input checked={signing.accepted} className="mt-1 size-5 shrink-0" onChange={(event) => dispatchSigning({ field: "accepted", type: "change", value: event.target.checked })} type="checkbox" />
                  <span>Accetto il documento e confermo di averne letto integralmente il contenuto.</span>
                </label>
                {signing.error && <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{signing.error}</p>}
                <button className="min-h-12 rounded-full bg-stone-950 px-5 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" disabled={signing.submitting || !signing.accepted || !signing.signerName.trim()} onClick={() => void sign()} type="button">
                  {signing.submitting ? "Registrazione in corso…" : "Firma e conferma"}
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
