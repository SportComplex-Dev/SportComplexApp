import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  // Placeholder: lee cookie de sesión Supabase/Auth.
  // TODO(feature/auth-provider-email): validar JWT real + estado Activo/Inactivo (RN-10).
  const role = req.cookies.get("sc-role")?.value ?? null;
  return role;
}

async function getSupabaseCustomerSession(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const role = data.user.app_metadata.role;
  return { isCustomer: role === undefined || role === "Cliente", response };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = getSessionRole(req);
  let supabaseResponse: NextResponse | null = null;

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
    if (!role) {
      const session = await getSupabaseCustomerSession(req);
      if (!session?.isCustomer)
        return NextResponse.redirect(new URL("/login", req.url), 307);
      supabaseResponse = session.response;
    }
    // TODO: validar estado Activo (bloqueo Pendiente/Inactivo)
  }

  return supabaseResponse ?? NextResponse.next();
}

export const config = {
  matcher: ["/", "/portal/:path*", "/pos/:path*", "/scanner/:path*", "/admin/:path*", "/api/:path*"],
};
