"use client";

import { useEffect, useReducer, useState } from "react";

import {
  buildReviewSessionPath,
  initialReviewSubmissionState,
  loadPublicReview,
  reviewSubmissionReducer,
  submitPublicReview,
  type PublicReviewView,
} from "./review-submission";

export default function ReviewPage() {
  const [summary, setSummary] = useState<PublicReviewView>();
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useReducer(reviewSubmissionReducer, initialReviewSubmissionState);

  useEffect(() => {
    const controller = new AbortController();
    setSummary(undefined);
    dispatch({ type: "reset" });
    setLoading(true);
    void loadPublicReview(fetch, buildReviewSessionPath(), controller.signal)
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
    return <main className="grid min-h-screen place-items-center bg-[#f6f1f4] p-5"><section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><div className="text-5xl text-[#792f59]">★★★★★</div><h1 className="mt-5 text-3xl font-bold">Grazie del tuo tempo</h1><p className="mt-3 text-stone-600">La tua esperienza aiuta il salone a migliorare.</p></section></main>;
  }

  return <main className="min-h-screen bg-[#f6f1f4] px-4 py-10"><section className="mx-auto max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-xl">
    <header className="bg-[#321c2a] p-7 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8b9d3]">{summary?.salon_name ?? "Recensione"}</p><h1 className="mt-2 text-3xl font-bold">Com&apos;è andata?</h1><p className="mt-3 text-sm text-stone-300">{summary ? `${summary.service_name} · ${new Date(summary.starts_at).toLocaleDateString("it-IT")}` : loading ? "Caricamento…" : "Invito non disponibile"}</p></header>
    <div className="space-y-6 p-7">
      {summary && <><div><p className="mb-3 font-semibold">La tua valutazione</p><div className="flex justify-between">{[1, 2, 3, 4, 5].map((star) => <button aria-label={`${star} stelle`} className={`rounded-2xl px-2 text-4xl transition hover:-translate-y-0.5 ${star <= state.rating ? "bg-[#f3e2eb] text-[#a33d72]" : "text-stone-200 hover:bg-stone-50"}`} key={star} onClick={() => dispatch({ rating: star, type: "rating" })} type="button">★</button>)}</div></div>
      <label className="block font-semibold">Commento <span className="font-normal text-stone-400">(facoltativo)</span><textarea className="mt-2 w-full rounded-2xl border border-stone-200 p-4 font-normal" onChange={(event) => dispatch({ comment: event.target.value, type: "comment" })} placeholder="Raccontaci cosa hai apprezzato..." rows={5} value={state.comment} /></label></>}
      {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{state.error}</p>}
      {summary && <button className="min-h-13 w-full rounded-xl bg-[#792f59] font-bold text-white shadow-[0_10px_24px_rgb(45_29_39_/_0.12)] transition hover:-translate-y-0.5 disabled:opacity-45 disabled:shadow-none" disabled={!state.rating || state.submitting} onClick={() => void submit()} type="button">{state.submitting ? "Invio in corso…" : "Invia recensione"}</button>}
    </div>
  </section></main>;
}
