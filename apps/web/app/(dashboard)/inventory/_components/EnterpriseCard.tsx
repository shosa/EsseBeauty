import type { ReactNode } from "react";

export function Card({ actions, bodyClassName = "", children, className = "", subtitle, title }: { actions?: ReactNode; bodyClassName?: string; children: ReactNode; className?: string; subtitle?: ReactNode; title?: ReactNode }) {
  return (
    <div className={`esse-panel overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8dfe4] px-4 py-3.5">
          <div>{title && <h2 className="text-[14.5px] font-bold text-stone-900">{title}</h2>}{subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}</div>
          {actions}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
