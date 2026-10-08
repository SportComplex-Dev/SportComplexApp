// Asegura franjas horarias para un servicio AFORO y genera su disponibilidad
// de 15 días (para probar el flujo TSK-BE-09 con cupos).
// Uso: pnpm --filter @sportcomplex/db exec tsx scripts/db-seed-availability.mts
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/.env.local") });
const { prisma, generateDisponibilidadesForServicio, parseTimeToDate } = await import("../src/index.js");

const servicio = await prisma.servicio.findFirst({
  where: { estado: "ACTIVO", modalidad: "AFORO" },
  include: { franjasHorarias: true },
});
if (!servicio) {
  console.log("No hay servicio ACTIVO en modalidad AFORO; crea uno primero.");
  process.exit(1);
}

if (servicio.franjasHorarias.length === 0) {
  console.log(`Creando franjas 08:00-09:00 (todos los días) para "${servicio.nombre}"...`);
  await prisma.franjaHoraria.createMany({
    data: [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
      servicioId: servicio.id,
      diaSemana,
      horaInicio: parseTimeToDate("08:00"),
      horaFin: parseTimeToDate("09:00"),
    })),
  });
}

console.log(`Generando disponibilidad 15 días para "${servicio.nombre}"...`);
await generateDisponibilidadesForServicio(servicio.id, 15);
const count = await prisma.disponibilidad.count({ where: { servicioId: servicio.id } });
console.log(`Disponibilidades del servicio: ${count}`);
await prisma.$disconnect();
