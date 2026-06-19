const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export function apiBaseUrl(): string {
  if (typeof window === "undefined" || !configuredApiUrl) {
    return configuredApiUrl;
  }

  const configured = new URL(configuredApiUrl);
  const pageHostname = window.location.hostname;
  const configuredIsLocal =
    configured.hostname === "localhost" ||
    configured.hostname === "127.0.0.1";
  const pageIsLocal =
    pageHostname === "localhost" ||
    pageHostname === "127.0.0.1";

  if (configuredIsLocal && !pageIsLocal) {
    configured.hostname = pageHostname;
  }

  return configured.origin;
}
