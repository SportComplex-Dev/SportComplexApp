import { NextResponse, type NextRequest } from "next/server";

// RBAC perimetral — ARCHITECTURE §8.3 + redirección landing §4.1
// Rutas:
//  /admin/* + /api/admin/* → Administrador
//  /pos/* + /api/pos/* → Administrador | Empleado Vendedor
//  /scanner/* + /api/access/* → Administrador | Empleado Lector
//  /portal/* → Cliente Activo
//  (public)/ landing SSG: si hay sesión, 307 al portal según rol.

const ROLE_HOME: Record<string, string> = {
  Administrador: "/admin/dashboard",
  Empleado_Vendedor: "/pos",
  Empleado_Lector: "/scanner",
  Cliente: "/portal",
};

function getSessionRole(req: NextRequest): string | null {
  // Placeholder: lee cookie de sesión Supabase/Auth o parámetro de rol en desarrollo
  const queryRole = req.nextUrl.searchParams.get("role") || req.nextUrl.searchParams.get("asRole");
  if (queryRole) return queryRole;
  const role = req.cookies.get("sc-role")?.value ?? null;
  return role;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const queryRole = req.nextUrl.searchParams.get("role") || req.nextUrl.searchParams.get("asRole");
  const role = getSessionRole(req);

  // 1. Landing pública: redirige autenticados a su portal (307)
  if (pathname === "/") {
    if (role && ROLE_HOME[role]) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  // 2. RBAC
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "Administrador")
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Administrador" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/pos") || pathname.startsWith("/api/pos")) {
    if (role !== "Administrador" && role !== "Empleado_Vendedor")
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Vendedor" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/scanner") || pathname.startsWith("/api/access")) {
    if (role !== "Administrador" && role !== "Empleado_Lector")
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Lector" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/portal")) {
    if (!role)
      return NextResponse.redirect(new URL("/login", req.url), 307);
    // TODO: validar estado Activo (bloqueo Pendiente/Inactivo)
  }

  const res = NextResponse.next();
  if (queryRole) {
    res.cookies.set("sc-role", queryRole, { path: "/", maxAge: 60 * 60 * 24 });
  }
  return res;
}

export const config = {
  matcher: ["/", "/portal/:path*", "/pos/:path*", "/scanner/:path*", "/admin/:path*", "/api/:path*"],
};
