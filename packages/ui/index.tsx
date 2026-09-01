import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Trash2, X } from "lucide-react";

export const designTokens = {
  layout: {
    railWidth: "76px",
    tableRowHeight: "46px",
    topbarHeight: "64px",
  },
  color: {
    brand: {
      25: "#fffafd",
      50: "#faf3f7",
      100: "#f3e2eb",
      200: "#e8bfd4",
      300: "#d99aba",
      500: "#b85888",
      600: "#8f3a68",
      700: "#792f59",
      900: "#402334",
      950: "#2d1d27",
    },
    accent: {
      champagne: "#f4d8a8",
      ink: "#211820",
      petal: "#f8e8f0",
      sage: "#dce7dd",
    },
    danger: { bg: "#fef2f2", fg: "#b91c1c" },
    info: { bg: "#eff6ff", fg: "#1d4ed8" },
    success: { bg: "#ecfdf5", fg: "#047857" },
    surface: {
      card: "#ffffff",
      muted: "#f5f5f4",
      page: "#f7f5f2",
      pageAlt: "#f6f2f4",
    },
    text: {
      muted: "#78716c",
      primary: "#1c1917",
      secondary: "#57534e",
    },
    warning: { bg: "#fffbeb", fg: "#92400e" },
  },
  motion: {
    duration: {
      fast: 0.14,
      instant: 0.08,
      normal: 0.22,
      slow: 0.32,
    },
    ease: {
      emphasized: [0.16, 1, 0.3, 1] as const,
      exit: [0.4, 0, 1, 1] as const,
      standard: [0.2, 0, 0, 1] as const,
    },
  },
  radius: {
    full: "9999px",
    lg: "12px",
    md: "10px",
    none: "0",
    sm: "6px",
    xl: "16px",
    "2xl": "24px",
  },
  shadow: {
    focus: "0 0 0 4px rgb(184 88 136 / 0.18), 0 0 0 1px rgb(121 47 89 / 0.55)",
    lg: "0 24px 70px rgb(45 29 39 / 0.16), 0 2px 8px rgb(45 29 39 / 0.05)",
    md: "0 14px 34px rgb(45 29 39 / 0.10), 0 1px 2px rgb(45 29 39 / 0.06)",
    none: "none",
    sm: "0 6px 18px rgb(45 29 39 / 0.07)",
    glow: "0 18px 44px rgb(184 88 136 / 0.22)",
  },
  space: {
    0: "0",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  },
  type: {
    badge: "text-[11px] font-bold leading-4 tracking-[.04em]",
    body: "text-sm font-normal leading-[22px]",
    bodyStrong: "text-sm font-semibold leading-[22px]",
    error: "text-[13px] font-medium leading-5",
    helper: "text-xs font-normal leading-[18px]",
    metadata: "text-xs font-medium leading-[18px]",
    pageTitle: "text-[32px] font-bold leading-10 tracking-[-.01em]",
    pageTitleCompact: "text-[28px] font-bold leading-9 tracking-[-.01em]",
    sectionTitle: "text-xl font-bold leading-7",
    subsectionTitle: "text-base font-bold leading-6",
    tableHeader: "text-xs font-bold uppercase leading-4 tracking-[.08em]",
  },
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "sm" | "md" | "lg";
  variant?:
    | "default"
    | "destructive"
    | "ghost"
    | "icon"
    | "outline"
    | "primary"
    | "secondary"
    | "tableAction";
}

const buttonVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "border border-[#2d1d27] bg-[#2d1d27] text-white hover:bg-[#402334]",
  destructive: "border border-red-700 bg-red-700 text-white hover:bg-red-800",
  ghost: "bg-transparent text-stone-700 shadow-none hover:bg-white/75 hover:text-[#792f59]",
  icon: "bg-white/70 text-stone-600 shadow-none ring-1 ring-stone-950/5 hover:bg-[#faf3f7] hover:text-[#792f59]",
  outline: "border border-[#d7a6c1]/70 bg-white text-[#402334] shadow-none hover:border-[#792f59] hover:bg-[#fffafd] hover:text-[#792f59]",
  primary: "border border-[#792f59] bg-[#792f59] text-white shadow-none hover:border-[#66264b] hover:bg-[#66264b]",
  secondary: "border border-[#ead1df] bg-[#faf3f7] text-[#792f59] shadow-none hover:border-[#d99aba] hover:bg-[#f3e2eb]",
  tableAction: "border border-stone-200 bg-white/90 text-xs font-bold text-stone-700 shadow-none hover:border-[#792f59] hover:bg-[#faf3f7] hover:text-[#792f59]",
};

const buttonSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  lg: "min-h-12 rounded-xl px-5 py-3",
  md: "min-h-11 rounded-xl px-4 py-2.5",
  sm: "min-h-9 rounded-lg px-3 py-2 text-sm",
};

