/**
 * align-supabase-auth — migración escalable de cuentas legacy a Supabase Auth.
 *
 * Crea identidades en Supabase Auth para los usuarios ACTIVO de `usuario` que aún
 * no tienen cuenta (por eso dependen del fallback Argon2id). Al completarse, esas
 * cuentas inician sesión por la ruta primaria de Supabase y el fallback puede
 * desactivarse (AUTH_ALLOW_LOCAL_FALLBACK=false).
 *
 * Uso:
 *   tsx scripts/align-supabase-auth.mts                       # dry-run (solo lectura)
 *   tsx scripts/align-supabase-auth.mts --execute             # crea las identidades pendientes
 *   tsx scripts/align-supabase-auth.mts --reset               # rota la contraseña de identidades existentes
 *   tsx scripts/align-supabase-auth.mts --only=a@x.com,b@x.com
 *
 * Variables:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL     URL del proyecto
 *   SUPABASE_SERVICE_ROLE_KEY                   clave service role (Admin API)
 *   DIRECT_URL | DATABASE_URL                   conexión Postgres (Prisma)
 *
 * Contraseñas: se generan por usuario de forma secuencial `SportComplex{n}!` (no se
 * reutiliza una sola contraseña para todas) y se escriben en
 * `.auth-passwords.local.txt` (gitignored). Nunca se versionan.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/index.ts";

const EXECUTE = process.argv.includes("--execute");
const RESET = process.argv.includes("--reset");

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlyFilter = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )
  : null;

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

/** Contraseña determinista por posición del usuario en la lista ordenada. */
function passwordFor(index: number): string {
  return `SportComplex${index + 1}!`;
}

async function listAuthUsers(): Promise<Map<string, string>> {
  const users = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: adminHeaders,
    });
    if (!res.ok) throw new Error(`Admin list falló: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { users?: Array<{ id?: string; email?: string }> };
    const batch = body.users ?? [];
    for (const user of batch) {
      if (user.email && user.id) users.set(user.email.toLowerCase(), user.id);
    }
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function createAuthUser(email: string, pass: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password: pass, email_confirm: true }),
  });
  if (res.ok) return { ok: true, detail: "creada" };
  return { ok: false, detail: `${res.status} ${await res.text()}` };
}

async function resetAuthPassword(id: string, pass: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ password: pass }),
  });
  if (res.ok) return { ok: true, detail: "rota" };
  return { ok: false, detail: `${res.status} ${await res.text()}` };
}

const authUsers = await listAuthUsers();

const candidatos = await prisma.usuario.findMany({
  where: { estado: "ACTIVO", deletedAt: null, passwordHash: { not: null } },
  include: { rol: true },
  orderBy: { creadoEn: "asc" },
});

const seleccion = candidatos.filter(
  (u) => !onlyFilter || onlyFilter.has(u.correo.toLowerCase()),
);
const pendientes = seleccion.filter((u) => !authUsers.has(u.correo.toLowerCase()));
const existentes = seleccion.filter((u) => authUsers.has(u.correo.toLowerCase()));

// Credenciales por usuario: índice estable sobre la lista completa ordenada.
const credenciales = new Map<string, string>();
candidatos.forEach((u, i) => {
  credenciales.set(u.correo.toLowerCase(), passwordFor(i));
});

const porRol = pendientes.reduce<Record<string, number>>((acc, u) => {
  const k = u.rol?.nombre ?? "SIN_ROL";
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`Auth: ${authUsers.size} identidades | ACTIVO con hash: ${candidatos.length} | pendientes: ${pendientes.length} | existentes: ${existentes.length}`);
console.log("Pendientes por rol:", JSON.stringify(porRol));
console.log("Correos pendientes:", pendientes.map((u) => u.correo).join(", ") || "(ninguno)");

if (!EXECUTE && !RESET) {
  console.log("\n[dry-run] Nada modificado. Usa --execute (crear) o --reset (rotar contraseña).");
  await prisma.$disconnect();
  process.exit(0);
}

let creadas = 0;
let rotadas = 0;
let fallidas = 0;

if (EXECUTE) {
  for (const u of pendientes) {
    const pass = credenciales.get(u.correo.toLowerCase())!;
    const result = await createAuthUser(u.correo.toLowerCase(), pass);
    if (result.ok) creadas += 1;
    else {
      fallidas += 1;
      console.error(`FALLÓ ${u.correo}: ${result.detail}`);
    }
  }
}

if (RESET) {
  for (const u of existentes) {
    const id = authUsers.get(u.correo.toLowerCase())!;
    const pass = credenciales.get(u.correo.toLowerCase())!;
    const result = await resetAuthPassword(id, pass);
    if (result.ok) rotadas += 1;
    else {
      fallidas += 1;
      console.error(`FALLÓ reset ${u.correo}: ${result.detail}`);
    }
  }
}

const lineas = seleccion.map((u) => `${u.correo.toLowerCase()}\t${credenciales.get(u.correo.toLowerCase())!}\t${u.rol?.nombre ?? "SIN_ROL"}`);
writeFileSync(new URL(".auth-passwords.local.txt", import.meta.url), `${lineas.join("\n")}\n`, "utf8");

console.log(`\n[${EXECUTE ? "execute" : ""}${EXECUTE && RESET ? "+" : ""}${RESET ? "reset" : ""}] Creadas: ${creadas} | Rotadas: ${rotadas} | Fallidas: ${fallidas}`);
console.log("Credenciales escritas en packages/db/scripts/.auth-passwords.local.txt (gitignored).");

await prisma.$disconnect();
