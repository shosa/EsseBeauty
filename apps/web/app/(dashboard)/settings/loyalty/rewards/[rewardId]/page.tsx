"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs, Button, ConfirmDialog, EmptyState, FormField, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Reward {
  active: boolean;
  description: string | null;
  id: string;
  name: string;
  pointsRequired: number;
}

export default function RewardDetailPage() {
  const { rewardId } = useParams<{ rewardId: string }>();
  const { salon } = useAuth();
  const router = useRouter();
  const [reward, setReward] = useState<Reward>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare il premio.");
      setLoading(false);
      return;
    }
    const rewards = await response.json() as Reward[];
    setReward(rewards.find((item) => item.id === rewardId));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, rewardId]);

  async function save(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${rewardId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        description: data.get("description") || undefined,
        points_required: Number(data.get("points")),
      }),
    });
    if (!response.ok) {
      setError("Premio non salvato.");
      return;
    }
    await load();
  }

  async function remove() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${rewardId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Premio non eliminato.");
      return;
    }
    router.push("/settings/loyalty");
  }

  if (loading) return <PageSkeleton />;

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-[1200px]">
        <Breadcrumbs items={[{ href: "/settings/loyalty", label: "Fedeltà" }, { label: reward?.name ?? "Premio" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!reward ? (
          <EmptyState title="Premio non trovato" description="Potrebbe essere stato eliminato o non accessibile." />
        ) : (
          <form action={save} className="mt-5 grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="text-3xl font-bold">{reward.name}</h1>
            <FormField label="Nome premio" required><input required name="name" defaultValue={reward.name} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
            <FormField label="Punti richiesti" required><input required name="points" type="number" min="1" defaultValue={reward.pointsRequired} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
            <FormField label="Descrizione"><textarea name="description" defaultValue={reward.description ?? ""} className="min-h-28 w-full rounded-xl border p-3" /></FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Elimina</Button>
              <Button type="submit">Salva</Button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} destructive title="Eliminare premio?" description="Il premio non sarà più disponibile nel programma fedeltà." confirmLabel="Elimina" onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
    </main>
  );
}
