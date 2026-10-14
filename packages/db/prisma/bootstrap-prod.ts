import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { PeriodicidadPlan, EstadoUsuario } from "@prisma/client";
import { prisma } from "../src/client.js";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Iniciando bootstrap de producción (bootstrap:prod)...");

  // Criterio 1: Falla de manera segura si SEED_ADMIN_PASSWORD no está definida
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.trim() === "") {
    console.error("❌ ERROR CRÍTICO [SCRUM-209]: La variable de entorno SEED_ADMIN_PASSWORD es obligatoria y no está definida.");
    process.exit(1);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@sportcomplex.lat";

  // 1. Roles del sistema (Idempotente)
  const roles = ["ADMIN", "VENDEDOR", "LECTOR", "CLIENTE"];
  for (const nombreRol of roles) {
    await prisma.rol.upsert({
      where: { nombre: nombreRol },
      update: {},
      create: { nombre: nombreRol },
    });
  }
  console.log("✅ Roles del sistema verificados/creados: ADMIN, VENDEDOR, LECTOR, CLIENTE");

  // 2. Planes oficiales de membresía (Idempotente - Sin datos de juguete)
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
    } else {
      await prisma.planMembresia.update({
        where: { id: existing.id },
        data: { precio: plan.precio, descuentoPct: plan.descuentoPct, activo: plan.activo },
      });
    }
  }
  console.log("✅ Planes oficiales de membresía sincronizados (30% descuento)");

  // 3. Cuenta de Administrador Inicial de Producción (Idempotente)
  const rolAdmin = await prisma.rol.findUnique({ where: { nombre: "ADMIN" } });
  if (!rolAdmin) {
    throw new Error("Rol ADMIN no encontrado tras el upsert.");
  }

  const passwordHash = hashPassword(adminPassword);

  const existingAdmin = await prisma.usuario.findUnique({
    where: { correo: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.usuario.create({
      data: {
        nombre: "Administrador de Producción",
        correo: adminEmail,
        passwordHash,
        rolId: rolAdmin.id,
        estado: EstadoUsuario.ACTIVO,
      },
    });
    console.log(`✅ Cuenta de administrador inicial creada (${adminEmail})`);
  } else {
    // Actualizar contraseña si se proporciona el bootstrap
    await prisma.usuario.update({
      where: { correo: adminEmail },
      data: {
        passwordHash,
        estado: EstadoUsuario.ACTIVO,
        rolId: rolAdmin.id,
      },
    });
    console.log(`✅ Cuenta de administrador inicial actualizada (${adminEmail})`);
  }

  console.log("🚀 Bootstrap de producción completado con éxito (cero datos de prueba insertados).");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el bootstrap de producción:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
