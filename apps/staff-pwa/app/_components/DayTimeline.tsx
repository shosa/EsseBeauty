import type { WorkingHours } from "@esse-beauty/shared";
import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel } from "@esse-beauty/shared";

import { minutesOfPeriod, time, weekdayKeys } from "../../lib/format";
import type { Appointment, CalendarBlock } from "../../lib/types";

export function DayTimeline({
  appointments,
  blocks,
  color,
  day,
  name,
  onOpen,
  workingHours,
}: {
  appointments: Appointment[];
  blocks: CalendarBlock[];
  color: string;
  day: Date;
  name: string;
  onOpen(id: string): void;
  workingHours: WorkingHours;
}) {
  const dayKey = weekdayKeys[day.getDay()] ?? "mon";
  const schedule = (workingHours?.[dayKey] ?? [])
    .map((period) => ({ from: minutesOfPeriod(period.from), to: minutesOfPeriod(period.to) }))
    .sort((left, right) => left.from - right.from);
  const eventMinutes = [
    ...appointments.flatMap((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
    }),
    ...blocks.flatMap((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
    }),
  ];
  const bounds = [...schedule.flatMap((period) => [period.from, period.to]), ...eventMinutes];
  const startHour = bounds.length ? Math.max(0, Math.floor(Math.min(...bounds) / 60)) : 9;
  const endHour = bounds.length ? Math.min(24, Math.ceil(Math.max(...bounds) / 60)) : 19;
  const safeEndHour = Math.max(startHour + 1, endHour);
  const hourHeight = 78;
  const height = (safeEndHour - startHour) * hourHeight;
  const hours = Array.from({ length: safeEndHour - startHour + 1 }, (_, index) => startHour + index);

  function position(from: number, to: number, minimumHeight = 0) {
    const top = Math.max(0, (from - startHour * 60) / 60 * hourHeight);
    const bottom = Math.min(height, (to - startHour * 60) / 60 * hourHeight);
    return { height: Math.max(minimumHeight, bottom - top), top };
  }

  function itemPosition(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return position(start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes(), 40);
  }

  const gaps: Array<{ from: number; to: number }> = [];
  let cursor = startHour * 60;
  for (const period of schedule) {
    const from = Math.max(cursor, period.from);
    if (from > cursor) gaps.push({ from: cursor, to: from });
    cursor = Math.max(cursor, Math.min(safeEndHour * 60, period.to));
  }
  if (cursor < safeEndHour * 60) gaps.push({ from: cursor, to: safeEndHour * 60 });

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <header className="grid grid-cols-[58px_1fr] border-b border-stone-200 bg-white">
        <span className="border-r border-stone-200 py-4 text-center text-[9px] font-black uppercase tracking-[.16em] text-stone-400">Ora</span>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 place-items-center rounded-full text-sm font-black text-white" style={{ background: color }}>{name.slice(0, 1).toUpperCase()}</span>
          <div><b className="block text-sm">{name}</b><span className="text-[10px] font-semibold text-stone-400">{appointments.length} appuntamenti</span></div>
        </div>
      </header>
      <div className="grid grid-cols-[58px_1fr]">
        <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height }}>
          {hours.map((hour, index) => (
            <span className="absolute left-0 right-0 pr-2 text-right text-[10px] font-black text-stone-500" key={hour} style={{ top: index === 0 ? 7 : index === hours.length - 1 ? height - 18 : (hour - startHour) * hourHeight - 7 }}>
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        <div className="relative bg-white" style={{ height }}>
          {hours.slice(0, -1).map((hour) => <span className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: (hour - startHour) * hourHeight }} />)}
          {hours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => <span className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: ((hour - startHour) * 60 + minute) / 60 * hourHeight }} />))}
          {gaps.map((gap) => (
            <div className="absolute left-0 right-0 z-[1] flex items-center justify-center overflow-hidden border-y border-stone-300/80" key={`${gap.from}-${gap.to}`} style={{ ...position(gap.from, gap.to), background: "repeating-linear-gradient(135deg, rgba(120,113,108,.08) 0, rgba(120,113,108,.08) 8px, rgba(120,113,108,.20) 8px, rgba(120,113,108,.20) 10px)" }}>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-stone-500 shadow-sm">Non lavorativo</span>
            </div>
          ))}
          {blocks.map((block) => (
            <div className="absolute left-2 right-2 z-10 overflow-hidden rounded-xl border border-amber-300 px-3 py-2 text-[10px] font-black text-amber-950 shadow-sm" key={block.id} style={{ ...itemPosition(block.starts_at, block.ends_at), background: "repeating-linear-gradient(135deg, #fffbeb 0, #fffbeb 8px, #fde68a 8px, #fde68a 11px)" }}>
              <span>{time(block.starts_at)}–{time(block.ends_at)}</span>
              <span className="ml-2 uppercase">{block.reason || "Assenza / non disponibile"}</span>
            </div>
          ))}
          {appointments.map((item) => {
            const duration = (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000;
            const short = duration < 30;
            const confirmed = item.status === "confirmed";
            const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
            return (
              <button className={`absolute left-2 right-2 z-10 overflow-hidden rounded-xl border pr-20 text-left active:scale-[.99] ${confirmed ? "border-white/80 text-white shadow-[0_8px_22px_rgb(45_29_39_/_0.16)]" : "shadow-[0_6px_16px_rgb(68_64_60_/_0.10)]"} ${short ? "flex items-center gap-2 py-1.5 pl-3" : "py-2 pl-3"}`} key={item.id} onClick={() => onOpen(item.id)} style={{ ...itemPosition(item.starts_at, item.ends_at), background: confirmed ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 72%, white))` : palette?.background, borderColor: confirmed ? undefined : palette?.border, color: confirmed ? undefined : palette?.text }} title={`${time(item.starts_at)}–${time(item.ends_at)} · ${item.customer_name} · ${item.service_name} · ${appointmentStatusLabel(item.status)}`} type="button">
                <span className="shrink-0 text-[10px] font-black">{time(item.starts_at)}–{time(item.ends_at)}</span>
                <strong className={`${short ? "min-w-0 truncate text-xs" : "mt-1 block truncate text-sm"} uppercase`}>{item.customer_name}</strong>
                <span className={`${short ? "hidden min-w-0 truncate text-[10px] font-semibold opacity-75 sm:block" : "mt-1 block truncate text-[10px] font-semibold opacity-75"}`}>{short ? `· ${item.service_name}` : item.service_name}</span>
                <span className={`absolute right-2 top-1/2 max-w-16 -translate-y-1/2 truncate rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[.06em] backdrop-blur-sm ${confirmed ? "border-white/20 bg-black/16 text-white" : "border-current/20 bg-white/55"}`}>{appointmentStatusLabel(item.status)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
