export const INTERNAL_DASHBOARD_ROUTE_PATTERNS = [
  "/",
  "/calendar/appointments/:id",
  "/clients/:id",
  "/inventory/:id",
  "/marketing/:id",
  "/settings/services/:id",
  "/settings/staff/:id",
  "/settings/staff/requests",
] as const;

export const DOCUMENTED_INTERNAL_REDIRECTS = {
  "/calendar/appointments/:id": {
    destination: "/calendar?appointment=",
    page: "(dashboard)/calendar/appointments/[appointmentId]/page.tsx",
  },
  "/settings/staff/requests": {
    destination: "/staff/permissions",
    page: "(dashboard)/settings/staff/requests/page.tsx",
  },
} as const;

function matchesPattern(pathname: string, pattern: string): boolean {
  const expression = pattern
    .split("/")
    .map((segment) => (segment === ":id" ? "[^/?#]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${expression}$`).test(pathname);
}

export function isInternalDashboardHref(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;

  const pathname = href.split(/[?#]/, 1)[0];
  return Boolean(
    pathname &&
      INTERNAL_DASHBOARD_ROUTE_PATTERNS.some((pattern) =>
        matchesPattern(pathname, pattern),
      ),
  );
}
