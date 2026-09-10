"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { staffRequest } from "../../lib/staff-auth";
import { LoginScreen } from "./LoginScreen";
import { PageTransition } from "./PageTransition";
import { StaffBottomNav } from "./StaffBottomNav";
import { StaffTopNav } from "./StaffTopNav";
import { useStaffAuth } from "./StaffAuthProvider";

export function StaffShell({ children }: { children: ReactNode }) {
  const { logout, session, status } = useStaffAuth();
  const pathname = usePathname();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    void staffRequest<Array<{ status: string }>>("/api/staff-app/availability-requests")
      .then((rows) => setPendingRequestCount(rows.filter((item) => item.status === "pending").length))
      .catch(() => undefined);
  }, [status, pathname]);

  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-[#faf8f4]"><div className="size-10 animate-spin rounded-full border-4 border-[#ead1df] border-t-[#792f59]" /></main>;
  }

  if (status === "anonymous" || !session) return <LoginScreen />;

  return (
    <>
      <StaffTopNav onLogout={() => void logout()} pendingRequestCount={pendingRequestCount} session={session} />
      <div className="min-h-screen bg-[#faf8f4] pb-24 lg:pb-0 lg:pt-16">
        <PageTransition>{children}</PageTransition>
      </div>
      <StaffBottomNav pendingRequestCount={pendingRequestCount} />
    </>
  );
}
