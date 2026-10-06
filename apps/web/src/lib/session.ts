import type { NextRequest } from "next/server";

export type CanonicalRole = "Administrador" | "Empleado_Vendedor" | "Empleado_Lector" | "Cliente";

export interface SessionUser {
  role: CanonicalRole;
  status: string;
  userId?: string;
  email?: string;
}

export const ROLE_HOME: Record<CanonicalRole, string> = {
  Administrador: "/admin/dashboard",
  Empleado_Vendedor: "/pos",
  Empleado_Lector: "/scanner",
  Cliente: "/portal",
};

/**
 * Normaliza nombres de roles procedentes de la base de datos relacional (ADMIN, VENDEDOR, LECTOR, CLIENTE)
 * o de tipos de dominio (Administrador, Empleado_Vendedor, etc.) a la forma canónica.
 */
export function normalizeRole(roleStr?: string | null): CanonicalRole | null {
  if (!roleStr) return null;
  const normalized = roleStr.trim().toUpperCase();

  switch (normalized) {
    case "ADMIN":
    case "ADMINISTRADOR":
      return "Administrador";
    case "VENDEDOR":
    case "EMPLEADO_VENDEDOR":
    case "EMPLEADO VENDEDOR":
      return "Empleado_Vendedor";
    case "LECTOR":
    case "EMPLEADO_LECTOR":
    case "EMPLEADO LECTOR":
      return "Empleado_Lector";
    case "CLIENTE":
      return "Cliente";
    default:
      return null;
  }
}

/**
 * Comprueba si el estado de la cuenta permite el acceso perimetral.
 * RN-10: Cuentas inactivas o con borrado lógico tienen credenciales revocadas de inmediato.
 */
export function isAccountActive(statusStr?: string | null): boolean {
  if (!statusStr) return true; // Si no se declara estado explícito (modo dev / cookie simple), se asume activo
  const s = statusStr.trim().toUpperCase();
  if (s === "INACTIVO" || s === "TEMP_INACTIVO" || s === "TEMPORALMENTE_INACTIVO" || s === "INACTIVE") {
    return false;
  }
  return true;
}

/**
 * Decodifica el payload de un JWT de forma segura en entornos Edge / Node sin librerías nativas.
 * Valida la expiración (`exp`) contra la fecha actual.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonStr = atob(padded);
    const payload = JSON.parse(jsonStr);

    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    if (typeof payload.exp === "number") {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        return null; // Token expirado
      }
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extrae la sesión autenticada activa desde la petición HTTP inspeccionando:
 * 1. Cabecera `Authorization: Bearer <jwt>`
 * 2. Cookie `sc-token` (JWT)
 * 3. Cookies de sesión de Supabase (`sb-*-auth-token`)
 * 4. Cookie `sc-session` (JSON con { role, status, userId, email })
 * 5. Cookie `sc-role` (con soporte para cookie complementaria `sc-status`)
 *
 * Retorna `null` si no hay sesión, si el token expiró o si la cuenta está inactiva (RN-10).
 */
