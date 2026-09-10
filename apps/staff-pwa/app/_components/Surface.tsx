import type { ReactNode } from "react";

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-stone-200 bg-white p-5 ${className}`}>{children}</section>;
}