export function Button({
  active = false,
  className = "",
  size = "md",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      aria-pressed={active || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 font-semibold tracking-[-.01em] shadow-none transition-colors duration-150 active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "ring-2 ring-[#792f59]/25" : ""} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}

export function SaveActionButton({
  busy,
  className = "",
  disabled = false,
  idleLabel,
  onClick,
  saved,
  type = "button",
}: {
  busy: boolean;
  className?: string;
  disabled?: boolean;
  idleLabel: string;
  onClick?: () => void;
  saved: boolean;
  type?: "button" | "submit";
}) {
  return (
    <span aria-live="polite" className={`inline-flex ${className}`}>
      <Button
        aria-busy={busy}
        className={saved ? "save-action-confirmed" : "transition-[background-color,border-color,transform] duration-200"}
        disabled={disabled || busy}
        onClick={onClick}
        type={type}
        variant="primary"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : saved ? <Check aria-hidden="true" className="size-4" /> : null}
        {busy ? "Salvataggio…" : saved ? "Salvato" : idleLabel}
      </Button>
    </span>
  );
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function DateField({
  "aria-label": ariaLabel = "Data",
  className = "",
  disabled = false,
  max,
  min,
  name,
  onChange,
  required = false,
  value,
}: {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  max?: string;
  min?: string;
  name?: string;
  onChange(value: string): void;
  required?: boolean;
  value: string;
}) {
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(visibleMonth);
  const formattedValue = selected ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(selected) : "Seleziona data";
  const today = isoDate(new Date());
  const days = useMemo(() => {
    const firstWeekday = (visibleMonth.getDay() + 6) % 7;
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  }, [visibleMonth]);

  function placePopup() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const popupWidth = Math.min(344, window.innerWidth - viewportPadding * 2);
    const popupHeight = popupRef.current?.offsetHeight ?? 404;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - popupWidth - viewportPadding));
    const top = spaceBelow >= Math.min(popupHeight, 360) || spaceBelow >= spaceAbove
      ? Math.min(rect.bottom + 8, window.innerHeight - Math.min(popupHeight, window.innerHeight - viewportPadding * 2) - viewportPadding)
      : Math.max(viewportPadding, rect.top - popupHeight - 8);
    setPopupPosition({ left, top: Math.max(viewportPadding, top) });
  }

  function focusDate(iso: string) {
    window.requestAnimationFrame(() => {
      popupRef.current?.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)?.focus();
    });
  }

  function closeCalendar(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveDayFocus(event: ReactKeyboardEvent<HTMLButtonElement>, day: Date) {
    const offsets: Partial<Record<string, number>> = {
      ArrowDown: 7,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
    };
    let next: Date | undefined;
    const offset = offsets[event.key];
    if (offset !== undefined) next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
    if (event.key === "Home") next = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
    if (event.key === "End") next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + (6 - ((day.getDay() + 6) % 7)));
    if (event.key === "PageUp") next = new Date(day.getFullYear(), day.getMonth() - 1, day.getDate());
    if (event.key === "PageDown") next = new Date(day.getFullYear(), day.getMonth() + 1, day.getDate());
    if (!next) return;
    const nextIso = isoDate(next);
    if ((min && nextIso < min) || (max && nextIso > max)) return;
    event.preventDefault();
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    focusDate(nextIso);
  }

  useEffect(() => {
    if (!open) return;
    placePopup();
    focusDate(value || today);
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) closeCalendar();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeCalendar(true); };
    const reposition = () => placePopup();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, value]);

  const calendar = open && popupPosition && typeof document !== "undefined" ? createPortal(
    <div className="pointer-events-none fixed inset-0 isolate z-[9999]" data-esse-overlay-root="date-picker">
      <div
        aria-labelledby={dialogTitleId}
        aria-modal="false"
        className="pointer-events-auto fixed max-h-[calc(100dvh-16px)] w-[344px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-3 shadow-[0_22px_64px_rgb(45_29_39_/_0.22)]"
        ref={popupRef}
        role="dialog"
        style={{ left: popupPosition.left, top: popupPosition.top }}
      >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button aria-label="Mese precedente" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} type="button"><ChevronLeft aria-hidden="true" className="size-4" /></button>
        <strong className="capitalize text-sm" id={dialogTitleId}>{monthLabel}</strong>
        <button aria-label="Mese successivo" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} type="button"><ChevronRight aria-hidden="true" className="size-4" /></button>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-[11px] font-bold text-stone-500">{["L", "M", "M", "G", "V", "S", "D"].map((day, index) => <span className="py-1" key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-0.5">{days.map((day) => {
        const iso = isoDate(day);
        const outside = day.getMonth() !== visibleMonth.getMonth();
        const unavailable = Boolean((min && iso < min) || (max && iso > max));
        const active = iso === value;
        const dateLabel = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(day);
        return <button
          aria-current={iso === today ? "date" : undefined}
          aria-label={dateLabel}
          aria-pressed={active || undefined}
          className={`grid min-h-11 w-full place-items-center rounded-lg text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/25 disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-[#792f59] font-bold text-white" : outside ? "text-stone-400 hover:bg-stone-100" : iso === today ? "bg-stone-100 font-bold text-[#792f59] hover:bg-[#faf3f7]" : "text-stone-800 hover:bg-[#faf3f7]"}`}
          data-date={iso}
          disabled={unavailable}
          key={iso}
          onClick={() => { onChange(iso); closeCalendar(true); }}
          onKeyDown={(event) => moveDayFocus(event, day)}
          type="button"
        >{day.getDate()}</button>;
      })}</div>
      <div className={`mt-2 grid gap-2 ${value ? "grid-cols-2" : "grid-cols-1"}`}>
        <button className="min-h-11 rounded-lg text-sm font-semibold text-[#792f59] hover:bg-[#faf3f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" disabled={Boolean((min && today < min) || (max && today > max))} onClick={() => { onChange(today); closeCalendar(true); }} type="button">Oggi</button>
        {value && <button className="min-h-11 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" onClick={() => { onChange(""); closeCalendar(true); }} type="button">Cancella</button>}
      </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return <div className={`relative ${className}`} ref={rootRef}>
    {name && <input name={name} type="hidden" value={value} />}
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={`${ariaLabel}: ${formattedValue}`} aria-required={required || undefined} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--esse-line)] bg-white px-3 text-left text-sm text-stone-900 transition-colors hover:border-[#792f59]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500" disabled={disabled} onClick={() => { if (!open) placePopup(); setOpen((current) => !current); }} ref={triggerRef} type="button">
      <span>{formattedValue}</span><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
    </button>
    {calendar}
  </div>;
}

