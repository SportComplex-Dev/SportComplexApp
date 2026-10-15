# Semilla de catálogo (`packages/seed`)

> Estado: vigente 2026-10-15

## Qué es

Fuente única autoritativa de IDs y datos iniciales del catálogo. Depende solo de `domain` (flujo unidireccional según ADR-002). Nada de reglas de negocio aquí.

## Estructura / Exports

```
src/catalogo/{datos,imagenes,mapa-ids}.ts  # mapaIdServicio, obtenerIdBd, obtenerSlug
src/sincronizar/  # sync hacia BD
src/scripts/{generar-semilla,descargar-imagenes}.ts
src/index.ts
```

Subpaths: `.`, `./catalogo`, `./sincronizar`.

## Cómo usar

```ts
import { mapaIdServicio, obtenerIdBd, obtenerSlug } from "@sportcomplex/seed/catalogo";

const id = obtenerIdBd("futbol-5-cancha-1"); // 1
const slug = obtenerSlug(1); // "futbol-5-cancha-1"
```

Mapa slug↔id (12 servicios): `futbol-5-cancha-{1,2}`, `piscina-*`, `gimnasio-*`, `zona-humeda-*`, `tenis-*`, `padel-*`. Ver `src/catalogo/mapa-ids.ts`.

## Límites (No hacer)

- No importar `seed` desde `domain` (prohibido por ADR-002).
- No usar `catalogoInicial`/mocks en producción; no hardcodear IDs fuera del mapa.
- No poner imágenes remotas sin localizar (ver ADR-005).

## Testing

```bash
pnpm --filter @sportcomplex/seed test
pnpm --filter @sportcomplex/seed typecheck
```

## Ref docs

- `docs/architecture/adrs/002-separacion-domain-seed.md`, `docs/architecture/adrs/004-resolucion-sistema-dual-ids.md`, `docs/product/seed-dataset.md`
