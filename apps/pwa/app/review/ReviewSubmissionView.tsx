"use client";

import { useEffect, useReducer, useState } from "react";

import {
  buildReviewSessionPath,
  exchangeReviewFragment,
  initialReviewSubmissionState,
  loadPublicReview,
  reviewSubmissionReducer,
  submitPublicReview,
  type PublicReviewView,
} from "./review-submission";

export function ReviewSubmissionView() {
  const [summary, setSummary] = useState<PublicReviewView>();
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useReducer(reviewSubmissionReducer, initialReviewSubmissionState);

  useEffect(() => {
    const controller = new AbortController();
    setSummary(undefined);
    dispatch({ type: "reset" });
    setLoading(true);
    void exchangeReviewFragment(
      fetch,
      window.location.href,
      (url) => window.history.replaceState(null, "", url),
    )
      .then((exchange) => exchange.ok
        ? loadPublicReview(fetch, buildReviewSessionPath(), controller.signal)
        : { error: "Il link non è valido o non è più disponibile.", ok: false as const })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok) setSummary(result.view);
        else dispatch({ error: result.error, type: "failure" });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit() {
    if (!state.rating || state.submitting || !summary) return;
    dispatch({ type: "submit" });
    const result = await submitPublicReview(fetch, buildReviewSessionPath(), {
      comment: state.comment.trim() || undefined,
      rating: state.rating,
    });
    dispatch(result.ok ? { type: "success" } : { error: result.error, type: "failure" });
  }

  if (state.submitted) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5">
        <section className="animate-reveal w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center">
          <div className="text-5xl text-[#b8862e]">★★★★★</div>
          <h1 className="mt-5 text-3xl font-bold text-stone-950">Grazie del tuo tempo</h1>
          <p className="mt-3 leading-6 text-stone-500">La tua esperienza aiuta il salone a migliorare.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] px-4 py-8 lg:px-10 lg:py-10">
      <section className="animate-reveal mx-auto max-w-lg">
        <header>
          <p className="text-xs font-black uppercase tracking-[.24em] text-stone-500">{summary?.salon_name ?? "Recensione"}</p>
          <h1 className="mt-2 text-[1.7rem] font-bold text-stone-950">Com&apos;è andata?</h1>
          <p className="mt-2 text-sm text-stone-500">{summary ? `${summary.service_name} · ${new Date(summary.starts_at).toLocaleDateString("it-IT")}` : loading ? "Caricamento…" : "Invito non disponibile"}</p>
        </header>

        {summary && (
          <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 sm:p-7">
            <p className="text-sm font-black text-stone-800">La tua valutazione</p>
            <div className="mt-3 flex justify-between">
              {[1, 2, 3, 4, 5].map((star) => (
                <button aria-label={`${star} stelle`} className={`rounded-2xl px-2 text-4xl transition hover:-translate-y-0.5 ${star <= state.rating ? "bg-amber-50 text-[#b8862e]" : "text-stone-200 hover:bg-stone-50"}`} key={star} onClick={() => dispatch({ rating: star, type: "rating" })} type="button">★</button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-black text-stone-800">Commento <span className="font-normal text-stone-400">(facoltativo)</span>
              <textarea className="mt-2 w-full" onChange={(event) => dispatch({ comment: event.target.value, type: "comment" })} placeholder="Raccontaci cosa hai apprezzato..." rows={5} value={state.comment} />
            </label>
            {state.error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{state.error}</p>}
            <button className="mt-6 min-h-12 w-full rounded-full bg-stone-950 font-black text-white transition hover:-translate-y-0.5 disabled:opacity-45" disabled={!state.rating || state.submitting} onClick={() => void submit()} type="button">
              {state.submitting ? "Invio in corso…" : "Invia recensione"}
            </button>
          </div>
        )}
        {!summary && state.error && <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{state.error}</p>}
      </section>
    </main>
  );
}
