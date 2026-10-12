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
 *   tsx scripts/align-supabase-auth.mts --reset --only=a@x.com # rota la contraseña de identidades existentes (dirigido)
 *   tsx scripts/align-supabase-auth.mts --reset --yes         # rota TODAS las existentes (requiere confirmación explícita)
 *   tsx scripts/align-supabase-auth.mts --only=a@x.com,b@x.com
 *
 * Variables:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL     URL del proyecto
 *   SUPABASE_SERVICE_ROLE_KEY                   clave service role (Admin API)
 *   DIRECT_URL | DATABASE_URL                   conexión Postgres (Prisma)
 *
 * Contraseñas: aleatorias por usuario (CSPRNG, 20 caracteres) y se escriben en
 * `.auth-passwords.local.txt` (gitignored, modo 0600) SOLO para las cuentas
 * creadas/rotadas en esta ejecución. Nunca se versionan ni se imprimen.
 */
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/index.ts";

const EXECUTE = process.argv.includes("--execute");
const RESET = process.argv.includes("--reset");
const CONFIRMED = process.argv.includes("--yes");

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

/** Contraseña aleatoria por usuario (CSPRNG). Alfabeto sin caracteres ambiguos. */
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

function randomPassword(length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  return out;
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

// --reset sin --only ni --yes sería una rotación masiva accidental: exigir alcance.
if (RESET && !onlyFilter && !CONFIRMED) {
  console.error(
    "[reset] Operación destructiva: rota contraseñas de cuentas existentes. " +
      "Acota con --only=a@x.com,b@x.com o confirma con --yes.",
  );
  await prisma.$disconnect();
  process.exit(1);
}

let creadas = 0;
let rotadas = 0;
let fallidas = 0;

// Solo se persisten en el archivo las credenciales aplicadas en ESTA ejecución
// (las existentes no tocadas conservan su contraseña anterior).
const aplicadas = new Map<string, { pass: string; rol: string }>();

if (EXECUTE) {
  for (const u of pendientes) {
    const pass = randomPassword();
    const result = await createAuthUser(u.correo.toLowerCase(), pass);
    if (result.ok) {
      creadas += 1;
      aplicadas.set(u.correo.toLowerCase(), { pass, rol: u.rol?.nombre ?? "SIN_ROL" });
    } else {
      fallidas += 1;
      console.error(`FALLÓ ${u.correo}: ${result.detail}`);
    }
  }
}

if (RESET) {
  for (const u of existentes) {
    const id = authUsers.get(u.correo.toLowerCase())!;
    const pass = randomPassword();
    const result = await resetAuthPassword(id, pass);
    if (result.ok) {
      rotadas += 1;
      aplicadas.set(u.correo.toLowerCase(), { pass, rol: u.rol?.nombre ?? "SIN_ROL" });
    } else {
      fallidas += 1;
      console.error(`FALLÓ reset ${u.correo}: ${result.detail}`);
    }
  }
}

if (aplicadas.size > 0) {
  const destino = new URL(".auth-passwords.local.txt", import.meta.url);
  const lineas = [...aplicadas.entries()].map(([correo, { pass, rol }]) => `${correo}\t${pass}\t${rol}`);
  writeFileSync(destino, `${lineas.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Credenciales aplicadas escritas en packages/db/scripts/.auth-passwords.local.txt (gitignored, 0600).");
} else {
  console.log("Sin credenciales nuevas: no se escribió el archivo de contraseñas.");
}

console.log(`\n[${EXECUTE ? "execute" : ""}${EXECUTE && RESET ? "+" : ""}${RESET ? "reset" : ""}] Creadas: ${creadas} | Rotadas: ${rotadas} | Fallidas: ${fallidas}`);

await prisma.$disconnect();
