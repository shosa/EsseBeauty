export interface StaffStatusAction {
  confirmationRequired: boolean;
  label: "Disattiva" | "Riattiva";
  nextActive: boolean;
}

export function staffStatusAction(active: boolean): StaffStatusAction {
  return active
    ? { confirmationRequired: true, label: "Disattiva", nextActive: false }
    : { confirmationRequired: false, label: "Riattiva", nextActive: true };
}
