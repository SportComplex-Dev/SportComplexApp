/**
 * Genera docs/api/openapi.json a partir de:
 * 1. Los route handlers reales en apps/web/src/app/api (paths + methods)
 * 2. Los esquemas Zod de @sportcomplex/validation (component schemas)
 *
 * Uso: pnpm docs:openapi
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as validation from "@sportcomplex/validation";

const ROOT = resolve(__dirname, "..");
const API_DIR = join(ROOT, "apps/web/src/app/api");
const OUT = join(ROOT, "docs/api/openapi.json");

// ---------- 1. Enumerar route handlers ----------
function walkRoutes(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base + "/" + entry;
    if (statSync(full).isDirectory()) {
      out.push(...walkRoutes(full, rel));
    } else if (entry === "route.ts") {
      out.push(rel);
    }
  }
  return out;
}

function toOpenApiPath(routeRel: string): string {
  // /bookings/[id]/route.ts -> /api/bookings/{id}; /auth/[...nextauth] -> /auth/{...nextauth}
  return routeRel
    .replace(/\/route\.ts$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, "{$2}");
}

function extractMethods(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const methods: string[] = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    // export async function GET( | export const GET =
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src) ||
        new RegExp(`export\\s+const\\s+${m}\\b`).test(src)) {
      methods.push(m.toLowerCase());
    }
  }
  return methods;
}

function firstSegment(routeRel: string): string {
  return "/" + (routeRel.replace(/^\//, "").split("/")[0] ?? "");
}

function tagFor(path: string): string {
  if (path.startsWith("/api/public")) return "Public";
  if (path.startsWith("/api/auth")) return "Auth";
  if (path.startsWith("/api/bookings") || path.startsWith("/api/payments")) return "Bookings";
  if (path.startsWith("/api/memberships") || path.startsWith("/api/portal")) return "Portal";
  if (path.startsWith("/api/admin")) return "Admin";
  if (path.startsWith("/api/pos")) return "POS";
  if (path.startsWith("/api/access") || path.startsWith("/api/tickets")) return "Scanner";
  if (path.startsWith("/api/webhooks") || path.startsWith("/api/cron") || path.startsWith("/api/internal")) return "Webhooks";
  if (path.startsWith("/api/v1/bot")) return "Bot";
  if (path.startsWith("/api/pdf")) return "Portal";
  if (path.startsWith("/api/tournaments")) return "Public";
  return "Public";
}

// Schemas Zod conocidos por ruta (petición POST) — nombres reales de @sportcomplex/validation
const KNOWN_REQUEST_SCHEMAS: Record<string, string> = {
  "/api/bookings": "BookingRequest",
  "/api/bookings/lock-cart": "CartCheckoutRequest",
  "/api/pos/checkout": "PosCheckoutRequest",
  "/api/tournaments/{id}/register": "RegisterTournamentInput",
  "/api/admin/tournaments": "CreateTournamentInput",
  "/api/admin/tournaments/{id}": "UpdateTournamentInput",
  "/api/admin/services": "CreateServicioInput",
  "/api/admin/services/{id}": "UpdateServicioInput",
  "/api/admin/services/categories": "CreateCategoriaInput",
  "/api/admin/services/categories/{id}": "UpdateCategoriaInput",
  "/api/admin/employees": "CreateEmployeeInput",
  "/api/auth/login": "LoginInput",
  "/api/auth/register": "RegisterInput",
};

// ---------- 2. Component schemas desde @sportcomplex/validation ----------
type ZodLike = { _def?: unknown; safeParse?: (v: unknown) => unknown; description?: string };
function schemaToOpenApi(schema: unknown): unknown {
  // Pragmático: describimos shape vía zod-to-json-schema si está, sino marcador
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { zodToJsonSchema } = require("zod-to-json-schema");
    return zodToJsonSchema(schema, { $refStrategy: "none" });
  } catch {
    return { type: "object", description: "Zod schema (no serializable)" };
  }
}

// Mapa de nombre de componente -> export real del paquete (sufijo Schema)
const SCHEMA_EXPORTS: Record<string, string> = {
  BookingRequest: "bookingRequestSchema",
  CartCheckoutRequest: "cartCheckoutSchema",
  AvailabilityQuery: "availabilityQuerySchema",
  PosCheckoutRequest: "posCheckoutSchema",
  PosPaymentIntentRequest: "posPaymentIntentSchema",
  RegisterTournamentInput: "registerTournamentSchema",
  CreateTournamentInput: "createTournamentSchema",
  UpdateTournamentInput: "updateTournamentSchema",
  LoginInput: "loginSchema",
  RegisterInput: "registerSchema",
  CreateEmployeeInput: "createEmployeeSchema",
  CreateServicioInput: "createServicioSchema",
  UpdateServicioInput: "updateServicioSchema",
  CreateCategoriaInput: "createCategoriaSchema",
  UpdateCategoriaInput: "updateCategoriaSchema",
  AccessScan: "accessScanSchema",
  AccessRedeem: "accessRedeemSchema",
  BotTicketQuery: "botTicketQuerySchema",
  AnalyticsQueryInput: "analyticsQuerySchema",
};

function collectSchemas(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const exports = validation as unknown as Record<string, unknown>;
  for (const [name, exportName] of Object.entries(SCHEMA_EXPORTS)) {
    const s = exports[exportName];
    if (s) out[name] = schemaToOpenApi(s);
  }
  return out;
}

// ---------- 3. Ensamblar el documento ----------
const routes = walkRoutes(API_DIR);
const paths: Record<string, Record<string, unknown>> = {};

for (const rel of routes) {
  const path = "/api" + toOpenApiPath(rel);
  const methods = extractMethods(join(API_DIR, rel));
  if (methods.length === 0) continue;
  const tag = tagFor(path);
  const item: Record<string, unknown> = {};
  for (const m of methods) {
    const op: Record<string, unknown> = {
      tags: [tag],
      summary: `${m.toUpperCase()} ${path}`,
      responses: {
        "200": { description: "OK" },
        "400": { description: "Validation error (Zod)" },
        "401": { description: "Session requerida (proxy perimetral)" },
        "403": { description: "Rol no autorizado (RBAC)" },
      },
    };
    if (m === "post" && KNOWN_REQUEST_SCHEMAS[path]) {
      op.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: `#/components/schemas/${KNOWN_REQUEST_SCHEMAS[path]}` },
          },
        },
      };
    }
    item[m] = op;
  }
  paths[path] = item;
}

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "SportComplex API",
    version: "1.0.0",
    description: "API REST interna de apps/web (App Router). Auth perimetral via proxy.ts (RBAC por rol); los handlers consumen @sportcomplex/db y @sportcomplex/core.",
  },
  servers: [{ url: "http://localhost:3000", description: "Desarrollo" }],
  tags: [
    { name: "Public", description: "Catálogo público, torneos" },
    { name: "Auth", description: "Registro, login, verificación, OAuth" },
    { name: "Bookings", description: "Reservas, bloqueos, pagos Stripe" },
    { name: "Portal", description: "Área cliente: membresías, PDF" },
    { name: "Admin", description: "Consola: catálogo, torneos, empleados, analytics" },
    { name: "POS", description: "Taquilla cashless" },
    { name: "Scanner", description: "Validación de acceso y canje QR" },
    { name: "Webhooks", description: "Stripe, n8n, cron, internos" },
    { name: "Bot", description: "API v1 para chatbot (n8n)" },
  ],
  components: {
    securitySchemes: {
      SessionCookie: { type: "apiKey", in: "cookie", name: "sc-session" },
      SupabaseBearer: { type: "http", scheme: "bearer" },
    },
    schemas: collectSchemas(),
  },
  paths,
};

mkdirSync(join(ROOT, "docs/api"), { recursive: true });
writeFileSync(OUT, JSON.stringify(openapi, null, 2));
console.log(`openapi.json: ${Object.keys(paths).length} paths, ${Object.keys(openapi.components.schemas).length} schemas -> ${relative(ROOT, OUT)}`);
