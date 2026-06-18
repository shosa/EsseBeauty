import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";

export const designTokens = {
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
  outline: "border border-[#d7a6c1]/70 bg-white/80 text-[#402334] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.72)] hover:border-[#792f59] hover:bg-[#fffafd] hover:text-[#792f59]",
  primary: "border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] hover:shadow-[0_22px_48px_rgb(121_47_89_/_0.34)]",
  secondary: "border border-[#ead1df] bg-[linear-gradient(135deg,#fffafd_0%,#f3e2eb_100%)] text-[#792f59] hover:border-[#d99aba] hover:bg-[#f3e2eb]",
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
      className={`inline-flex cursor-pointer items-center justify-center gap-2 font-semibold tracking-[-.01em] shadow-[0_12px_28px_rgb(45_29_39_/_0.10)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgb(45_29_39_/_0.16)] active:translate-y-0 active:scale-[.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0 ${active ? "ring-2 ring-[#792f59]/25" : ""} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
      type={type}
      {...props}
    />
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
    <main className={`esse-workspace-page min-h-[calc(100vh-4rem)] px-4 py-6 text-stone-900 sm:px-6 md:px-8 md:py-8 ${className}`}>
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
  status,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  meta?: ReactNode;
  status?: ReactNode;
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
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {status}
          {actions}
        </div>
      </div>
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
  completed: "Completato",
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
    <div className="esse-panel relative overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white p-4 shadow-[0_8px_24px_rgb(45_29_39_/_0.055)]">
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
  return (
    <section id={id} className={`esse-panel relative overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] md:p-6 ${className}`}>
      {(title || actions || subtitle) && (
        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-xl font-bold text-stone-950">{title}</h2>}
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
        checked ? "border-[#792f59] bg-[linear-gradient(135deg,#402334,#b85888)] shadow-[0_10px_24px_rgb(121_47_89_/_0.22)]" : "border-stone-200 bg-stone-200 shadow-inner"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgb(45_29_39_/_0.28)] transition duration-200 ${
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
    <section className="rounded-[2rem] border border-dashed border-[#d7a6c1] bg-[#fffafd]/85 p-10 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.85)]">
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
    <p className={`rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-sm ${className}`} role="alert">
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
  const variants = {
    error: "border-red-200 bg-red-600 text-white shadow-[0_20px_54px_rgb(185_28_28_/_0.25)]",
    info: "border-blue-200 bg-blue-600 text-white shadow-[0_20px_54px_rgb(37_99_235_/_0.25)]",
    success: "border-emerald-200 bg-emerald-600 text-white shadow-[0_20px_54px_rgb(5_150_105_/_0.25)]",
    warning: "border-amber-200 bg-amber-500 text-amber-950 shadow-[0_20px_54px_rgb(217_119_6_/_0.22)]",
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={`fixed right-5 top-5 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold ${variants[variant]}`}
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
          className="fixed inset-0 z-50 grid place-items-center bg-[#2d1d27]/45 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
          transition={{ duration: designTokens.motion.duration.fast }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-modal="true"
            className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_30px_90px_rgb(45_29_39_/_0.28)] ring-1 ring-[#792f59]/10 backdrop-blur"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
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
          className="fixed inset-0 z-50 bg-[#2d1d27]/45 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.aside
            animate={{ x: 0 }}
            aria-modal="true"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-white/70 bg-white/95 p-6 shadow-[0_30px_90px_rgb(45_29_39_/_0.28)] backdrop-blur"
            exit={{ x: "100%" }}
            initial={{ x: "100%" }}
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
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
    <div className="esse-panel overflow-x-auto rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
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
            <tr key={getRowId(item)} className="border-t border-stone-100 transition hover:bg-[#fffafd]">
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
  { key: "mon", label: "LUN" },
  { key: "tue", label: "MAR" },
  { key: "wed", label: "MER" },
  { key: "thu", label: "GIO" },
  { key: "fri", label: "VEN" },
  { key: "sat", label: "SAB" },
  { key: "sun", label: "DOM" },
];

export function ScheduleEditor({
  onChange,
  value,
}: {
  onChange(value: ScheduleValue): void;
  value?: ScheduleValue | null;
}) {
  const schedule = value ?? emptySchedule;

  function setDay(day: ScheduleDay, open: boolean) {
    onChange({ ...schedule, [day]: open ? [{ from: "09:00", to: "18:00" }] : [] });
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
        return (
          <div key={day.key} className="rounded-2xl border border-stone-100 bg-[#fffafd] p-3">
            <div className="flex min-h-10 items-center gap-3">
              <b className="w-16 shrink-0 text-sm">{day.label}</b>
              <Switch checked={open} onCheckedChange={(nextOpen) => setDay(day.key, nextOpen)} />
              <span className="text-xs font-semibold text-stone-500">
                {open ? `${intervals.length} ${intervals.length === 1 ? "fascia" : "fasce"}` : "Chiuso"}
              </span>
            </div>
            {open && (
              <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
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
                      onClick={() => removeInterval(day.key, index)}
                      size="sm"
                      variant="ghost"
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
                <Button onClick={() => addInterval(day.key)} size="sm" variant="outline">
                  Aggiungi fascia
                </Button>
              </div>
            )}
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
    <nav aria-label="Breadcrumb" className="mb-5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/70 bg-white/75 px-2 py-1 text-xs font-bold text-stone-500 shadow-sm ring-1 ring-stone-950/5 backdrop-blur">
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

