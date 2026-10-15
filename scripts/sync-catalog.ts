#!/usr/bin/env tsx
/**
 * Sincroniza catálogo semilla -> BD (CI / entornos frescos).
 * Usa @sportcomplex/seed + @sportcomplex/db para poblar servicios con tarifa > 0 y estado ACTIVO.
 */
import { crearClientePrisma } from "@sportcomplex/db";
import { catalogoSemilla, mapaIdServicio } from "@sportcomplex/seed/catalogo";
import { traducirSemillaARegistroDb } from "@sportcomplex/seed/sincronizar";
import { getCategorias } from "@sportcomplex/db";

const prisma = crearClientePrisma();

async function main() {
  console.log("🌱 Sincronizando catálogo semilla -> BD...");

  // 1. Asegurar categorías
  const categorias = await getCategorias();
  const catByNombre = new Map(categorias.map((c) => [c.nombre, c.id]));

  const catCanchasId = catByNombre.get("Canchas");
  const catPiscinasId = catByNombre.get("Piscinas");
  const catGimnasioId = catByNombre.get("Gimnasio");
  const catZonaHumedaId = catByNombre.get("Zona húmeda");

  if (!catCanchasId || !catPiscinasId || !catGimnasioId || !catZonaHumedaId) {
    throw new Error("Categorías base no encontradas. Ejecutar seed base primero.");
  }

  const catIdBySlug: Record<string, number> = {
    canchas: catCanchasId,
    piscinas: catPiscinasId,
    gimnasio: catGimnasioId,
    "zona-humeda": catZonaHumedaId,
  };

  // 2. Sincronizar cada servicio semilla
  let creados = 0;
  let actualizados = 0;

  for (const item of catalogoSemilla) {
    const catId = catIdBySlug[item.category];
    if (!catId) {
      console.warn(`⚠️  Categoría desconocida para ${item.slug}: ${item.category}`);
      continue;
    }

    const registro = traducirSemillaARegistroDb(item, catId);

    await prisma.servicio.upsert({
      where: { id: registro.id },
      update: {
        nombre: registro.nombre,
        categoriaId: registro.categoriaId,
        capacidadMaxima: registro.capacidadMaxima,
        tarifa: registro.tarifa,
        modalidad: registro.modalidad,
        tipoPiscina: registro.tipoPiscina,
        estado: registro.estado,
      },
      create: registro,
    });

    if (registro.tarifa > 0) {
      console.log(`✅ ${registro.nombre}: $${registro.tarifa} (${registro.modalidad})`);
    }

    // No podemos saber fácilmente si fue creado/actualizado sin query extra
    // Contamos todos como procesados
  }

  console.log(`🌱 Catálogo sincronizado: ${catalogoSemilla.length} servicios procesados.`);
}

main()
  .catch((e) => {
    console.error("❌ Error sincronizando catálogo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });