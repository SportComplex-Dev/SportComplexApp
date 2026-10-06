import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// RBAC perimetral — ARCHITECTURE §8.3 + redirección landing §4.1
// Rutas:
//  /admin/* + /api/admin/* → Administrador
//  /pos/* + /api/pos/* → Administrador | Empleado Vendedor
//  /scanner/* + /api/access/* → Administrador | Empleado Lector
//  /portal/* → Cliente Activo
//  (public)/ landing SSG: si hay sesión, 307 al portal según rol.

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  VENDEDOR: "/pos",
  LECTOR: "/scanner",
  CLIENTE: "/portal",
};

const { auth: withAuth } = NextAuth(authConfig);

export default withAuth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role ?? null;
  const isActive = session?.user?.estado === "ACTIVO";

  // 1. Landing pública: redirige autenticados a su portal (307)
  if (pathname === "/") {
    if (isActive && role && ROLE_HOME[role]) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  // 2. RBAC
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isActive || role !== "ADMIN")
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Administrador" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/pos") || pathname.startsWith("/api/pos")) {
    if (!isActive || (role !== "ADMIN" && role !== "VENDEDOR"))
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Vendedor" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/scanner") || pathname.startsWith("/api/access")) {
    if (!isActive || (role !== "ADMIN" && role !== "LECTOR"))
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Lector" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
  }

  if (pathname.startsWith("/portal")) {
    if (!session?.user?.id)
      return NextResponse.redirect(new URL("/login", req.url), 307);
    if (!isActive || role !== "CLIENTE") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere una cuenta de Cliente activa" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/portal/:path*", "/pos/:path*", "/scanner/:path*", "/admin/:path*", "/api/:path*"],
};
