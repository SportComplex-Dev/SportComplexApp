import { mapaIdServicio, type SlugServicio } from "../catalogo/mapa-ids.js";
import { catalogoSemilla } from "../catalogo/datos.js";

export interface ResultadoValidacionSemilla {
  valido: boolean;
  errores: string[];
  totalServicios: number;
}

/**
 * Valida la consistencia bidireccional entre la semilla, los IDs relacionales y el mapa de catálogo para CI.
 * Garantiza que no haya discrepancias entre código, semilla y base de datos (§1.6).
 */
export function validarConsistenciaSemilla(): ResultadoValidacionSemilla {
  const errores: string[] = [];
  const slugsEsperados = Object.keys(mapaIdServicio) as SlugServicio[];
  const slugsEnSemilla = new Set(catalogoSemilla.map((s) => s.slug));
  const idsVistos = new Set<number>();

  for (const slug of slugsEsperados) {
    if (!slugsEnSemilla.has(slug)) {
      errores.push(`El slug '${slug}' está en mapaIdServicio pero falta en catalogoSemilla.`);
    }
  }

  for (const item of catalogoSemilla) {
    const meta = mapaIdServicio[item.slug];
    if (!meta) {
      errores.push(`El ítem con slug '${item.slug}' en catalogoSemilla no existe en mapaIdServicio.`);
      continue;
    }

    if (meta.idBd !== item.idBd) {
      errores.push(
        `Discrepancia de ID para '${item.slug}': mapaIdServicio tiene ${meta.idBd} pero catalogoSemilla tiene ${item.idBd}.`
      );
    }

    if (idsVistos.has(item.idBd)) {
      errores.push(`ID de BD duplicado en catalogoSemilla: ${item.idBd}`);
    }
    idsVistos.add(item.idBd);

    if (item.price < 0) {
      errores.push(`Tarifa negativa inválida en servicio '${item.slug}': ${item.price}`);
    }

    if (item.capacity <= 0) {
      errores.push(`Capacidad inválida <= 0 en servicio '${item.slug}': ${item.capacity}`);
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    totalServicios: catalogoSemilla.length,
  };
}
