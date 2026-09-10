import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel } from "@esse-beauty/shared";
import { StatusBadge } from "@esse-beauty/ui";

import { time } from "../../lib/format";
import type { Appointment } from "../../lib/types";

export function AppointmentRow({ color, item, onOpen }: { color: string; item: Appointment; onOpen(): void }) {
  const confirmed = item.status === "confirmed";
  const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
  return (
    <button
      className="w-full rounded-2xl border bg-white p-4 text-left transition active:scale-[.98]"
      onClick={onOpen}
      style={{ borderColor: confirmed ? color : palette?.border, borderLeftWidth: confirmed ? 4 : 1, background: confirmed ? "white" : palette?.background }}
      type="button"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 shrink-0 text-center">
          <b className="block text-lg font-black tracking-[-.02em] text-stone-950">{time(item.starts_at)}</b>
          <span className="text-[10px] font-bold text-stone-400">{time(item.ends_at)}</span>
        </div>
        <div className="min-w-0 flex-1 border-l border-stone-100 pl-4">
          <h3 className="truncate font-black text-stone-950">{item.customer_name}</h3>
          <p className="truncate text-xs font-semibold text-stone-500">{item.service_name}</p>
        </div>
        <StatusBadge status={item.status}>{appointmentStatusLabel(item.status)}</StatusBadge>
      </div>
    </button>
  );
}
