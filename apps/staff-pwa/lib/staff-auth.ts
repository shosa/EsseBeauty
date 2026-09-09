import type { PermissionKey, WorkingHours } from "@esse-beauty/shared";

import { apiBaseUrl } from "../app/api";

export interface StaffSession {
  modules: { staff_performance: boolean };
  permissions: PermissionKey[];
  salon_id: string;
  staff: {
    color: string;
    display_name: string;
    id: string;
    job_title?: string | null;
    working_hours: WorkingHours;
  };
}

export class StaffRequestError extends Error {}

export async function staffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", "x-esse-client": "staff", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new StaffRequestError(typeof body.error === "string" ? body.error : "REQUEST_FAILED");
  }
  return (await response.json()) as T;
}

export async function fetchStaffSession(): Promise<StaffSession | undefined> {
  try {
    return await staffRequest<StaffSession>("/api/staff-app/me");
  } catch {
    return undefined;
  }
}

export async function staffLogin(email: string, password: string): Promise<boolean> {
  try {
    await staffRequest("/api/auth/login", { body: JSON.stringify({ email, password }), method: "POST" });
    return true;
  } catch {
    return false;
  }
}

export async function staffLogout(): Promise<void> {
  await staffRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}
