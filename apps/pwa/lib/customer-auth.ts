import { apiBaseUrl } from "./api";

export interface CustomerProfile {
  email: string | null;
  first_name: string;
  full_name: string;
  id: string;
  last_name: string;
  phone: string | null;
}

export interface RegisterInput {
  email?: string;
  first_name: string;
  last_name: string;
  password: string;
  phone: string;
}

export interface LoginInput {
  password: string;
  phone: string;
}

async function parseCustomer(response: Response): Promise<CustomerProfile | undefined> {
  if (!response.ok) return undefined;
  return (await response.json()) as CustomerProfile;
}

export async function fetchCustomerMe(slug: string): Promise<CustomerProfile | undefined> {
  const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/me`, { credentials: "include" });
  return parseCustomer(response);
}

export async function customerLogin(slug: string, input: LoginInput): Promise<{ customer?: CustomerProfile; error?: string }> {
  const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/login`, {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (response.ok) return { customer: await response.json() };
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { error: result.error };
}

export async function customerRegister(slug: string, input: RegisterInput): Promise<{ customer?: CustomerProfile; error?: string }> {
  const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/register`, {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (response.ok) return { customer: await response.json() };
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { error: result.error };
}

export async function customerLogout(slug: string): Promise<void> {
  await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/logout`, { credentials: "include", method: "POST" });
}

export async function customerRequestPasswordReset(slug: string, email: string): Promise<{ error?: string; ok: boolean }> {
  const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/password-reset/request`, {
    body: JSON.stringify({ email }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (response.ok) return { ok: true };
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { error: result.error, ok: false };
}

export async function customerCompletePasswordReset(slug: string, token: string, newPassword: string): Promise<{ error?: string; ok: boolean }> {
  const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/customer-auth/password-reset/complete`, {
    body: JSON.stringify({ new_password: newPassword, token }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (response.ok) return { ok: true };
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { error: result.error, ok: false };
}