export function DateTimeField({
  "aria-label": ariaLabel = "Data e ora",
  className = "",
  disabled = false,
  min,
  name,
  onChange,
  required = false,
  step = 900,
  value,
}: {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  name?: string;
  onChange(value: string): void;
  required?: boolean;
  step?: number;
  value: string;
}) {
  const dateValue = value.slice(0, 10);
  const timeValue = value.slice(11, 16);
  const [selectedHour = "09", selectedMinute = "00"] = timeValue.split(":");
  const [timeOpen, setTimeOpen] = useState(false);
  const [timePopupPosition, setTimePopupPosition] = useState<{ left: number; top: number } | null>(null);
  const timeRootRef = useRef<HTMLDivElement>(null);
  const timePopupRef = useRef<HTMLDivElement>(null);
  const timeTriggerRef = useRef<HTMLButtonElement>(null);
  const minuteStep = Math.max(1, Math.min(30, Math.round(step / 60)));
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")), []);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => String(index * minuteStep).padStart(2, "0")),
    [minuteStep],
  );

  function placeTimePopup() {
    const trigger = timeTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    const width = Math.min(292, window.innerWidth - padding * 2);
    const height = timePopupRef.current?.offsetHeight ?? 312;
    const below = window.innerHeight - rect.bottom - padding;
    const above = rect.top - padding;
    const left = Math.max(padding, Math.min(rect.right - width, window.innerWidth - width - padding));
    const top = below >= Math.min(height, 280) || below >= above
      ? Math.min(rect.bottom + 8, window.innerHeight - Math.min(height, window.innerHeight - padding * 2) - padding)
      : Math.max(padding, rect.top - height - 8);
    setTimePopupPosition({ left, top: Math.max(padding, top) });
  }

  useEffect(() => {
    if (!timeOpen) return;
    placeTimePopup();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!timeRootRef.current?.contains(target) && !timePopupRef.current?.contains(target)) setTimeOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setTimeOpen(false); };
    const reposition = () => placeTimePopup();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [timeOpen]);

  const updateDate = (date: string) => onChange(date ? `${date}T${timeValue || "09:00"}` : "");
  const updateTime = (hour: string, minute: string) => onChange(`${dateValue || isoDate(new Date())}T${hour}:${minute}`);
  const timePicker = timeOpen && timePopupPosition && typeof document !== "undefined" ? createPortal(
    <div className="pointer-events-none fixed inset-0 isolate z-[9999]" data-esse-overlay-root="time-picker">
      <div
        aria-label="Seleziona ora e minuti"
        className="pointer-events-auto fixed max-h-[calc(100dvh-16px)] w-[292px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-3 shadow-[0_18px_48px_rgb(45_29_39_/_0.16)]"
        ref={timePopupRef}
        role="dialog"
        style={{ left: timePopupPosition.left, top: timePopupPosition.top }}
      >
        <div className="grid grid-cols-[1fr_84px] gap-3">
          <div>
            <p className="mb-2 text-xs font-bold text-stone-600">Ora</p>
            <div className="grid max-h-52 grid-cols-4 gap-1 overflow-y-auto pr-1">
              {hours.map((hour) => <button aria-pressed={hour === selectedHour} className={`min-h-11 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${hour === selectedHour ? "bg-[#792f59] text-white" : "text-stone-700 hover:bg-[#faf3f7]"}`} key={hour} onClick={() => updateTime(hour, selectedMinute)} type="button">{hour}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-stone-600">Minuti</p>
            <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto pr-1">
              {minutes.map((minute) => <button aria-pressed={minute === selectedMinute} className={`min-h-11 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${minute === selectedMinute ? "bg-[#792f59] text-white" : "text-stone-700 hover:bg-[#faf3f7]"}`} key={minute} onClick={() => { updateTime(selectedHour, minute); setTimeOpen(false); }} type="button">:{minute}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,.55fr)] ${className}`}>
      {name && <input name={name} type="hidden" value={value} />}
      <DateField
        aria-label={`${ariaLabel}, data`}
        disabled={disabled}
        min={min?.slice(0, 10)}
        onChange={updateDate}
        required={required}
        value={dateValue}
      />
      <div className="relative" ref={timeRootRef}>
        <button
          aria-expanded={timeOpen}
          aria-haspopup="dialog"
          aria-label={`${ariaLabel}, ora: ${timeValue || "non selezionata"}`}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--esse-line)] bg-white px-3 text-left text-sm text-stone-900 transition-colors hover:border-[#792f59]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
          disabled={disabled}
          onClick={() => { if (!timeOpen) placeTimePopup(); setTimeOpen((current) => !current); }}
          ref={timeTriggerRef}
          type="button"
        >
          <span>{timeValue || "Seleziona ora"}</span>
          <Clock3 aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
        </button>
        {timePicker}
      </div>
    </div>
  );
}

export type ExpandableActionTone =
  | "amber"
  | "emerald"
  | "fuchsia"
  | "indigo"
  | "orange"
  | "rose"
  | "sky"
  | "teal"
  | "violet";

const expandableActionTones: Record<ExpandableActionTone, string> = {
  amber: "border-amber-300 text-amber-700 hover:border-amber-600 hover:bg-amber-600 focus-visible:border-amber-600 focus-visible:bg-amber-600",
  emerald: "border-emerald-300 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 focus-visible:border-emerald-600 focus-visible:bg-emerald-600",
  fuchsia: "border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-600 hover:bg-fuchsia-600 focus-visible:border-fuchsia-600 focus-visible:bg-fuchsia-600",
  indigo: "border-indigo-300 text-indigo-700 hover:border-indigo-600 hover:bg-indigo-600 focus-visible:border-indigo-600 focus-visible:bg-indigo-600",
  orange: "border-orange-300 text-orange-700 hover:border-orange-600 hover:bg-orange-600 focus-visible:border-orange-600 focus-visible:bg-orange-600",
  rose: "border-rose-300 text-rose-700 hover:border-rose-600 hover:bg-rose-600 focus-visible:border-rose-600 focus-visible:bg-rose-600",
  sky: "border-sky-300 text-sky-700 hover:border-sky-600 hover:bg-sky-600 focus-visible:border-sky-600 focus-visible:bg-sky-600",
  teal: "border-teal-300 text-teal-700 hover:border-teal-600 hover:bg-teal-600 focus-visible:border-teal-600 focus-visible:bg-teal-600",
  violet: "border-violet-300 text-violet-700 hover:border-violet-600 hover:bg-violet-600 focus-visible:border-violet-600 focus-visible:bg-violet-600",
};

const expandableActionTooltipTones: Record<ExpandableActionTone, string> = {
  amber: "bg-amber-600",
  emerald: "bg-emerald-600",
  fuchsia: "bg-fuchsia-600",
  indigo: "bg-indigo-600",
  orange: "bg-orange-600",
  rose: "bg-rose-600",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  violet: "bg-violet-600",
};

export function ExpandableAction({
  className = "",
  icon: Icon,
  label,
  tone,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: ExpandableActionTone;
}) {
  return (
    <button
      aria-label={label}
      className={`group relative inline-grid size-10 shrink-0 place-items-center overflow-visible rounded-xl border bg-white font-bold shadow-none transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-950/10 ${expandableActionTones[tone]} ${className}`}
      type={type}
      {...props}
    >
      <Icon className="size-4 shrink-0" />
      <span aria-hidden="true" className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition duration-150 after:absolute after:left-1/2 after:top-full after:size-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-45 after:bg-inherit group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${expandableActionTooltipTones[tone]}`}>
        {label}
      </span>
    </button>
  );
}

