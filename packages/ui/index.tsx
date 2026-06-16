import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";

export const designTokens = {
  color: {
    brand: {
      50: "#faf3f7",
      100: "#f3e2eb",
      600: "#8f3a68",
      700: "#792f59",
      900: "#402334",
      950: "#2d1d27",
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
    focus: "0 0 0 3px rgb(123 49 89 / 0.22)",
    lg: "0 18px 48px rgb(45 29 39 / 0.14)",
    md: "0 8px 24px rgb(45 29 39 / 0.08)",
    none: "none",
    sm: "0 1px 2px rgb(45 29 39 / 0.06)",
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
  default: "bg-neutral-950 text-white hover:bg-neutral-800",
  destructive: "bg-red-700 text-white hover:bg-red-800",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
  icon: "bg-transparent text-stone-600 hover:bg-stone-100",
  outline: "border border-stone-300 bg-white text-stone-800 hover:border-[#792f59] hover:text-[#792f59]",
  primary: "bg-[#402334] text-white hover:bg-[#5a3048]",
  secondary: "bg-[#f3e2eb] text-[#792f59] hover:bg-[#ead1df]",
  tableAction: "border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:border-[#792f59] hover:text-[#792f59]",
};

const buttonSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  lg: "min-h-12 rounded-xl px-5 py-3",
  md: "min-h-11 rounded-xl px-4 py-2.5",
  sm: "min-h-9 rounded-lg px-3 py-2 text-sm",
};

export function Button({
  className = "",
  size = "md",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7b3159]/20 disabled:cursor-not-allowed disabled:opacity-45 ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
      type={type}
      {...props}
    />
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
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`}
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7b3159]/20 ${
        checked ? "bg-neutral-950" : "bg-neutral-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function PageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-5 ${className}`} aria-busy="true">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-stone-100" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-white" />
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
    <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
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
    <p className={`rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ${className}`} role="alert">
      {children}
    </p>
  );
}

export function SaveToast({
  children,
  visible,
}: {
  children: ReactNode;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="fixed right-5 top-5 z-50 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-lg"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: -8 }}
          role="status"
          transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.standard }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Dialog({
  children,
  footer,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  open: boolean;
  title: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
          transition={{ duration: designTokens.motion.duration.fast }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.emphasized }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold text-stone-950">{title}</h2>
              <button className="rounded-lg px-2 py-1 text-sm font-semibold text-stone-500 hover:bg-stone-100" onClick={onClose} type="button">
                Chiudi
              </button>
            </div>
            <div className="mt-5">{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose(): void;
  open: boolean;
  title: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/35"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.aside
            animate={{ x: 0 }}
            aria-modal="true"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
            exit={{ x: "100%" }}
            initial={{ x: "100%" }}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: designTokens.motion.duration.normal, ease: designTokens.motion.ease.emphasized }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold text-stone-950">{title}</h2>
              <button className="rounded-lg px-2 py-1 text-sm font-semibold text-stone-500 hover:bg-stone-100" onClick={onClose} type="button">
                Chiudi
              </button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
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
            <tr key={getRowId(item)} className="border-t border-stone-100 hover:bg-stone-50">
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
  value: ScheduleValue;
}) {
  function setDay(day: ScheduleDay, open: boolean) {
    onChange({ ...value, [day]: open ? [{ from: "09:00", to: "18:00" }] : [] });
  }

  function setInterval(day: ScheduleDay, field: "from" | "to", next: string) {
    const current = value[day][0] ?? { from: "09:00", to: "18:00" };
    onChange({ ...value, [day]: [{ ...current, [field]: next }] });
  }

  return (
    <div className="space-y-2">
      {scheduleDays.map((day) => {
        const interval = value[day.key][0];
        return (
          <div key={day.key} className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-[120px_auto_1fr_1fr] sm:items-center">
            <b className="text-sm">{day.label}</b>
            <Switch checked={Boolean(interval)} onCheckedChange={(open) => setDay(day.key, open)} />
            <input
              className="min-h-10 rounded-lg border border-stone-200 px-2 disabled:opacity-40"
              disabled={!interval}
              onChange={(event) => setInterval(day.key, "from", event.target.value)}
              type="time"
              value={interval?.from ?? "09:00"}
            />
            <input
              className="min-h-10 rounded-lg border border-stone-200 px-2 disabled:opacity-40"
              disabled={!interval}
              onChange={(event) => setInterval(day.key, "to", event.target.value)}
              type="time"
              value={interval?.to ?? "18:00"}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-stone-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <a className="font-semibold text-[#792f59] hover:underline" href={item.href}>
              {item.label}
            </a>
          ) : (
            <span className="font-semibold text-stone-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
