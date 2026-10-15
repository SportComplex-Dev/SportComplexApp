# Decisiones de arquitectura (ADRs)

> Estado: vigente 2026-10-15

- [001-limites-paquetes.md](./001-limites-paquetes.md) — Límites estrictos de paquetes y exportaciones — sin imports a rutas internas, solo barrels públicos.
- [002-separacion-domain-seed.md](./002-separacion-domain-seed.md) — Separación dominio vs semilla — el núcleo puro no depende de datos de arranque.
- [003-cero-mock-en-produccion.md](./003-cero-mock-en-produccion.md) — Cero mock en producción — sin fallbacks silenciosos a datos simulados.
- [004-resolucion-sistema-dual-ids.md](./004-resolucion-sistema-dual-ids.md) — IDs duales (slugs vs numéricos) — resolución del sistema dual de identificadores.
- [005-localizacion-imagenes.md](./005-localizacion-imagenes.md) — Imágenes localizadas — catálogo sin dependencia de CDNs externos.
- [006-grafo-dependencias.md](./006-grafo-dependencias.md) — Grafo acíclico de dependencias — dirección y reglas entre capas.
- [007-mapeo-campos-compatibilidad.md](./007-mapeo-campos-compatibilidad.md) — Mapeo de campos contractuales — nomenclatura TS vs columnas SQL.
