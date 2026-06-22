"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Campaign {
  channel: "email" | "sms";
  content: string;
  id: string;
  name: string;
  scheduledAt?: string | null;
  status: string;
  targetSegment: { type: string };
}

interface Stats {
  failed_count: number;
  recipient_count: number;
  sent_count: number;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();
  const { salon } = useAuth();
  const [campaign, setCampaign] = useState<Campaign>();
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmSend, setConfirmSend] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const [campaignsResponse, statsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/campaigns`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/campaigns/${campaignId}/stats`, { credentials: "include" }),
    ]);
    if (!campaignsResponse.ok) {
      setError("Impossibile caricare la campagna.");
      setLoading(false);
      return;
    }
    const campaigns = await campaignsResponse.json() as Campaign[];
    setCampaign(campaigns.find((item) => item.id === campaignId));
    setStats(statsResponse.ok ? await statsResponse.json() as Stats : undefined);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, campaignId]);

  async function save(data: FormData) {
    if (!salon || !campaign) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns/${campaign.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        content: data.get("content"),
        scheduled_at: data.get("scheduled") || null,
      }),
    });
    if (!response.ok) {
      setError("Solo le campagne in bozza possono essere modificate.");
      return;
    }
    await load();
  }

  async function send() {
    if (!salon || !campaign) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns/${campaign.id}/send`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Campagna non inviabile.");
      setConfirmSend(false);
      return;
    }
    setConfirmSend(false);
    await load();
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs items={[{ href: "/marketing", label: "Marketing" }, { label: campaign?.name ?? "Campagna" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!campaign ? (
          <EmptyState title="Campagna non trovata" description="Potrebbe essere stata rimossa o non essere accessibile." />
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <form action={save} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Campagna</p>
                <h1 className="mt-2 text-3xl font-bold">{campaign.name}</h1>
                <p className="mt-2 text-sm text-stone-600">La campagna resta in bozza finché non confermi esplicitamente l'invio.</p>
              </div>
              <label className="text-sm font-semibold">Nome<input name="name" defaultValue={campaign.name} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <label className="text-sm font-semibold">Contenuto<textarea name="content" defaultValue={campaign.content} rows={8} required className="mt-1 w-full rounded-xl border border-stone-200 p-3" /></label>
              <label className="text-sm font-semibold">Programma invio<input name="scheduled" type="datetime-local" defaultValue={campaign.scheduledAt?.slice(0, 16) ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => router.push("/marketing")}>Torna</Button>
                <Button type="submit" variant="secondary">Salva bozza</Button>
                <Button type="button" onClick={() => setConfirmSend(true)}>Conferma invio</Button>
              </div>
            </form>
            <aside className="rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
              <h2 className="text-xl font-bold">Riepilogo</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="font-bold">Canale</dt><dd>{campaign.channel.toUpperCase()}</dd></div>
                <div><dt className="font-bold">Segmento</dt><dd>{campaign.targetSegment.type.replace("_", " ")}</dd></div>
                <div><dt className="font-bold">Stato</dt><dd>{campaign.status}</dd></div>
                <div><dt className="font-bold">Destinatari</dt><dd>{stats?.recipient_count ?? 0}</dd></div>
                <div><dt className="font-bold">Inviati</dt><dd>{stats?.sent_count ?? 0}</dd></div>
                <div><dt className="font-bold">Falliti</dt><dd>{stats?.failed_count ?? 0}</dd></div>
              </dl>
            </aside>
          </div>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="Invia"
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => void send()}
        open={confirmSend}
        title="Confermare invio campagna?"
        description="L'invio partirà solo dopo questa conferma esplicita."
      />
    </AppPage>
  );
}
