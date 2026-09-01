"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppPage } from "@esse-beauty/ui";

export default function NewClientRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clients?new=1");
  }, [router]);

  return <AppPage maxWidth="max-w-[1600px]"><div className="h-40 animate-pulse rounded-2xl bg-stone-100" /></AppPage>;
}
