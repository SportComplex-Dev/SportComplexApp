import { NextResponse, type NextRequest } from "next/server";
import { extractSession, ROLE_HOME } from "@/lib/session";

/**
 * RBAC perimetral y redirección de landing — ARCHITECTURE §4.1 y §8.3
 *
 * Flujo perimetral en la raíz (/) y páginas de autenticación (/login, /register):
 * - Visitante anónimo: Despacha HTML estático (SSG force-static en /) sin coste de CPU por petición (LCP < 1.5s).
 * - Usuario autenticado: Redirección inmediata 307 a la página base según su rol:
 *     - Cliente          → /portal
 *     - Empleado_Vendedor → /pos
 *     - Empleado_Lector   → /scanner
 *     - Administrador     → /admin
 *
 * Restricciones de rutas protegidas:
 * - /portal/*               → Cliente (o Administrador)
 * - /pos/* y /api/pos/*     → Administrador | Empleado Vendedor
 * - /scanner/* y /api/access/* → Administrador | Empleado Lector
 * - /admin/* y /api/admin/* → Administrador
 */

function createForbiddenResponse(req: NextRequest, message: string) {
  const acceptsHtml = req.headers.get("accept")?.includes("text/html");

  if (acceptsHtml) {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>403 - Acceso Denegado | SportComplex</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f17; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
    .card { background: #161e2e; border: 1px solid #273549; border-radius: 0.75rem; padding: 2rem; max-width: 440px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
    h1 { color: #f87171; font-size: 1.5rem; margin-top: 0; margin-bottom: 0.75rem; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0.5rem 0; }
    a { display: inline-block; margin-top: 1.25rem; padding: 0.6rem 1.25rem; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 0.5rem; font-weight: 500; font-size: 0.9rem; transition: background 0.15s ease; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>403 - Acceso Denegado</h1>
    <p><strong>${message}</strong></p>
    <p>No posees los privilegios requeridos para acceder a este módulo.</p>
    <a href="/">Ir al inicio</a>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json(
    { success: false, error: { code: "FORBIDDEN", message }, timestamp: new Date().toISOString() },
    { status: 403 },
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = extractSession(req);
  const role = session?.role ?? null;

  // 1. Landing pública (/) y páginas de login/registro (/login, /register):
  // Si el usuario ya está autenticado, redirigir con 307 a su portal según rol
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    if (role && ROLE_HOME[role]) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      return NextResponse.redirect(url, 307);
    }
    // Anónimo: continúa sin cómputo hacia la landing SSG o formulario
    return NextResponse.next();
  }

  // 2. Control perimetral para API Routes protegidas (401 si no hay sesión, 403 si rol no autorizado)
  if (pathname.startsWith("/api/admin")) {
    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sesión requerida" }, timestamp: new Date().toISOString() },
        { status: 401 },
      );
    }
    if (role !== "Administrador") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Administrador" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/pos")) {
    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sesión requerida" }, timestamp: new Date().toISOString() },
        { status: 401 },
      );
    }
    if (role !== "Administrador" && role !== "Empleado_Vendedor") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Vendedor" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/access")) {
    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sesión requerida" }, timestamp: new Date().toISOString() },
        { status: 401 },
      );
    }
    if (role !== "Administrador" && role !== "Empleado_Lector") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Requiere rol Lector" }, timestamp: new Date().toISOString() },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // 3. Control perimetral para páginas protegidas (Web Views)
  if (pathname.startsWith("/portal")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url), 307);
    }
    if (role !== "Cliente" && role !== "Administrador") {
      return createForbiddenResponse(req, "Acceso exclusivo para clientes");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url), 307);
    }
    if (role !== "Administrador") {
      return createForbiddenResponse(req, "Requiere rol Administrador");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/pos")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url), 307);
    }
    if (role !== "Administrador" && role !== "Empleado_Vendedor") {
      return createForbiddenResponse(req, "Requiere rol Vendedor");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/scanner")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url), 307);
    }
    if (role !== "Administrador" && role !== "Empleado_Lector") {
      return createForbiddenResponse(req, "Requiere rol Lector");
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/portal/:path*", "/pos/:path*", "/scanner/:path*", "/admin/:path*", "/api/:path*"],
};
