"use client";

import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, Dialog, EmptyState, PageHeaderMetrics, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Review {
  comment?: string;
  created_at: string;
  customer_name: string;
  id: string;
  published: boolean;
  rating: number;
  reply?: string;
}

function stars(rating: number) {
  return (
    <span className="text-[#b85888]">
      {"★".repeat(rating)}
      <span className="text-stone-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const { hasPermission, salon } = useAuth();
  const [items, setItems] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review>();
  const [reply, setReply] = useState("");
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/reviews`, { credentials: "include" }).then((response) => response.json()).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon]);
  const average = useMemo(() => items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0, [items]);
  const published = useMemo(() => items.filter((item) => item.published).length, [items]);
  const unanswered = useMemo(() => items.filter((item) => !item.reply).length, [items]);

  async function saveReply() {
    await fetch(`${api}/api/salons/${salon?.id}/reviews/${selected?.id}/reply`, {
      body: JSON.stringify({ reply }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    setSelected(undefined);
    await load();
  }

  async function setPublished(item: Review, nextPublished: boolean) {
    await fetch(`${api}/api/salons/${salon?.id}/reviews/${item.id}/publish`, {
      body: JSON.stringify({ published: nextPublished }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    await load();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeaderMetrics
        eyebrow="Voce dei clienti"
        metrics={[
          { detail: "Su 5 stelle", label: "Media", value: average.toFixed(1) },
          { detail: "Visibili ai clienti", label: "Pubblicate", value: published },
          { detail: "Senza risposta", label: "Da rispondere", value: unanswered },
        ]}
        title="Recensioni"
        subtitle="Rispondi ai feedback e scegli cosa rendere pubblico nella pagina del salone."
        status={<StatusBadge status={items.length > 0 ? "active" : "draft"}>{items.length} recensioni</StatusBadge>}
      />

      <SectionCard title="Distribuzione voti" subtitle="Una lettura rapida della soddisfazione recente.">
        <div className="grid gap-3 md:grid-cols-5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = items.filter((item) => item.rating === star).length;
            const height = items.length ? (count / items.length) * 100 : 0;
            return (
              <div className="rounded-2xl border border-[#ead1df] bg-[#fffafd] p-3 text-center" key={star}>
                <b className="text-sm text-[#792f59]">{star}★</b>
                <div className="mx-auto mt-3 flex h-24 w-8 items-end rounded-full bg-white p-1 shadow-inner">
                  <div className="w-full rounded-full bg-[linear-gradient(180deg,#b85888,#792f59)]" style={{ height: `${height}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold text-stone-500">{count}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard className="mt-6" title="Feedback clienti" subtitle="Ogni recensione resta gestibile senza uscire dalla pagina.">
        {items.length === 0 ? (
          <EmptyState title="Nessuna recensione" description="Le recensioni compariranno dopo gli appuntamenti completati." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article className="rounded-2xl border border-white/80 bg-white/82 p-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.06)] ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:border-[#d7a6c1]" key={item.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">{stars(item.rating)}</p>
                    <h2 className="mt-1 text-lg font-bold text-stone-950">{item.customer_name}</h2>
                    <time className="text-xs font-semibold uppercase tracking-[.08em] text-stone-400">{new Date(item.created_at).toLocaleDateString("it-IT")}</time>
                  </div>
                  <StatusBadge status={item.published ? "active" : "inactive"}>{item.published ? "Pubblicata" : "Privata"}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-stone-600">{item.comment || "Nessun commento."}</p>
                {item.reply && <p className="mt-4 rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 text-sm leading-6 text-stone-600"><b className="text-[#792f59]">Risposta:</b> {item.reply}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => { setSelected(item); setReply(item.reply ?? ""); }} variant="outline">Rispondi</Button>
                  {hasPermission(PERMISSION_KEYS.SETTINGS_SALON) && (
                    <Button onClick={() => void setPublished(item, !item.published)} variant="tableAction">
                      {item.published ? "Rendi privata" : "Pubblica"}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog
        footer={<><Button onClick={() => setSelected(undefined)} variant="outline">Annulla</Button><Button onClick={() => void saveReply()} variant="primary">Salva risposta</Button></>}
        onClose={() => setSelected(undefined)}
        open={Boolean(selected)}
        title={`Rispondi a ${selected?.customer_name ?? "cliente"}`}
      >
        <textarea className="w-full" onChange={(event) => setReply(event.target.value)} rows={5} value={reply} />
      </Dialog>
    </AppPage>
  );
}
