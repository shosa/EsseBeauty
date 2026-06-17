export const quickCreateActions = [
  { href: "/calendar/appointments/new", key: "appointment", label: "Nuovo appuntamento" },
  { href: "/clients/new", key: "customer", label: "Nuovo cliente" },
  { href: "/settings/services/new", key: "service", label: "Nuovo servizio" },
] as const;

export const searchGroups = [
  { key: "customers", label: "Clienti" },
  { key: "appointments", label: "Appuntamenti" },
  { key: "services", label: "Servizi" },
  { key: "staff", label: "Staff" },
  { key: "campaigns", label: "Campagne" },
  { key: "products", label: "Prodotti" },
] as const;

export type SearchGroupKey = (typeof searchGroups)[number]["key"];

export const notificationTypeLabels = {
  booking_created: "Nuova prenotazione",
  campaign_failed: "Campagna fallita",
  inventory_low_stock: "Scorta bassa",
  reminder_failed: "Promemoria fallito",
  review_pending: "Recensione da gestire",
  waitlist_match: "Slot per lista d'attesa",
} as const;
