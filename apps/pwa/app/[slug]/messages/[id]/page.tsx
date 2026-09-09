"use client";

import { Bell } from "lucide-react";

import { NotificationDetailView } from "../../_components/NotificationDetailView";

export default function MessagePage() {
  return <NotificationDetailView authSubtitle="Accedi per leggere questo messaggio." ctaLabel="OK" icon={Bell} />;
}