export function AppPage({
  children,
  className = "",
  maxWidth = "max-w-6xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <main className={`esse-workspace-page min-h-[calc(100vh-4rem)] px-4 py-5 text-stone-900 sm:px-5 md:px-6 md:py-6 ${className}`}>
      <div className={`mx-auto ${maxWidth}`}>{children}</div>
    </main>
  );
}

export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.emphasized }}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  meta,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  meta?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="esse-page-header mb-6 border-b border-[#e6dce2] pb-5 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#8f3a68]">{eyebrow}</p>}
          <h1 className={`${eyebrow ? "mt-1.5" : ""} text-3xl font-bold tracking-[-.025em] text-[#2d1d27] md:text-[2.15rem]`}>{title}</h1>
          {subtitle && <div className="mt-1.5 max-w-3xl text-sm leading-6 text-stone-600">{subtitle}</div>}
          {meta && <div className="mt-3 flex flex-wrap gap-2">{meta}</div>}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function PageHeaderMetrics({
  actions,
  eyebrow,
  metrics,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  metrics: Array<{ detail?: ReactNode; label: string; value: ReactNode }>;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="relative mb-6 grid items-end gap-6 border-b border-[#e5d9df] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(520px,.85fr)]">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#8f3a68]">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-1.5" : ""} text-3xl font-bold tracking-[-.025em] text-[#2d1d27] md:text-[2.15rem]`}>{title}</h1>
        {subtitle && <div className="mt-1.5 max-w-3xl text-sm leading-6 text-stone-600">{subtitle}</div>}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="grid grid-cols-2 border-y border-[#e5d9df] py-4 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none lg:border-y-0 lg:py-0">
        {metrics.map((metric, index) => (
          <div className={`px-2 py-3 sm:px-5 sm:py-1 ${index > 0 ? "border-l border-[#e5d9df]" : ""} ${index > 1 ? "border-t border-[#e5d9df] sm:border-t-0" : ""}`} key={metric.label}>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8f3a68]">{metric.label}</p>
            <strong className="mt-1 block text-3xl font-black leading-none text-[#2d1d27]">{metric.value}</strong>
            {metric.detail && <p className="mt-2 text-xs font-medium text-stone-500">{metric.detail}</p>}
          </div>
        ))}
      </div>
      <span aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 w-[72px] bg-[linear-gradient(90deg,#792f59,#d99aba_55%,transparent)]" />
    </header>
  );
}

const statusStyles: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-stone-200 bg-stone-100 text-stone-600",
  booked: "border-blue-200 bg-blue-50 text-blue-800",
  cancelled: "border-red-200 bg-red-50 text-red-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  confirmed: "border-blue-200 bg-blue-50 text-blue-800",
  draft: "border-stone-200 bg-stone-100 text-stone-700",
  failed: "border-red-200 bg-red-50 text-red-800",
  inactive: "border-stone-200 bg-stone-100 text-stone-600",
  no_show: "border-amber-200 bg-amber-50 text-amber-900",
  notified: "border-violet-200 bg-violet-50 text-violet-800",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  scheduled: "border-blue-200 bg-blue-50 text-blue-800",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-800",
  waiting: "border-amber-200 bg-amber-50 text-amber-900",
};

