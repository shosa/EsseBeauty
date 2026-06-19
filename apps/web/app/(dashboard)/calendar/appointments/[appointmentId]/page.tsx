import { redirect } from "next/navigation";

export default async function AppointmentRedirectPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  redirect(`/calendar?appointment=${encodeURIComponent(appointmentId)}`);
}
