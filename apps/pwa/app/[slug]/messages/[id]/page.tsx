"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Bell } from "lucide-react";

import { apiBaseUrl } from "../../../../lib/api";
import { CustomerAuthOverlay } from "../../_components/CustomerAuthOverlay";
import { useCustomerAuth } from "../../_components/CustomerAuthProvider";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Message { body: string; href?: string | null; title: string; }

export default function MessagePage() {
  const { slug, id } = useParams<{ id: string; slug: string }>();
  const router = useRouter();
  const { status: authStatus } = useCustomerAuth();
  const reduceMotion = useReducedMotion();
  const [branding, setBranding] = useState<Branding>();
  const [message, setMessage] = useState<Message>();
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const primary = branding?.primaryColor || "#402334";
  const accent = branding?.accentColor || "#f4d8a8";

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setBranding((await response.json()).branding ?? undefined);
    });
  }, [slug]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    void fetch(`${apiBaseUrl()}/api/public/${slug}/messages/${id}`, { credentials: "include" }).then(async (response) => {
      if (!response.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setMessage(await response.json());
      setLoading(false);
    });
  }, [authStatus, id, slug]);

  function done() {
    router.push(message?.href || `/${slug}`);
  }

  return (
    <main className="grid min-h-screen place-items-center p-5" style={{ background: `radial-gradient(circle at top, ${accent}55, transparent 20rem), #f6f2f4` }}>
      {authStatus === "anonymous" && (
        <CustomerAuthOverlay accent={accent} primary={primary} subtitle="Accedi per leggere questo messaggio." />
      )}
      {authStatus === "authenticated" && (
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[2.2rem] bg-white p-7 text-center shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
        >
          <span className="mx-auto grid size-14 place-items-center rounded-3xl text-white" style={{ background: primary }}><Bell className="size-6" /></span>
          {loading ? (
            <p className="mt-5 text-sm text-stone-500">Caricamento...</p>
          ) : notFound || !message ? (
            <>
              <h1 className="mt-5 text-xl font-bold text-stone-950">Messaggio non disponibile</h1>
              <p className="mt-2 text-sm text-stone-500">Potrebbe essere stato rimosso o non è più raggiungibile con questo account.</p>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-xl font-bold text-stone-950">{message.title}</h1>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-600">{message.body}</p>
            </>
          )}
          <button className="mt-7 min-h-12 w-full rounded-2xl font-black text-white" onClick={done} style={{ background: primary }} type="button">OK</button>
        </motion.section>
      )}
    </main>
  );
}
