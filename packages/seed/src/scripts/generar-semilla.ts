/**
 * Generador de script de siembra para Prisma desde catalogoSemilla (§2.2).
 */

import { catalogoSemilla } from "../catalogo/datos.js";

export function generarInstruccionesSeedPrisma(): string {
  const lineas = [
    "// Script generado automáticamente desde @sportcomplex/seed",
    "// Fuente única de IDs: mapaIdServicio (§1.6)",
  ];

  for (const item of catalogoSemilla) {
    lineas.push(`// ID ${item.idBd}: ${item.name} (${item.slug})`);
  }

  return lineas.join("\n");
}