const statusLabels: Record<string, string> = {
  active: "Attivo",
  archived: "Archiviato",
  booked: "Prenotato",
  cancelled: "Annullato",
  completed: "Completo",
  confirmed: "Confermato",
  draft: "Bozza",
  failed: "Fallito",
  inactive: "Disattivato",
  no_show: "No-show",
  notified: "Notificato",
  pending: "In attesa",
  scheduled: "Programmato",
  sent: "Inviato",
  waiting: "In lista",
};

export function StatusBadge({
  children,
  status,
}: {
  children?: ReactNode;
  status: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.75)] ${statusStyles[status] ?? "border-stone-200 bg-stone-100 text-stone-700"}`}>
      {children ?? statusLabels[status] ?? status}
    </span>
  );
}

export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`grid gap-3 md:grid-cols-4 ${className}`}>{children}</dl>;
}

export function StatCard({
  label,
  value,
  detail,
}: {
  detail?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="esse-panel relative overflow-hidden rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#b85888]" />
      <dt className="pl-1 text-[11px] font-bold uppercase tracking-[.13em] text-stone-500">{label}</dt>
      <dd className="mt-1.5 pl-1 text-2xl font-black tracking-[-.02em] text-[#2d1d27]">{value}</dd>
      {detail && <p className="mt-1 text-xs font-medium text-stone-500">{detail}</p>}
    </div>
  );
}

export function SectionCard({
  actions,
  children,
  className = "",
  id,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={title ? titleId : undefined} id={id} className={`esse-panel relative overflow-hidden rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5 ${className}`}>
      {(title || actions || subtitle) && (
        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-xl font-bold text-stone-950" id={titleId}>{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-6 text-stone-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

export function ActionBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`esse-toolbar flex flex-wrap items-center gap-2 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-2 ${className}`}>
      {children}
    </div>
  );
}

export function AppIconTile({
  accent,
  active = false,
  description,
  href,
  icon,
  label,
  onClick,
}: {
  accent: string;
  active?: boolean;
  description?: string;
  href: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#d99aba] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"}`}
      href={href}
      onClick={onClick}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ backgroundColor: accent }}>{icon}</span>
      <span className="min-w-0">
        <strong className="block truncate text-sm text-stone-950">{label}</strong>
        {description && <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-stone-500">{description}</span>}
      </span>
    </a>
  );
}

