import { Send, X } from "lucide-react";

import { Button, DateTimeField, FormField } from "@esse-beauty/ui";

export function RequestModal({
  canManageAgenda,
  endsAt,
  onClose,
  onEndsAtChange,
  onStartsAtChange,
  onSubmit,
  open,
  startsAt,
}: {
  canManageAgenda: boolean;
  endsAt: string;
  onClose(): void;
  onEndsAtChange(value: string): void;
  onStartsAtChange(value: string): void;
  onSubmit(formData: FormData): void;
  open: boolean;
  startsAt: string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-stone-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-[0_-20px_60px_rgb(45_29_39_/_0.28)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-stone-950">Nuova richiesta</h2>
          <button aria-label="Chiudi" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
        <form action={onSubmit} className="mt-5 space-y-4">
          <FormField label="Dal" required><DateTimeField name="starts_at" onChange={onStartsAtChange} required value={startsAt} /></FormField>
          <FormField label="Al" required><DateTimeField name="ends_at" onChange={onEndsAtChange} required value={endsAt} /></FormField>
          <FormField label="Motivo"><textarea name="reason" placeholder="Ferie, visita, permesso..." /></FormField>
          <Button className="w-full" disabled={!canManageAgenda} type="submit" variant="primary"><Send className="size-4" />Invia richiesta</Button>
        </form>
      </div>
    </>
  );
}
