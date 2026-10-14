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

import { PeriodicidadPlan, EstadoTorneo, TipoCategoriaServicio } from "@prisma/client";
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
    const existingAdmin = await prisma.usuario.findUnique({
      where: { correo: adminEmail },
    });

    let passwordHash = existingAdmin?.passwordHash;
    if (!passwordHash) {
      try {
        const { hashSecret } = await import("@sportcomplex/core");
        passwordHash = await hashSecret(process.env.SEED_ADMIN_PASSWORD || "Admin123*");
      } catch {
        passwordHash = "$argon2id$v=19$m=19456,t=2,p=1$placeholder$seedhash";
      }
    }

    const adminUser = await prisma.usuario.upsert({
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

    // 4. Categorías de Servicio para Torneos (CUOTA-001)
    let catCanchas = await prisma.categoriaServicio.findFirst({
      where: { nombre: { contains: "Canchas", mode: "insensitive" } },
    });
    if (!catCanchas) {
      catCanchas = await prisma.categoriaServicio.create({
        data: {
          nombre: "Canchas",
          tipo: TipoCategoriaServicio.CANCHA,
        },
      });
      console.log(`Categoría Canchas creada: ${catCanchas.id}`);
    }

    let catPiscinas = await prisma.categoriaServicio.findFirst({
      where: { nombre: { contains: "Piscinas", mode: "insensitive" } },
    });
    if (!catPiscinas) {
      catPiscinas = await prisma.categoriaServicio.create({
        data: {
          nombre: "Piscinas",
          tipo: TipoCategoriaServicio.PISCINA,
        },
      });
      console.log(`Categoría Piscinas creada: ${catPiscinas.id}`);
    }

    // 5. Torneos Oficiales en INSCRIPCIONES_ABIERTAS
    const torneoPadel = await prisma.torneo.findFirst({
      where: { titulo: "Torneo Relámpago Nocturno de Pádel" },
    });

    if (!torneoPadel) {
      const padelService = await prisma.servicio.findFirst({
        where: { nombre: { contains: "Pádel", mode: "insensitive" } },
      });

      const catId = catCanchas.id;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      startDate.setHours(19, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(23, 0, 0, 0);

      const nuevoTorneoPadel = await prisma.torneo.create({
        data: {
          id: "071522c5-8967-4647-b934-fd2c3c821150",
          adminId: adminUser.id,
          categoriaId: catId,
          titulo: "Torneo Relámpago Nocturno de Pádel",
          descripcion: "Fase de grupos + eliminatorias directas. Incluye pelotas oficiales, hidratación, cóctel de premiación y premios de patrocinadores.",
          nivel: "Segunda & Tercera Categoría",
          fechaInicio: startDate,
          fechaFin: endDate,
          cuposTotales: 16,
          cuposOcupados: 4,
          precioInscripcion: 0.00,
          estado: EstadoTorneo.INSCRIPCIONES_ABIERTAS,
          bloqueos: padelService
            ? {
                create: [
                  {
                    servicioId: padelService.id,
                    horaInicio: startDate,
                    horaFin: endDate,
                  },
                ],
              }
            : undefined,
        },
      });
      console.log(`Torneo de Pádel creado: ${nuevoTorneoPadel.id}`);
    }

    const torneoTenis = await prisma.torneo.findFirst({
      where: { titulo: "Copa Primavera de Tenis Individual & Dobles" },
    });

    if (!torneoTenis) {
      const tenisService = await prisma.servicio.findFirst({
        where: { nombre: { contains: "Tenis", mode: "insensitive" } },
      });

      const catId = catCanchas.id;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 10);
      startDate.setHours(8, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(18, 0, 0, 0);

      const nuevoTorneoTenis = await prisma.torneo.create({
        data: {
          id: "9b4a4c0e-2fb7-4dc0-ab7d-d8132e65b8e4",
          adminId: adminUser.id,
          categoriaId: catId,
          titulo: "Copa Primavera de Tenis Individual & Dobles",
          descripcion: "Cuadro principal a 3 sets con super tie-break. Canchas centrales de arcilla con arbitraje profesional en finales. Kit de bienvenida conmemorativo.",
          nivel: "Intermedio / Avanzado",
          fechaInicio: startDate,
          fechaFin: endDate,
          cuposTotales: 12,
          cuposOcupados: 5,
          precioInscripcion: 0.00,
          estado: EstadoTorneo.INSCRIPCIONES_ABIERTAS,
          bloqueos: tenisService
            ? {
                create: [
                  {
                    servicioId: tenisService.id,
                    horaInicio: startDate,
                    horaFin: endDate,
                  },
                ],
              }
            : undefined,
        },
      });
      console.log(`Torneo de Tenis creado: ${nuevoTorneoTenis.id}`);
    }

    const torneoPiscina = await prisma.torneo.findFirst({
      where: { titulo: "Desafío Acuático 100m Estilo Libre & Relevos" },
    });

    if (!torneoPiscina) {
      const piscinaService = await prisma.servicio.findFirst({
        where: { nombre: { contains: "Piscina", mode: "insensitive" } },
      });

      const catId = catPiscinas.id;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      startDate.setHours(9, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(14, 0, 0, 0);

      const nuevoTorneoPiscina = await prisma.torneo.create({
        data: {
          id: "0b2123a0-31cb-47b2-85fc-0c6aa8c15f8e",
          adminId: adminUser.id,
          categoriaId: catId,
          titulo: "Desafío Acuático 100m Estilo Libre & Relevos",
          descripcion: "Competencia contrarreloj en piscina semiolímpica climatizada con cronometraje electrónico touch-pad. Categorías individual y relevos.",
          nivel: "Todos los niveles",
          fechaInicio: startDate,
          fechaFin: endDate,
          cuposTotales: 20,
          cuposOcupados: 8,
          precioInscripcion: 0.00,
          estado: EstadoTorneo.INSCRIPCIONES_ABIERTAS,
          bloqueos: piscinaService
            ? {
                create: [
                  {
                    servicioId: piscinaService.id,
                    horaInicio: startDate,
                    horaFin: endDate,
                  },
                ],
              }
            : undefined,
        },
      });
      console.log(`Torneo de Natación creado: ${nuevoTorneoPiscina.id}`);
    }
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