export function AppLauncherPanel({
  children,
  className = "",
  title = "Tutte le app",
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-[#f8f7f5] p-4 shadow-[0_24px_70px_rgb(45_29_39_/_0.18)] md:p-6 ${className}`}>
      <h2 className="text-xl font-bold tracking-[-.02em] text-[#2d1d27]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ContextTabs({
  className = "",
  currentPath,
  items,
}: {
  className?: string;
  currentPath: string;
  items: Array<{ href: string; label: string }> | readonly { href: string; label: string }[];
}) {
  if (items.length === 0) return null;
  const activeHref = items
    .filter((item) => currentPath === item.href || (item.href !== "/" && currentPath.startsWith(`${item.href}/`)))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
  return (
    <nav aria-label="Viste dell'app" className={`flex min-h-11 items-end gap-1 overflow-x-auto border-b border-stone-200 ${className}`}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return <a aria-current={active ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${active ? "border-[#792f59] text-[#792f59]" : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-900"}`} href={item.href} key={item.href}>{item.label}</a>;
      })}
    </nav>
  );
}

export function WorkspaceToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-12 flex-wrap items-center gap-2 border-y border-stone-200 bg-white px-3 py-2 ${className}`}>{children}</div>;
}

export function KpiStrip({
  items,
}: {
  items: Array<{ detail?: ReactNode; label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid overflow-hidden rounded-xl border border-stone-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => <div className={`${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} border-stone-200 px-4 py-3`} key={item.label}><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-500">{item.label}</dt><dd className="mt-1 text-2xl font-bold tracking-[-.03em] text-stone-950">{item.value}</dd>{item.detail && <p className="mt-1 text-xs text-stone-500">{item.detail}</p>}</div>)}
    </dl>
  );
}

export function InboxItem({
  action,
  description,
  label,
  priority = "normal",
}: {
  action?: ReactNode;
  description?: ReactNode;
  label: ReactNode;
  priority?: "normal" | "high";
}) {
  return (
    <article className="flex min-h-14 items-center gap-3 border-b border-stone-100 px-1 py-3 last:border-b-0">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${priority === "high" ? "bg-amber-500" : "bg-stone-300"}`} />
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-stone-900">{label}</h3>{description && <div className="mt-0.5 text-xs text-stone-500">{description}</div>}</div>
      {action}
    </article>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "muted" | "override" | "success" | "warning" | "danger";
}

