// Lista servicios con su modalidad/capacidad y cupos ocupados en disponibilidades.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/.env.local") });
const { prisma } = await import("../src/index.js");

const servicios = await prisma.servicio.findMany({
  include: { franjasHorarias: true, disponibilidades: { select: { cuposOcupados: true, cuposTotales: true } } },
});
for (const s of servicios) {
  const maxOcup = Math.max(0, ...s.disponibilidades.map((d) => d.cuposOcupados));
  console.log({
    id: s.id, nombre: s.nombre, modalidad: s.modalidad, capacidad: s.capacidadMaxima,
    franjas: s.franjasHorarias.length, maxOcupados: maxOcup,
  });
}
await prisma.$disconnect();
