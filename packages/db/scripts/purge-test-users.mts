/**
 * purge-test-users — Limpieza controlada de usuarios bot/pruebas en producción (SCRUM-208).
 *
 * Elimina usuarios de prueba y sus dependencias en PostgreSQL respetando restricciones
 * de integridad referencial (ON DELETE RESTRICT), y purga sus identidades en Supabase Auth
 * vía Admin API.
 *
 * Uso:
 *   pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.mts             # dry-run
 *   pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.mts --execute   # ejecuta la purga
 */
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

import { prisma } from "../src/index.js";

const EXECUTE = process.argv.includes("--execute");

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

async function main() {
  console.log("=== Auditoría y Purga de Cuentas de Prueba (SCRUM-208) ===");

  // Buscar usuarios de prueba en la tabla usuario
  const allUsers = await prisma.usuario.findMany({
    select: { id: true, correo: true, nombre: true },
  });

  const testUsers = allUsers.filter((u) => {
    const c = u.correo.toLowerCase();
    return c.includes("test") || c.includes("bot") || c.includes("example") || c.includes("mock");
  });

  const testIds = testUsers.map((u) => u.id);
  const authUsers = await listSupabaseAuthUsers();

  const testAuthUsers: Array<{ email: string; id: string }> = [];
  for (const [email, id] of authUsers.entries()) {
    if (email.includes("test") || email.includes("bot") || email.includes("example") || email.includes("mock")) {
      testAuthUsers.push({ email, id });
    }
  }

  console.log(`- Usuarios de prueba detectados en PostgreSQL: ${testUsers.length}`);
  console.log(`- Identidades de prueba detectadas en Supabase Auth: ${testAuthUsers.length}`);

  if (testUsers.length > 0) {
    console.log("\nCorreos en PostgreSQL a purgar:");
    testUsers.forEach((u) => console.log(`  • ${u.correo} (${u.id})`));
  }

  if (!EXECUTE) {
    console.log("\n[dry-run] Ningún cambio realizado. Ejecuta con --execute para proceder.");
    return;
  }

  console.log("\nIniciando purga en PostgreSQL...");

  await prisma.$transaction(async (tx) => {
    // 1. Tokens de verificación
    const tokens = await tx.tokenVerificacion.deleteMany({
      where: { usuarioId: { in: testIds } },
    });
    console.log(`  ✔ Tokens de verificación eliminados: ${tokens.count}`);

    // 2. Desvincular referencias de empleados
    await tx.ticketQr.updateMany({
      where: { usadoPor: { in: testIds } },
      data: { usadoPor: null },
    });

    await tx.inscripcionTorneo.updateMany({
      where: { ticketUsadoPor: { in: testIds } },
      data: { ticketUsadoPor: null },
    });

    await tx.reserva.updateMany({
      where: { vendedorId: { in: testIds } },
      data: { vendedorId: null },
    });

    // 3. Auditoría y lecturas de acceso asociadas
    const tickets = await tx.ticketQr.findMany({
      where: { reserva: { titularId: { in: testIds } } },
      select: { id: true },
    });
    const ticketIds = tickets.map((t) => t.id);

    const lecturas = await tx.lecturaAcceso.deleteMany({
      where: {
        OR: [
          { empleadoId: { in: testIds } },
          { ticketId: { in: ticketIds } },
        ],
      },
    });
    console.log(`  ✔ Registros de lectura de acceso eliminados: ${lecturas.count}`);

    await tx.asignacionPuesto.deleteMany({
      where: { empleadoId: { in: testIds } },
    });

    const ticketsDel = await tx.ticketQr.deleteMany({
      where: { id: { in: ticketIds } },
    });
    console.log(`  ✔ Tickets QR eliminados: ${ticketsDel.count}`);

    // 4. Torneos e inscripciones
    await tx.inscripcionTorneo.deleteMany({
      where: { usuarioId: { in: testIds } },
    });

    await tx.torneoBloqueo.deleteMany({
      where: { torneo: { adminId: { in: testIds } } },
    });

    await tx.torneo.deleteMany({
      where: { adminId: { in: testIds } },
    });

    // 5. Reservas, pagos y membresías
    const reservas = await tx.reserva.deleteMany({
      where: { titularId: { in: testIds } },
    });
    console.log(`  ✔ Reservas eliminadas: ${reservas.count}`);

    const pagos = await tx.pago.deleteMany({
      where: { usuarioId: { in: testIds } },
    });
    console.log(`  ✔ Pagos eliminados: ${pagos.count}`);

    const membresias = await tx.membresia.deleteMany({
      where: { usuarioId: { in: testIds } },
    });
    console.log(`  ✔ Membresías eliminadas: ${membresias.count}`);

    await tx.inhabilitacionServicio.deleteMany({
      where: { adminId: { in: testIds } },
    });

    // 6. Eliminación de usuarios en tabla usuario
    const deletedUsers = await tx.usuario.deleteMany({
      where: { id: { in: testIds } },
    });
    console.log(`  ✔ Usuarios eliminados en PostgreSQL: ${deletedUsers.count}`);
  });

  // 7. Purga en Supabase Auth
  if (testAuthUsers.length > 0 && serviceKey) {
    console.log("\nPurgando identidades en Supabase Auth...");
    let authDeleted = 0;
    for (const authUser of testAuthUsers) {
      const ok = await deleteSupabaseAuthUser(authUser.id);
      if (ok) {
        authDeleted += 1;
        console.log(`  ✔ Supabase Auth identity borrada: ${authUser.email}`);
      } else {
        console.warn(`  ⚠️ Falló borrado en Supabase Auth para: ${authUser.email}`);
      }
    }
    console.log(`Total identidades eliminadas en Supabase Auth: ${authDeleted}`);
  }

  console.log("\n🚀 Purga de cuentas de prueba completada exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en la purga:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
