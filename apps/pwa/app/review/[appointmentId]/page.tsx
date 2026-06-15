"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Summary {
  salon_name: string;
  service_name: string;
  starts_at: string;
  customer_name: string;
}

export default function ReviewPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [summary, setSummary] = useState<Summary>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`${api}/api/public/reviews/${appointmentId}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then(setSummary);
  }, [appointmentId]);

  async function submit() {
    const response = await fetch(`${api}/api/public/reviews/${appointmentId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment: comment || undefined }),
    });
    if (response.ok) setDone(true);
    else setError(response.status === 409 ? "Hai già inviato una recensione." : "Non è stato possibile inviare la recensione.");
  }

  if (done) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f1f4] p-5"><section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><div className="text-5xl text-[#792f59]">★★★★★</div><h1 className="mt-5 text-3xl font-bold">Grazie del tuo tempo</h1><p className="mt-3 text-stone-600">La tua esperienza aiuta il salone a migliorare.</p></section></main>;
  }

  return <main className="min-h-screen bg-[#f6f1f4] px-4 py-10"><section className="mx-auto max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-xl">
    <header className="bg-[#321c2a] p-7 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8b9d3]">{summary?.salon_name ?? "Recensione"}</p><h1 className="mt-2 text-3xl font-bold">Com&apos;è andata?</h1><p className="mt-3 text-sm text-stone-300">{summary ? `${summary.service_name} · ${new Date(summary.starts_at).toLocaleDateString("it-IT")}` : "Caricamento…"}</p></header>
    <div className="space-y-6 p-7"><div><p className="mb-3 font-semibold">La tua valutazione</p><div className="flex justify-between">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => setRating(star)} className={`text-4xl transition ${star <= rating ? "text-[#a33d72]" : "text-stone-200"}`} aria-label={`${star} stelle`}>★</button>)}</div></div>
      <label className="block font-semibold">Commento <span className="font-normal text-stone-400">(facoltativo)</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-stone-200 p-4 font-normal outline-none focus:border-[#792f59]" placeholder="Raccontaci cosa hai apprezzato…" /></label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={!rating} onClick={() => void submit()} className="min-h-13 w-full rounded-xl bg-[#792f59] font-bold text-white disabled:opacity-35">Invia recensione</button>
    </div>
  </section></main>;
}
