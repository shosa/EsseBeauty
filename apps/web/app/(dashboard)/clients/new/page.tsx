"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle, Tag, X } from "lucide-react";
import { AppPage, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewClientPage() {
  const router = useRouter();
  const { salon } = useAuth();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [whatsAppConsent, setWhatsAppConsent] = useState(false);
  const [consentSource, setConsentSource] = useState("in_person");
  const [consentNote, setConsentNote] = useState("");
  const [createdCustomerId, setCreatedCustomerId] = useState<string>();

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    setTags((current) => current.some((item) => item.toLocaleLowerCase("it-IT") === value.toLocaleLowerCase("it-IT")) ? current : [...current, value]);
    setTagInput("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salon || saving) return;
    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get("phone") ?? "").trim();
    if (whatsAppConsent && !phone) {
      setError("Inserisci il numero di telefono per concedere il consenso WhatsApp.");
      return;
    }
    setSaving(true);
    setError("");
    let customerId = createdCustomerId;
    if (!customerId) {
      const response = await fetch(`${api}/api/salons/${salon.id}/customers`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: formData.get("first_name"),
          last_name: formData.get("last_name"),
          email: formData.get("email") || undefined,
          phone: phone || undefined,
          notes: formData.get("notes") || undefined,
          tags,
        }),
      });
      if (!response.ok) {
        setError("Impossibile creare il cliente.");
        setSaving(false);
        return;
      }
      const customer = (await response.json()) as { id: string };
      customerId = customer.id;
      setCreatedCustomerId(customer.id);
    }
    if (whatsAppConsent) {
      const consentResponse = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}/communication-consents/whatsapp-marketing`, {
        body: JSON.stringify({ evidence_note: consentNote, source: consentSource, status: "granted" }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!consentResponse.ok) {
        setError("Cliente creato, ma il consenso WhatsApp non è stato registrato. Riprova il salvataggio.");
        setSaving(false);
        return;
      }
    }
    router.push(`/clients/${customerId}`);
  }

  return <AppPage maxWidth="max-w-[1600px]"><form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#7b3159]">CRM</p><h1 className="mt-2 text-3xl font-bold">Nuovo cliente</h1>
    <div className="mt-7 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold">Nome<input autoComplete="given-name" required name="first_name" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold">Cognome<input autoComplete="family-name" required name="last_name" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold">Email<input type="email" name="email" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <label className="text-sm font-semibold">Telefono<input name="phone" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
      <div className="text-sm font-semibold md:col-span-2">
        <label htmlFor="customer-tag">Tag</label>
        <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 focus-within:border-[#7b3159]">
          {tags.map((item) => <span className="inline-flex items-center gap-1 rounded-lg bg-[#f4e4ec] px-2.5 py-1.5 text-xs font-bold text-[#682849]" key={item}><Tag size={13} />{item}<button aria-label={`Rimuovi tag ${item}`} className="ml-1 text-[#7b3159] hover:text-red-700" onClick={() => setTags((current) => current.filter((tag) => tag !== item))} type="button"><X size={13} /></button></span>)}
          <input className="min-w-40 flex-1 border-0 px-1 py-1.5 font-normal outline-none" id="customer-tag" onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder={tags.length ? "Aggiungi un altro tag" : "Scrivi un tag e premi Invio"} value={tagInput} />
        </div>
      </div>
      <label className="text-sm font-semibold md:col-span-2">Note<textarea name="notes" rows={5} className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal" /></label>
    </div>
    <section className="mt-6 overflow-hidden rounded-xl border border-emerald-100 bg-white">
      <div className="flex items-center justify-between gap-4 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white"><MessageCircle size={18} /></span><div><h2 className="text-sm font-bold">Consensi comunicazioni</h2><p className="text-xs text-stone-600">Marketing e promozioni via WhatsApp</p></div></div>
        <Switch aria-label="Consenso marketing WhatsApp" checked={whatsAppConsent} onCheckedChange={setWhatsAppConsent} />
      </div>
      {whatsAppConsent && <div className="grid gap-4 border-t border-emerald-100 p-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Fonte di acquisizione<select className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 font-normal" onChange={(event) => setConsentSource(event.target.value)} value={consentSource}><option value="in_person">Acquisito in salone</option><option value="customer_request">Richiesta del cliente</option><option value="web_form">Modulo online</option><option value="import_verified">Importazione verificata</option><option value="manual_admin">Inserimento amministrativo</option></select></label>
        <label className="text-sm font-semibold">Nota o evidenza<textarea className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3 font-normal" onChange={(event) => setConsentNote(event.target.value)} placeholder="Es. consenso espresso in reception" rows={2} value={consentNote} /></label>
      </div>}
    </section>
    {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => router.back()} className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-50">Annulla</button><button type="submit" disabled={saving} className="rounded-xl bg-[#7b3159] px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Salvataggio..." : createdCustomerId ? "Riprova consenso" : "Crea cliente"}</button></div>
  </form></AppPage>;
}
