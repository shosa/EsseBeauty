"use client";

import { motion, useReducedMotion } from "motion/react";

interface NoticeModalProps {
  message: string;
  onClose: () => void;
  primary: string;
  title?: string;
}

export function NoticeModal({ message, onClose, primary, title }: NoticeModalProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 grid place-items-end bg-[#2d1d27]/55 p-3 backdrop-blur-sm sm:place-items-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm rounded-t-[2.2rem] bg-white p-6 text-center shadow-[0_-24px_70px_rgb(45_29_39_/_0.25)] sm:rounded-[2.2rem] sm:shadow-[0_24px_70px_rgb(45_29_39_/_0.25)]"
        exit={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        initial={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      >
        {title && <h2 className="text-lg font-bold text-stone-950">{title}</h2>}
        <p className={`text-sm leading-6 text-stone-600 ${title ? "mt-2" : ""}`}>{message}</p>
        <motion.button className="mt-5 min-h-12 w-full rounded-2xl font-black text-white" onClick={onClose} style={{ background: primary }} type="button" whileTap={{ scale: 0.97 }}>
          OK
        </motion.button>
      </motion.section>
    </motion.div>
  );
}
