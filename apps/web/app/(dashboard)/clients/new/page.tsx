"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewClientPage() {
  const router = useRouter();
  const { salon } = useAuth();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    if (!salon) return;
    setSaving(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/customers`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: formData.get("full_name"),
        email: formData.get("email") || undefined,
        phone: formData.get("phone") || undefined,
        notes: formData.get("notes") || undefined,
        tags: String(formData.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      }),
    });
    if (!response.ok) {
      setError("Impossibile creare il cliente.");
      setSaving(false);
      return;
    }
    const customer = (await response.json()) as { id: string };
    router.push(`/clients/${customer.id}`);
  }

  return <main className="min-h-screen bg-[#f7f4f2] p-4 md:p-8"><form action={submit} className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm md:p-8">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#7b3159]">CRM</p><h1 className="mt-2 text-3xl font-bold">Nuovo cliente</h1>
    <div className="mt-7 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold md:col-span-2">Nome completo<input required name="full_name" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold">Email<input type="email" name="email" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold">Telefono<input name="phone" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold md:col-span-2">Tag, separati da virgola<input name="tags" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold md:col-span-2">Note<textarea name="notes" rows={5} className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
    </div>
    {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="rounded-xl border px-4 py-3 font-semibold">Annulla</button><button disabled={saving} className="rounded-xl bg-[#7b3159] px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Salvataggio..." : "Crea cliente"}</button></div>
  </form></main>;
}
