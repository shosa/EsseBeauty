"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        key={pathname}
        transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 0.9, 0.28, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
