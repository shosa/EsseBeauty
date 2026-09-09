"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EmptyState } from "@esse-beauty/ui";

import { staffRequest } from "../lib/staff-auth";
import { dayRange, time } from "../lib/format";
import type { Appointment } from "../lib/types";
import { AppointmentRow } from "./_components/AppointmentRow";
import { Surface } from "./_components/Surface";
import { useStaffAuth } from "./_components/StaffAuthProvider";

export default function StaffHomePage() {
  const { session } = useStaffAuth();
  const router = useRouter();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    void staffRequest<Appointment[]>(`/api/staff-app/appointments?${dayRange(1)}`)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  const nextAppointment = items.find((item) => new Date(item.ends_at).getTime() > Date.now());
  const upcoming = items.filter((item) => item.id !== nextAppointment?.id);

  return (
    <main className="mx-auto max-w-md space-y-5 p-4 lg:max-w-3xl lg:p-8">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">{session.staff.job_title ?? "Staff"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-.025em] text-stone-950">Ciao, {session.staff.display_name.split(" ")[0]}</h1>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-[#792f59] p-6 text-white">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-white/65">La tua giornata</p>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div><span className="text-6xl font-black leading-none tracking-[-.04em]">{loading ? "–" : items.length}</span><p className="mt-2 text-sm font-semibold text-white/75">appuntamenti oggi</p></div>
          <div className="rounded-2xl bg-white/12 px-4 py-3 text-right"><b className="block text-xl">{items.filter((item) => item.status === "completed").length}</b><span className="text-xs text-white/70">completati</span></div>
        </div>
      </section>

      <div>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8f3a68]">In evidenza</p><h2 className="text-xl font-bold tracking-[-.015em] text-stone-950">Prossimo cliente</h2></div><Link className="text-xs font-black text-[#792f59]" href="/agenda">Vedi agenda</Link></div>
        {loading ? <div className="h-32 animate-pulse rounded-3xl bg-stone-100" /> : !nextAppointment ? (
          <Surface><EmptyState title="Nessun appuntamento imminente" description="La giornata è libera oppure hai già completato tutto." /></Surface>
        ) : (
          <Link className="block" href={`/agenda/${nextAppointment.id}`}>
            <Surface className="transition active:scale-[.98]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[#792f59]">{time(nextAppointment.starts_at)} - {time(nextAppointment.ends_at)}</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-[-.015em] text-stone-950">{nextAppointment.customer_name}</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-500">{nextAppointment.service_name}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-full bg-[#faf3f7] text-xl text-[#792f59]">›</span>
              </div>
            </Surface>
          </Link>
        )}
      </div>

      {!loading && upcoming.length > 0 && (
        <div>
          <h2 className="mb-3 text-xl font-bold tracking-[-.015em] text-stone-950">A seguire</h2>
          <div className="space-y-2">
            {upcoming.slice(0, 4).map((item) => (
              <AppointmentRow color={session.staff.color} item={item} key={item.id} onOpen={() => router.push(`/agenda/${item.id}`)} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