export function extractSession(req: NextRequest): SessionUser | null {
  // 1. Cabecera Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    const payload = decodeJwtPayload(token);
    if (payload) {
      const rawRole = (payload.role ||
        (payload.user_metadata as Record<string, unknown> | undefined)?.role ||
        (payload.app_metadata as Record<string, unknown> | undefined)?.role) as string | undefined;

      const rawStatus = (payload.estado ||
        (payload.user_metadata as Record<string, unknown> | undefined)?.estado ||
        payload.status) as string | undefined;

      const role = normalizeRole(rawRole);
      if (role && isAccountActive(rawStatus)) {
        return {
          role,
          status: rawStatus ?? "ACTIVO",
          userId: typeof payload.sub === "string" ? payload.sub : undefined,
          email: typeof payload.email === "string" ? payload.email : undefined,
        };
      }
    }
  }

  // 2. Cookie sc-token (JWT)
  const tokenCookie = req.cookies.get("sc-token")?.value;
  if (tokenCookie) {
    const payload = decodeJwtPayload(tokenCookie);
    if (payload) {
      const rawRole = (payload.role ||
        (payload.user_metadata as Record<string, unknown> | undefined)?.role ||
        (payload.app_metadata as Record<string, unknown> | undefined)?.role) as string | undefined;

      const rawStatus = (payload.estado ||
        (payload.user_metadata as Record<string, unknown> | undefined)?.estado ||
        payload.status) as string | undefined;

      const role = normalizeRole(rawRole);
      if (role && isAccountActive(rawStatus)) {
        return {
          role,
          status: rawStatus ?? "ACTIVO",
          userId: typeof payload.sub === "string" ? payload.sub : undefined,
          email: typeof payload.email === "string" ? payload.email : undefined,
        };
      }
    }
  }

  // 3. Cookies de Supabase Auth (sb-*-auth-token con soporte para chunks .0, .1...)
  // Defensa en Profundidad (Zero Trust):
  // La decodificación perimetral en Edge optimiza el despacho SSG y enrutamiento con cero I/O.
  // La validación criptográfica de firma (HMAC/RSA) y autorización granular residen en la capa API.
  const allCookies = req.cookies.getAll();
  const supabaseGroups = new Map<string, Array<{ index: number; value: string }>>();

  for (const cookie of allCookies) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      const match = cookie.name.match(/^(sb-.+-auth-token)(?:\.(\d+))?$/);
      if (match) {
        const baseName = match[1];
        const chunkIndex = match[2] !== undefined ? parseInt(match[2], 10) : 0;
        if (!supabaseGroups.has(baseName)) {
          supabaseGroups.set(baseName, []);
        }
        supabaseGroups.get(baseName)!.push({ index: chunkIndex, value: cookie.value });
      }
    }
  }

  for (const [, chunks] of supabaseGroups) {
    try {
      chunks.sort((a, b) => a.index - b.index);
      const combinedValue = chunks.map((c) => c.value).join("");

      let tokenToVerify: string | null = null;
      if (combinedValue.startsWith("{") || combinedValue.startsWith("[")) {
        const parsed = JSON.parse(combinedValue);
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          tokenToVerify = parsed[0];
        } else if (parsed && typeof parsed.access_token === "string") {
          tokenToVerify = parsed.access_token;
        }
      } else {
        tokenToVerify = combinedValue;
      }

      if (tokenToVerify) {
        const payload = decodeJwtPayload(tokenToVerify);
        if (payload) {
          const rawRole = (payload.role ||
            (payload.user_metadata as Record<string, unknown> | undefined)?.role ||
            (payload.app_metadata as Record<string, unknown> | undefined)?.role) as string | undefined;

          const rawStatus = (payload.estado ||
            (payload.user_metadata as Record<string, unknown> | undefined)?.estado ||
            payload.status) as string | undefined;

          const role = normalizeRole(rawRole);
          if (role && isAccountActive(rawStatus)) {
            return {
              role,
              status: rawStatus ?? "ACTIVO",
              userId: typeof payload.sub === "string" ? payload.sub : undefined,
              email: typeof payload.email === "string" ? payload.email : undefined,
            };
          }
        }
      }
    } catch {
      // Ignorar cookies malformadas y continuar con el siguiente grupo
    }
  }

  // 4. Cookie sc-session (JSON) y 5. Cookie directa sc-role - Solo desarrollo / testing local
  // En producción se requiere token JWT verificado para prevenir inyección directa vía document.cookie
  if (process.env.NODE_ENV !== "production") {
    const sessionCookie = req.cookies.get("sc-session")?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie);
        const role = normalizeRole(parsed.role);
        const status = parsed.status ?? parsed.estado;
        if (role && isAccountActive(status)) {
          return {
            role,
            status: status ?? "ACTIVO",
            userId: parsed.userId ?? parsed.id,
            email: parsed.email ?? parsed.correo,
          };
        }
      } catch {
        // Ignorar cookie malformada
      }
    }

    const roleCookie = req.cookies.get("sc-role")?.value;
    if (roleCookie) {
      const role = normalizeRole(roleCookie);
      const statusCookie = req.cookies.get("sc-status")?.value;
      if (role && isAccountActive(statusCookie)) {
        return {
          role,
          status: statusCookie ?? "ACTIVO",
        };
      }
    }
  }

  return null;
}
