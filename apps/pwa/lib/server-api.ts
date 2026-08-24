export function serverApiBaseUrl(): string {
  const configured = process.env.API_INTERNAL_URL;
  if (!configured) throw new Error("API_INTERNAL_URL is required");
  const url = new URL(configured);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API_INTERNAL_URL must use HTTP or HTTPS");
  }
  return url.origin;
}
