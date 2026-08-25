"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Campaign {
  channel: "email" | "whatsapp";
  content: string;
  id: string;
  name: string;
  recipientPreview?: Array<{ destination?: string | null; name?: string; reason?: string }>;
  scheduledAt?: string | null;
  status: string;
  targetSegment: { type: string };
}

interface Stats {
  failed_count: number;
  processing_count: number;
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
  const [readiness, setReadiness] = useState<Record<"email" | "whatsapp", "ready" | "not_configured">>();

  async function load(showLoading = true) {
    if (!salon) return;
    if (showLoading) setLoading(true);
    const [campaignsResponse, statsResponse, readinessResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/campaigns`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/campaigns/${campaignId}/stats`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/campaigns/readiness`, { credentials: "include" }),
    ]);
    if (!campaignsResponse.ok) {
      setError("Impossibile caricare la campagna.");
      setLoading(false);
      return;
    }
    const campaigns = await campaignsResponse.json() as Campaign[];
    setCampaign(campaigns.find((item) => item.id === campaignId));
    setStats(statsResponse.ok ? await statsResponse.json() as Stats : undefined);
    if (readinessResponse.ok) setReadiness(await readinessResponse.json() as Record<"email" | "whatsapp", "ready" | "not_configured">);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, campaignId]);

  useEffect(() => {
    if (!campaign || !["queued", "processing"].includes(campaign.status)) return;
    const timer = window.setInterval(() => void load(false), 3_000);
    return () => window.clearInterval(timer);
  }, [campaign?.status, salon?.id, campaignId]);

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
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "PROVIDER_NOT_CONFIGURED" ? "Provider non configurato per questo canale." : body.error === "CAMPAIGN_HAS_NO_RECIPIENTS" ? "Nessun destinatario valido per questa campagna." : "Campagna non inviabile.");
      setConfirmSend(false);
      return;
    }
    setConfirmSend(false);
    await load();
  }

  async function operate(action: "cancel" | "retry-failures") {
    if (!salon || !campaign) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/campaigns/${campaign.id}/${action}`, { method: "POST", credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "PROVIDER_NOT_CONFIGURED" ? "Provider non configurato per questo canale." : action === "cancel" ? "La campagna è già in elaborazione e non può essere annullata." : "Impossibile riprovare gli invii falliti.");
      return;
    }
    await load(false);
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
              {readiness?.[campaign.channel] !== "ready" && <InlineError>Provider non configurato per il canale {campaign.channel.toUpperCase()}.</InlineError>}
              <label className="text-sm font-semibold">Nome<input name="name" defaultValue={campaign.name} disabled={campaign.status !== "draft"} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 disabled:bg-stone-100" /></label>
              <label className="text-sm font-semibold">Contenuto<textarea name="content" defaultValue={campaign.content} disabled={campaign.status !== "draft"} rows={8} required className="mt-1 w-full rounded-xl border border-stone-200 p-3 disabled:bg-stone-100" /></label>
              <label className="text-sm font-semibold">Programma invio<input name="scheduled" type="datetime-local" disabled={campaign.status !== "draft"} defaultValue={campaign.scheduledAt?.slice(0, 16) ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 disabled:bg-stone-100" /></label>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><h2 className="font-bold">Anteprima destinatari</h2><p className="mt-1 text-sm text-stone-600">{campaign.recipientPreview?.filter((item) => item.destination).length ?? 0} recapiti mostrati · {campaign.recipientPreview?.filter((item) => !item.destination).length ?? 0} esclusi</p></div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => router.push("/marketing")}>Torna</Button>
                {campaign.status === "draft" && <Button type="submit" variant="secondary">Salva bozza</Button>}
                {campaign.status === "draft" && <Button type="button" disabled={readiness?.[campaign.channel] !== "ready" || !campaign.recipientPreview?.some((item) => item.destination)} onClick={() => setConfirmSend(true)}>Conferma invio</Button>}
                {["queued", "scheduled"].includes(campaign.status) && <Button type="button" variant="secondary" onClick={() => void operate("cancel")}>Annulla pianificazione</Button>}
                {["failed", "partial"].includes(campaign.status) && stats && stats.failed_count > 0 && <Button type="button" onClick={() => void operate("retry-failures")}>Riprova falliti</Button>}
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
                <div><dt className="font-bold">In elaborazione</dt><dd>{stats?.processing_count ?? 0}</dd></div>
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
