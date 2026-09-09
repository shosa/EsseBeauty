"use client";

import { Sparkles } from "lucide-react";

import { NotificationDetailView } from "../../../_components/NotificationDetailView";

export default function CampaignNotificationPage() {
  return <NotificationDetailView authSubtitle="Accedi per vedere questa offerta." ctaLabel="Prenota ora" icon={Sparkles} />;
}
