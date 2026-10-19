import type { CanonicalRole } from "@/lib/auth/session";

const ROUTE_ROLES: ReadonlyArray<{
  prefixes: readonly string[];
  roles: readonly CanonicalRole[];
}> = [
  { prefixes: ["/admin", "/api/admin"], roles: ["Administrador"] },
  {
    prefixes: ["/pos", "/api/pos"],
    roles: ["Administrador", "Empleado_Vendedor"],
  },
  {
    prefixes: ["/api/payments/intent"],
    roles: ["Administrador", "Empleado_Vendedor"],
  },
  {
    prefixes: ["/scanner", "/api/access", "/api/tickets/verify"],
    roles: ["Administrador", "Empleado_Lector"],
  },
  { prefixes: ["/portal"], roles: ["Cliente"] },
  {
    prefixes: ["/api/pdf/receipt"],
    roles: ["Administrador", "Empleado_Vendedor", "Cliente"],
  },
];

const PUBLIC_PORTAL_ROUTES: readonly string[] = ["/portal/membership"];

export function isRoleAllowedForPath(
  pathname: string,
  role: CanonicalRole | null,
): boolean {
  if (PUBLIC_PORTAL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return true;
  }
  const policy = ROUTE_ROLES.find(({ prefixes }) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
  return !policy || (role !== null && policy.roles.includes(role));
}
