import { PeriodicidadPlan } from "@prisma/client";
import { prisma } from "../src/client.js";

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
