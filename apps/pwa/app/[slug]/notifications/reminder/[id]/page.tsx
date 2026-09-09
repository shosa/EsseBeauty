"use client";

import { CalendarClock } from "lucide-react";

import { NotificationDetailView } from "../../../_components/NotificationDetailView";

export default function ReminderNotificationPage() {
  return <NotificationDetailView authSubtitle="Accedi per vedere il promemoria del tuo appuntamento." ctaLabel="Vedi i miei appuntamenti" icon={CalendarClock} />;
}