export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    danger: "bg-red-50 text-red-700",
    default: "bg-neutral-900 text-white",
    muted: "bg-neutral-100 text-neutral-600",
    override: "bg-violet-100 text-violet-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={`inline-flex rounded-full border border-white/70 px-2.5 py-1 text-xs font-bold shadow-[inset_0_1px_0_rgb(255_255_255_/_0.75)] ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked,
  className = "",
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${
        checked ? "border-[#792f59] bg-[#792f59]" : "border-stone-300 bg-stone-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition duration-150 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function PageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-busy="true" aria-label="Caricamento contenuti" className={`space-y-5 ${className}`} role="status">
      <div aria-hidden="true" className="h-10 w-72 animate-pulse rounded-xl bg-stone-100" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div aria-hidden="true" key={item} className="h-32 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
      <div aria-hidden="true" className="h-80 animate-pulse rounded-xl bg-white" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  className = "",
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={`space-y-3 p-4 ${className}`} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-stone-100" />
      ))}
    </div>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-[#d7a6c1] bg-[#fffafd]/85 p-10 text-center shadow-none">
      <h2 className="text-xl font-bold text-stone-950">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function InlineError({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-none ${className}`} role="alert">
      {children}
    </p>
  );
}

export function FormField({
  children,
  className = "",
  description,
  error,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={`group block text-sm font-bold text-stone-800 ${className}`}>
      <span className="mb-1.5 flex items-center gap-1">
        {label}
        {required && <span aria-hidden="true" className="text-red-700">*</span>}
      </span>
      {children}
      {description && <span className="mt-1.5 block text-xs font-medium leading-5 text-stone-500">{description}</span>}
      {error && <span className="mt-1.5 block text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}

export function SaveToast({
  children,
  variant = "success",
  visible,
}: {
  children: ReactNode;
  variant?: "error" | "info" | "success" | "warning";
  visible: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const variants = {
    error: "border-red-300 bg-red-50 text-red-800 shadow-[0_16px_42px_rgb(185_28_28_/_0.16)]",
    info: "border-sky-300 bg-sky-50 text-sky-800 shadow-[0_16px_42px_rgb(2_132_199_/_0.16)]",
    success: "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_16px_42px_rgb(5_150_105_/_0.16)]",
    warning: "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_16px_42px_rgb(217_119_6_/_0.16)]",
  };

  useEffect(() => {
    if (!visible) {
      setDismissed(false);
      return;
    }
    setDismissed(false);
    const timeout = window.setTimeout(() => setDismissed(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [visible, children]);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-live={variant === "error" ? "assertive" : "polite"}
          className={`fixed bottom-5 right-5 z-50 flex max-w-[min(420px,calc(100vw-2rem))] items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${variants[variant]}`}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          role={variant === "error" ? "alert" : "status"}
          transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.standard }}
        >
          <span className="min-w-0 flex-1">{children}</span>
          <button
            aria-label="Chiudi notifica"
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-current/20 transition hover:bg-black/5"
            onClick={() => setDismissed(true)}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Dialog({
  children,
  contained = false,
  footer,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  contained?: boolean;
  footer?: ReactNode;
  onClose(): void;
  open: boolean;
  title: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])')?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, [onClose, open]);
  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className={`${contained ? "absolute" : "fixed"} inset-0 z-50 grid place-items-center bg-[#2d1d27]/45 p-4 backdrop-blur-sm`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
          transition={{ duration: designTokens.motion.duration.fast }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-labelledby={titleId}
            aria-modal="true"
            className="my-auto max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-[0_24px_70px_rgb(45_29_39_/_0.18)]"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.emphasized }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold text-stone-950" id={titleId}>{title}</h2>
              <button aria-label="Chiudi" className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-950" onClick={onClose} type="button">
                <X aria-hidden="true" height="20" width="20" />
              </button>
            </div>
            <div className="mt-5">{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return !contained && typeof document !== "undefined" ? createPortal(dialog, document.body) : dialog;
}

export function Drawer({
  children,
  footer,
  onClose,
  open,
  size = "md",
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  open: boolean;
  size?: "md" | "xl";
  title: string;
}) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, [onClose, open]);
  const widths = { md: "max-w-md", xl: "max-w-3xl" };
  const drawer = (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-[#2d1d27]/45 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.aside
            animate={{ x: 0 }}
            aria-labelledby={titleId}
            aria-modal="true"
            className={`absolute inset-y-0 right-0 flex h-full w-full ${widths[size]} flex-col overflow-hidden border-l border-stone-200 bg-white shadow-[0_24px_70px_rgb(45_29_39_/_0.18)]`}
            exit={{ x: "100%" }}
            initial={{ x: "100%" }}
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
            ref={drawerRef}
            role="dialog"
            transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.emphasized }}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6">
              <h2 className="text-xl font-bold text-stone-950" id={titleId}>{title}</h2>
              <button aria-label="Chiudi" className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-950" onClick={onClose} type="button">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">{children}</div>
            {footer && <div className="shrink-0 border-t border-stone-200 bg-white/95 px-6 py-4 backdrop-blur">{footer}</div>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return typeof document !== "undefined" ? createPortal(drawer, document.body) : drawer;
}

export function ConfirmDialog({
  cancelLabel = "Annulla",
  confirmLabel = "Conferma",
  destructive = false,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  destructive?: boolean;
  onCancel(): void;
  onConfirm(): void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog
      footer={
        <>
          <Button onClick={onCancel} variant="outline">{cancelLabel}</Button>
          <Button onClick={onConfirm} variant={destructive ? "destructive" : "primary"}>{confirmLabel}</Button>
        </>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      <p className="text-sm leading-6 text-stone-600">{description}</p>
    </Dialog>
  );
}

export interface DataTableColumn<T> {
  align?: "left" | "right";
  header: string;
  key: string;
  render(row: T): ReactNode;
}

export function DataTable<T>({
  columns,
  empty,
  error,
  getRowId,
  items,
  loading = false,
}: {
  columns: Array<DataTableColumn<T>>;
  empty?: ReactNode;
  error?: ReactNode;
  getRowId(row: T): string;
  items: T[];
  loading?: boolean;
}) {
  if (loading) return <TableSkeleton />;
  if (error) return <InlineError>{error}</InlineError>;
  if (items.length === 0) {
    return typeof empty === "string" ? <EmptyState title={empty} /> : empty ?? <EmptyState title="Nessun risultato" />;
  }

  return (
    <div className="esse-panel overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#faf3f7] text-xs uppercase tracking-wider text-[#792f59]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`p-4 ${column.align === "right" ? "text-right" : "text-left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getRowId(item)} className="h-[46px] border-t border-stone-100 transition hover:bg-[#fffafd]">
              {columns.map((column) => (
                <td key={column.key} className={`p-4 ${column.align === "right" ? "text-right" : "text-left"}`}>
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ScheduleDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ScheduleValue = Record<ScheduleDay, Array<{ from: string; to: string }>>;

const emptySchedule: ScheduleValue = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

const scheduleDays: Array<{ key: ScheduleDay; label: string }> = [
  { key: "mon", label: "Lunedì" },
  { key: "tue", label: "Martedì" },
  { key: "wed", label: "Mercoledì" },
  { key: "thu", label: "Giovedì" },
  { key: "fri", label: "Venerdì" },
  { key: "sat", label: "Sabato" },
  { key: "sun", label: "Domenica" },
];

export function ScheduleEditor({
  onChange,
  value,
}: {
  onChange(value: ScheduleValue): void;
  value?: ScheduleValue | null;
}) {
  const schedule = value ?? emptySchedule;
  const [expandedDays, setExpandedDays] = useState<Partial<Record<ScheduleDay, boolean>>>({});

  function setDay(day: ScheduleDay, open: boolean) {
    onChange({ ...schedule, [day]: open ? [{ from: "09:00", to: "18:00" }] : [] });
    setExpandedDays((current) => ({ ...current, [day]: open }));
  }

  function setInterval(
    day: ScheduleDay,
    index: number,
    field: "from" | "to",
    next: string,
  ) {
    const intervals = [...(schedule[day] ?? [])];
    const current = intervals[index] ?? { from: "09:00", to: "18:00" };
    intervals[index] = { ...current, [field]: next };
    onChange({ ...schedule, [day]: intervals });
  }

  function addInterval(day: ScheduleDay) {
    const intervals = schedule[day] ?? [];
    const previous = intervals.at(-1);
    onChange({
      ...schedule,
      [day]: [
        ...intervals,
        {
          from: previous?.to && previous.to < "18:00" ? previous.to : "14:00",
          to: "18:00",
        },
      ],
    });
  }

  function removeInterval(day: ScheduleDay, index: number) {
    onChange({
      ...schedule,
      [day]: (schedule[day] ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  }

  return (
    <div className="space-y-2">
      {scheduleDays.map((day) => {
        const intervals = schedule[day.key] ?? [];
        const open = intervals.length > 0;
        const expanded = open && Boolean(expandedDays[day.key]);
        const panelId = `schedule-${day.key}-panel`;
        const summary = open
          ? intervals.map((interval) => `${interval.from}–${interval.to}`).join(", ")
          : "Chiuso";
        return (
          <div
            className={`overflow-hidden rounded-xl border transition-colors ${open ? "border-stone-200 bg-white" : "border-stone-300 bg-stone-200"}`}
            key={day.key}
          >
            <div className="flex min-h-14 items-center gap-2 px-2">
              <button
                aria-controls={panelId}
                aria-expanded={expanded}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-default"
                disabled={!open}
                onClick={() => setExpandedDays((current) => ({ ...current, [day.key]: !expanded }))}
                type="button"
              >
                <span className={`w-24 shrink-0 text-sm font-semibold ${open ? "text-stone-900" : "text-stone-500"}`}>{day.label}</span>
                <span className={`min-w-0 flex-1 truncate text-xs font-medium ${open ? "text-stone-600" : "text-stone-500"}`}>{summary}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180 text-[#792f59]" : open ? "text-stone-500" : "text-stone-400 opacity-50"}`}
                />
              </button>
              <Switch
                aria-label={`${open ? "Disattiva" : "Attiva"} ${day.label}`}
                checked={open}
                onCheckedChange={(nextOpen) => setDay(day.key, nextOpen)}
              />
            </div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.standard }}
                >
                  <div className="space-y-2 border-t border-stone-200 bg-[#fffafd] p-3">
                    {intervals.map((interval, index) => (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center" key={`${day.key}-${index}`}>
                        <input
                          aria-label={`${day.label} fascia ${index + 1} apertura`}
                          className="min-h-10 rounded-lg border border-stone-200 px-2"
                          onChange={(event) => setInterval(day.key, index, "from", event.target.value)}
                          type="time"
                          value={interval.from}
                        />
                        <span className="text-center text-xs font-bold text-stone-400">—</span>
                        <input
                          aria-label={`${day.label} fascia ${index + 1} chiusura`}
                          className="min-h-10 rounded-lg border border-stone-200 px-2"
                          onChange={(event) => setInterval(day.key, index, "to", event.target.value)}
                          type="time"
                          value={interval.to}
                        />
                        <Button
                          aria-label={`Rimuovi fascia ${index + 1} di ${day.label}`}
                          className="size-10 p-0 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => removeInterval(day.key, index)}
                          size="sm"
                          title="Rimuovi fascia"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={() => addInterval(day.key)} size="sm" variant="outline">
                      Aggiungi fascia
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Breadcrumbs({
  className,
  items,
}: {
  className?: string;
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className={`${className ?? "mb-5"} inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/70 bg-white/75 px-2 py-1 text-xs font-bold text-stone-500 shadow-sm ring-1 ring-stone-950/5 backdrop-blur`}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="text-stone-300">›</span>}
          {item.href ? (
            <a className="rounded-full px-2 py-1 text-[#792f59] transition hover:bg-[#f3e2eb]" href={item.href}>
              {item.label}
            </a>
          ) : (
            <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

