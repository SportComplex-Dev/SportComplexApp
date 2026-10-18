/**
 * purge-test-users — Purga controlada de usuarios temporales en producción
 * (SCRUM-224 / TSK-BD-02, HU-37).
 *
 * ATENCIÓN OPERATIVA: Este script es una herramienta de saneamiento puntual
 * previo al lanzamiento (pre-go-live) para depurar usuarios generados durante
 * fases de prueba. Elimina fuera de la lista blanca de staff todos los usuarios y
 * sus dependencias en PostgreSQL (respetando ON DELETE RESTRICT) e identidades en
 * Supabase Auth vía Admin API.
 * NUNCA debe ejecutarse en producción una vez que comiencen a registrarse deportistas
 * o clientes reales, ya que cualquier cuenta fuera de la lista blanca de staff sería purgada.
 *
 * Uso:
 *   pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.ts --dry-run   # solo lectura (default)
 *   pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.ts --execute   # ejecuta la purga
 *
 * Auditoría: siempre se emite purge-reports/purge-report-<ISO>.json con los
 * IDs de los registros candidatos y — en modo --execute — de los eliminados
 * por tabla (CA: log auditable).
 *
 * Requiere (apps/web/.env.local o .env): SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 * y SUPABASE_SERVICE_ROLE_KEY para la fase de Supabase Auth.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env.local"));
  } catch {}
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env"));
  } catch {}
  try {
    process.loadEnvFile(path.resolve(__dirname, "../.env"));
  } catch {}
}

// Import dinámico: los imports ESM estáticos se evalúan ANTES del cargado de
// env y el cliente Prisma arrancaría sin DATABASE_URL.
const { prisma } = await import("../src/index.js");

// -----------------------------------------------------------------------------
// Lista blanca de staff (CA: ninguna cuenta legítima puede ser afectada).
// Correos institucionales y cuentas operativas documentadas (docs/features/auth).
// Añade aquí cualquier cuenta que deba sobrevivir a la purga.
// -----------------------------------------------------------------------------
const STAFF_ALLOWLIST = new Set(
  [
    "admin@example.com",
    "admin@sportcomplex.com",
    "vendedor@example.com",
    "lector@example.com",
    "laura.taquilla@sportcomplex.com",
    "carlos.lector@sportcomplex.com",
    "official@akros.lat",
  ].map((e) => e.toLowerCase()),
);

// Dominio institucional: jamás se purga ninguna cuenta con este dominio.
const STAFF_DOMAIN = "@sportcomplex.com";

function isStaffProtected(email: string): boolean {
  const c = email.toLowerCase();
  return STAFF_ALLOWLIST.has(c) || c.endsWith(STAFF_DOMAIN);
}

// Criterio del ticket TSK-BD-02: purga TODO lo que NO esté en la lista blanca
// de staff ("preservando únicamente las cuentas de staff autorizadas").
// El filtro por patrón (test/bot/...) era insuficiente: los ~78 usuarios de
// prueba de producción usan correos tipo deportistaN@sportmail.com y dominios
// aleatorios que no contienen esas palabras.
function isPurgeCandidate(email: string): boolean {
  return !isStaffProtected(email);
}

const EXECUTE = process.argv.includes("--execute");
const DRY_RUN = process.argv.includes("--dry-run") || !EXECUTE;

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function listSupabaseAuthUsers(): Promise<Map<string, string>> {
  if (!supabaseUrl || !serviceKey) return new Map();
  const users = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: adminHeaders,
    });
    if (!res.ok) {
      console.warn(`Admin list Supabase Auth falló: ${res.status}`);
      break;
    }
    const body = (await res.json()) as { users?: Array<{ id?: string; email?: string }> };
    const batch = body.users ?? [];
    for (const u of batch) {
      if (u.email && u.id) users.set(u.email.toLowerCase(), u.id);
    }
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function deleteSupabaseAuthUser(id: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  return res.ok;
}

interface PurgeReport {
  task: "TSK-BD-02";
  jira: "SCRUM-224";
  mode: "dry-run" | "execute";
  executedAt: string;
  protectedStaff: Array<{ email: string; id: string }>;
  candidates: { postgres: Array<{ email: string; id: string }>; supabaseAuth: Array<{ email: string; id: string }> };
  deleted: Record<string, string[]>;
  authDeleted: Array<{ email: string; id: string }>;
  authFailed: Array<{ email: string; id: string }>;
}

function writeReport(report: PurgeReport): string {
  const dir = path.resolve(__dirname, "../purge-reports");
  mkdirSync(dir, { recursive: true });
  const stamp = report.executedAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `purge-report-${report.mode}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

async function main() {
  console.log("=== Auditoría y Purga de Usuarios Temporales (TSK-BD-02 / SCRUM-224) ===");
  console.log(`Modo: ${EXECUTE ? "EJECUCIÓN" : "dry-run (default) — usa --execute para purgar"}`);

  if (EXECUTE) {
    console.warn("\n⚠️  ATENCIÓN OPERATIVA: Este script purga todas las cuentas fuera de la lista blanca de staff.");
    console.warn("   Uso exclusivo para saneamiento pre-lanzamiento (pre-go-live). No usar con usuarios reales registrados.\n");
  }

  const allUsers = await prisma.usuario.findMany({
    select: { id: true, correo: true, nombre: true },
  });

  const candidates = allUsers.filter((u) => isPurgeCandidate(u.correo));
  const protectedStaff = allUsers.filter((u) => isStaffProtected(u.correo));
  const candidateIds = candidates.map((u) => u.id);

  // Guard de seguridad: aborta si algún candidato está en la lista blanca.
  const violated = candidates.filter((u) => isStaffProtected(u.correo));
  if (violated.length > 0) {
    console.error("ABORTADO: candidatos vulneran la lista blanca de staff:");
    violated.forEach((u) => console.error(`  • ${u.correo} (${u.id})`));
    process.exit(1);
  }

  const authUsers = await listSupabaseAuthUsers();
  const candidateAuth: Array<{ email: string; id: string }> = [];
  for (const [email, id] of authUsers.entries()) {
    if (isPurgeCandidate(email)) candidateAuth.push({ email, id });
  }

  console.log(`- Usuarios de prueba detectados en PostgreSQL: ${candidates.length}`);
  console.log(`- Identidades de prueba detectadas en Supabase Auth: ${candidateAuth.length}`);
  console.log(`- Cuentas de staff protegidas (lista blanca + ${STAFF_DOMAIN}): ${protectedStaff.length}`);

  if (candidates.length > 0) {
    console.log("\nCorreos en PostgreSQL a purgar:");
    candidates.forEach((u) => console.log(`  • ${u.correo} (${u.id})`));
  }
  if (protectedStaff.length > 0) {
    console.log("\nCuentas de staff protegidas (NO se purgan):");
    protectedStaff.forEach((u) => console.log(`  • ${u.correo} (${u.id})`));
  }

  const report: PurgeReport = {
    task: "TSK-BD-02",
    jira: "SCRUM-224",
    mode: EXECUTE ? "execute" : "dry-run",
    executedAt: new Date().toISOString(),
    protectedStaff: protectedStaff.map((u) => ({ email: u.correo, id: u.id })),
    candidates: {
      postgres: candidates.map((u) => ({ email: u.correo, id: u.id })),
      supabaseAuth: candidateAuth,
    },
    deleted: {},
    authDeleted: [],
    authFailed: [],
  };

  if (DRY_RUN && !EXECUTE) {
    const file = writeReport(report);
    console.log(`\n[dry-run] Ningún cambio realizado. Reporte: ${path.relative(process.cwd(), file)}`);
    return;
  }

  console.log("\nIniciando purga en PostgreSQL...");

  await prisma.$transaction(async (tx) => {
    // 1. Tokens de verificación (única FK Cascade hacia Usuario)
    const tokens = await tx.tokenVerificacion.findMany({
      where: { usuarioId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.tokenVerificacion.deleteMany({ where: { id: { in: tokens.map((t) => t.id) } } });
    report.deleted.tokenVerificacion = tokens.map((t) => t.id);
    console.log(`  ✔ Tokens de verificación eliminados: ${tokens.length}`);

    // 2. Desvincular referencias de empleados (Restrict)
    await tx.ticketQr.updateMany({
      where: { usadoPor: { in: candidateIds } },
      data: { usadoPor: null },
    });
    await tx.inscripcionTorneo.updateMany({
      where: { ticketUsadoPor: { in: candidateIds } },
      data: { ticketUsadoPor: null },
    });
    await tx.reserva.updateMany({
      where: { vendedorId: { in: candidateIds } },
      data: { vendedorId: null },
    });

    // 3. Lecturas de acceso y puestos asociados
    const tickets = await tx.ticketQr.findMany({
      where: { reserva: { titularId: { in: candidateIds } } },
      select: { id: true },
    });
    const ticketIds = tickets.map((t) => t.id);

    const lecturas = await tx.lecturaAcceso.findMany({
      where: { OR: [{ empleadoId: { in: candidateIds } }, { ticketId: { in: ticketIds } }] },
      select: { id: true },
    });
    await tx.lecturaAcceso.deleteMany({ where: { id: { in: lecturas.map((l) => l.id) } } });
    report.deleted.lecturaAcceso = lecturas.map((l) => String(l.id));
    console.log(`  ✔ Registros de lectura de acceso eliminados: ${lecturas.length}`);

    const puestos = await tx.asignacionPuesto.findMany({
      where: { empleadoId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.asignacionPuesto.deleteMany({ where: { id: { in: puestos.map((p) => p.id) } } });
    report.deleted.asignacionPuesto = puestos.map((p) => p.id);

    const ticketsDel = await tx.ticketQr.deleteMany({ where: { id: { in: ticketIds } } });
    report.deleted.ticketQr = ticketIds;
    console.log(`  ✔ Tickets QR eliminados: ${ticketsDel.count}`);

    // 4. Torneos e inscripciones
    const inscripciones = await tx.inscripcionTorneo.findMany({
      where: { usuarioId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.inscripcionTorneo.deleteMany({ where: { id: { in: inscripciones.map((i) => i.id) } } });
    report.deleted.inscripcionTorneo = inscripciones.map((i) => i.id);

    const bloqueos = await tx.torneoBloqueo.findMany({
      where: { torneo: { adminId: { in: candidateIds } } },
      select: { id: true },
    });
    await tx.torneoBloqueo.deleteMany({ where: { id: { in: bloqueos.map((b) => b.id) } } });
    report.deleted.torneoBloqueo = bloqueos.map((b) => b.id);

    const torneos = await tx.torneo.findMany({
      where: { adminId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.torneo.deleteMany({ where: { id: { in: torneos.map((t) => t.id) } } });
    report.deleted.torneo = torneos.map((t) => t.id);

    // 5. Reservas (dummy), pagos y membresías
    const reservas = await tx.reserva.findMany({
      where: { titularId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.reserva.deleteMany({ where: { id: { in: reservas.map((r) => r.id) } } });
    report.deleted.reserva = reservas.map((r) => r.id);
    console.log(`  ✔ Reservas eliminadas: ${reservas.length}`);

    const pagos = await tx.pago.findMany({
      where: { usuarioId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.pago.deleteMany({ where: { id: { in: pagos.map((p) => p.id) } } });
    report.deleted.pago = pagos.map((p) => p.id);
    console.log(`  ✔ Pagos eliminados: ${pagos.length}`);

    const membresias = await tx.membresia.findMany({
      where: { usuarioId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.membresia.deleteMany({ where: { id: { in: membresias.map((m) => m.id) } } });
    report.deleted.membresia = membresias.map((m) => m.id);
    console.log(`  ✔ Membresías eliminadas: ${membresias.length}`);

    const inhabilitaciones = await tx.inhabilitacionServicio.findMany({
      where: { adminId: { in: candidateIds } },
      select: { id: true },
    });
    await tx.inhabilitacionServicio.deleteMany({ where: { id: { in: inhabilitaciones.map((i) => i.id) } } });
    report.deleted.inhabilitacionServicio = inhabilitaciones.map((i) => i.id);

    // 6. Eliminación de usuarios
    await tx.usuario.deleteMany({ where: { id: { in: candidateIds } } });
    report.deleted.usuario = candidateIds;
    console.log(`  ✔ Usuarios eliminados en PostgreSQL: ${candidateIds.length}`);
  });

  // 7. Purga en Supabase Auth (respeta lista blanca)
  if (candidateAuth.length > 0 && serviceKey) {
    console.log("\nPurgando identidades en Supabase Auth...");
    for (const authUser of candidateAuth) {
      if (isStaffProtected(authUser.email)) {
        console.warn(`  ⚠️ OMITIDO (staff protegido): ${authUser.email}`);
        continue;
      }
      const ok = await deleteSupabaseAuthUser(authUser.id);
      if (ok) {
        report.authDeleted.push(authUser);
        console.log(`  ✔ Supabase Auth identity borrada: ${authUser.email}`);
      } else {
        report.authFailed.push(authUser);
        console.warn(`  ⚠️ Falló borrado en Supabase Auth para: ${authUser.email}`);
      }
    }
    console.log(`Total identidades eliminadas en Supabase Auth: ${report.authDeleted.length}`);
  } else if (candidateAuth.length === 0) {
    console.log("\nSin identidades de prueba que purgar en Supabase Auth.");
  } else {
    console.warn("\n⚠️ SUPABASE_SERVICE_ROLE_KEY no definida: se omite la purga en Supabase Auth.");
  }

  const file = writeReport(report);
  console.log(`\n🚀 Purga completada. Reporte de auditoría: ${path.relative(process.cwd(), file)}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en la purga:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
