"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

function platformUrl() {
  const configured = new URL(process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:3004");
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(configured.hostname) && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    configured.hostname = window.location.hostname;
  }
  return configured.toString();
}

export default function PlatformRedirectPage() {
  const [destination, setDestination] = useState(process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:3004");

  useEffect(() => {
    const resolved = platformUrl();
    setDestination(resolved);
    window.location.replace(resolved);
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#f3f5f4] p-6"><div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ExternalLink className="size-5" /></span><h1 className="mt-5 text-2xl font-bold">Apertura Platform</h1><p className="mt-2 text-sm leading-6 text-stone-500">La console amministrativa ora è un’applicazione separata.</p><a className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white" href={destination}>Apri Platform</a></div></main>;
}
