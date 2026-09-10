import { CalendarClock, CalendarDays, Send, UserRound } from "lucide-react";

export const staffNavItems = [
  { href: "/", icon: CalendarDays, label: "Oggi" },
  { href: "/agenda", icon: CalendarClock, label: "Agenda" },
  { href: "/requests", icon: Send, label: "Richieste" },
  { href: "/profile", icon: UserRound, label: "Profilo" },
] as const;
