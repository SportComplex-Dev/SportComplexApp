/**
 * align-supabase-auth — migración escalable de cuentas legacy a Supabase Auth.
 *
 * Crea identidades en Supabase Auth para los usuarios ACTIVO de `usuario` que aún
 * no tienen cuenta (por eso dependen del fallback Argon2id). Al completarse, esas
 * cuentas inician sesión por la ruta primaria de Supabase y el fallback puede
 * desactivarse (AUTH_ALLOW_LOCAL_FALLBACK=false).
 *
 * Uso:
 *   tsx --env-file ../../apps/web/.env.local scripts/align-supabase-auth.mts
 *   tsx --env-file ../../apps/web/.env.local scripts/align-supabase-auth.mts --execute
 *
 * Variables:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL     URL del proyecto
 *   SUPABASE_SERVICE_ROLE_KEY                   clave service role (Admin API)
 *   DIRECT_URL | DATABASE_URL                   conexión Postgres (Prisma)
 *   MIGRATION_PASSWORD                          contraseña a asignar (requerido con --execute)
 *
 * Sin --execute es solo lectura (dry-run) y no modifica nada.
 */
import { prisma } from "../src/index.ts";

const EXECUTE = process.argv.includes("--execute");

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
const password = process.env.MIGRATION_PASSWORD || "";

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function listAuthEmails(): Promise<Set<string>> {
  const emails = new Set<string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) throw new Error(`Admin list falló: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { users?: Array<{ email?: string }> };
    const users = body.users ?? [];
    for (const user of users) {
      if (user.email) emails.add(user.email.toLowerCase());
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return emails;
}

async function createAuthUser(email: string, pass: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: pass, email_confirm: true }),
  });
  if (res.ok) return { ok: true, detail: "creada" };
  return { ok: false, detail: `${res.status} ${await res.text()}` };
}

const authEmails = await listAuthEmails();

const candidatos = await prisma.usuario.findMany({
  where: { estado: "ACTIVO", deletedAt: null, passwordHash: { not: null } },
  include: { rol: true },
  orderBy: { creadoEn: "asc" },
});

const pendientes = candidatos.filter(
  (u) => !authEmails.has(u.correo.toLowerCase()) && (!onlyFilter || onlyFilter.has(u.correo.toLowerCase())),
);

const porRol = pendientes.reduce<Record<string, number>>((acc, u) => {
  const k = u.rol?.nombre ?? "SIN_ROL";
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`Auth: ${authEmails.size} identidades | ACTIVO con hash: ${candidatos.length} | pendientes: ${pendientes.length}`);
console.log("Pendientes por rol:", JSON.stringify(porRol));
console.log("Correos pendientes:", pendientes.map((u) => u.correo).join(", ") || "(ninguno)");

if (!EXECUTE) {
  console.log("\n[dry-run] Nada modificado. Reejecuta con --execute y MIGRATION_PASSWORD=<pass>.");
  await prisma.$disconnect();
  process.exit(0);
}

if (password.length < 8) {
  console.error("\n[execute] MIGRATION_PASSWORD ausente o < 8 caracteres.");
  await prisma.$disconnect();
  process.exit(1);
}

let creadas = 0;
let fallidas = 0;
for (const u of pendientes) {
  const result = await createAuthUser(u.correo.toLowerCase(), password);
  if (result.ok) creadas += 1;
  else {
    fallidas += 1;
    console.error(`FALLÓ ${u.correo}: ${result.detail}`);
  }
}
console.log(`\n[execute] Creadas: ${creadas} | Fallidas: ${fallidas}`);

await prisma.$disconnect();