import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../apps/web/.env.local"));
  } catch {}
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../apps/web/.env"));
  } catch {}
}

import { PeriodicidadPlan } from "@prisma/client";
import { prisma } from "../src/client";

async function main() {
  console.log("Iniciando seed de base de datos...");

  // 1. Roles
  const roles = ["ADMIN", "VENDEDOR", "LECTOR", "CLIENTE"];
  for (const nombreRol of roles) {
    await prisma.rol.upsert({
      where: { nombre: nombreRol },
      update: {},
      create: { nombre: nombreRol },
    });
  }
  console.log("Roles sembrados con éxito: ADMIN, VENDEDOR, LECTOR, CLIENTE");

  // 2. Planes de Membresía (descuento_pct = 30)
  const planes = [
    {
      nombre: "Plan Semanal Básico",
      periodicidad: PeriodicidadPlan.SEMANAL,
      precio: 50.00,
      descuentoPct: 30.00,
      activo: true,
    },
    {
      nombre: "Plan Mensual Estándar",
      periodicidad: PeriodicidadPlan.MENSUAL,
      precio: 180.00,
      descuentoPct: 30.00,
      activo: true,
    },
    {
      nombre: "Plan Anual Premium",
      periodicidad: PeriodicidadPlan.ANUAL,
      precio: 1800.00,
      descuentoPct: 30.00,
      activo: true,
    },
  ];

  for (const plan of planes) {
    const existing = await prisma.planMembresia.findFirst({
      where: { nombre: plan.nombre },
    });

    if (!existing) {
      await prisma.planMembresia.create({
        data: plan,
      });
    }
  }
  console.log("Planes de membresía sembrados con éxito con descuento_pct = 30%");

  // 3. Usuario Administrador de pruebas
  const adminRole = await prisma.rol.findUnique({
    where: { nombre: "ADMIN" },
  });

  if (adminRole) {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@sportcomplex.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123*";

    // Hash Argon2id con parámetros estándar (compatible con verifySecret de @sportcomplex/core)
    const { hash } = await import("@node-rs/argon2");
    const passwordHash = await hash(adminPassword, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.usuario.upsert({
      where: { correo: adminEmail },
      update: {
        nombre: "Administrador SportComplex",
        rolId: adminRole.id,
        estado: "ACTIVO",
        passwordHash,
        deletedAt: null,
      },
      create: {
        correo: adminEmail,
        nombre: "Administrador SportComplex",
        rolId: adminRole.id,
        estado: "ACTIVO",
        passwordHash,
      },
    });

    console.log(`Usuario administrador creado/actualizado con éxito: ${adminEmail}`);
  }

  console.log("Seed completado correctamente.");
}

main()
  .catch((e) => {
    console.error("Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
