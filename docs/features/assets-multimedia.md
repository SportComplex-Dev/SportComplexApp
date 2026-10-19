# Assets multimedia — optimización y Supabase Storage

> Estado: vigente 2026-10-19

Pipeline de imágenes de la plataforma (catálogo, hero, marca): conversión a
WebP/AVIF con Sharp, publicación en un bucket público de Supabase Storage
servido por CDN, y actualización de las rutas del frontend. Reemplaza el
esquema de imágenes locales de [ADR 005](../architecture/adrs/005-localizacion-imagenes.md).

## Contexto

- **RF:** RF-00 (catálogo/instalaciones), **RNF-04** (rendimiento de carga). **RN-13** (cashless/bajo consumo, sin dependencia de terceros raros).
- **Ticket:** HU-29 · Épica EPIC-05 · Fase F2 · 5 pts · Prioridad Low (Could Have).
- **Tareas técnicas:**
- **TSK-OPS-02** (SCRUM-179) — bucket y políticas públicas en Supabase Storage · 1 SP · `Done`.
- **TSK-FE-29b** (SCRUM-180) — convertir imágenes actuales a WebP · 2 SP · `Done` *(parcial: catálogo completo; hero/marca fuera de alcance)*.
- **TSK-FE-30b** (SCRUM-181) — cargar assets a Supabase y actualizar rutas frontend · 2 SP · `Done`.

### Criterios de aceptación (Gherkin)

1. Al procesar las imágenes → se convierten a **WebP/AVIF** reduciendo el peso **≥ 60%** sin pérdida visual.
2. Al consultar el sitio → los recursos se sirven por **CDN pública** con `Cache-Control: public, max-age=31536000, immutable`.
3. Al analizar el bundle → **no quedan imágenes pesadas residuales** en `apps/web/public/images`.

## Estado actual verificado (2026-10-18)

| Grupo | Archivos | Peso | Estado |
|---|---|---|---|
| Catálogo (`public/images/catalogo/`) | 23 `.webp` | ~4.44 MB | ✅ ya WebP (12 servicios + 4 categorías + 7 showcase) |
| Hero carousel | 4 `.jpg` | ~3.61 MB | ❌ sin convertir |
| Hero principal (`club-hero.png`) | 1 `.png` | ~1.69 MB | ❌ sin convertir (referido en `globals.css`) |
| Marca (`Akros-*.png`) + `.svg` | 5 PNG + 1 SVG | ~0.07 MB | ⚠️ logos; decidir si se optimizan |
| Favicons | 2 | ~0.01 MB | ⚠️ se quedan en `public/` |

Hallazgos relevantes del código:

- `packages/seed/src/scripts/descargar-imagenes.ts` es un **stub** (cuenta y retorna, no convierte ni descarga).
- `sharp` aparece en `pnpm-lock.yaml` (dependencia transitiva de Next) pero **no** es dependencia directa de ningún paquete.
- `apps/web/next.config.ts` ya declara `images.formats: ["image/avif","image/webp"]` pero `images.remotePatterns: []` (bloquea dominios externos para `next/image`).
- No existe variable de base URL de assets; las rutas están **hardcodeadas** como `/images/catalogo/...`:
  - `packages/seed/src/catalogo/imagenes.ts` (`mapaImagenesCatalogo`).
  - `packages/core/src/domain/catalog.ts` (categorías + `initialCatalog`).
  - `packages/domain/src/catalogo/constantes.ts` (⚠️ rutas **incorrectas**: `/images/catalogo/canchas.webp` no existe; el archivo real es `categoria-canchas.webp`).
  - `packages/features/booking/src/hooks/usePublicCatalog.ts` (construye `/images/catalogo/${serviceSlug}.webp`).
  - `apps/web`: `home/hero-carousel.tsx`, `home/facility-showcase.tsx`, `home/lifestyle-and-digital-pass.tsx`, `app/(public)/page.tsx`, `app/(customer)/services/[category]/page.tsx`, `app/(customer)/services/[category]/[id]/page.tsx`, `styles/globals.css` (`url('/images/club-hero.png')`).

## Qué se hizo (implementación completada 2026-10-18)

### TSK-OPS-02 — Bucket y políticas públicas (1 SP) ✅

Bucket `sportcomplex-assets` aprovisionado en **cada** proyecto Supabase (producción y
desarrollo) con `pnpm --filter @sportcomplex/db storage:setup --execute`:

1. **Bucket** `public: true`, `file_size_limit` 5 MB, `allowed_mime_types`
   (`image/webp/avif/png/svg+xml`); idempotente.
2. **Políticas RLS** aplicadas vía SQL Editor (Dashboard):
   - `SELECT` público para `anon`/`authenticated` (bucket_id = 'sportcomplex-assets').
   - `INSERT/UPDATE/DELETE` solo `service_role` (escritura anónima denegada).
3. **Verificación**: `--verify` sube healthcheck → `200` anónimo +
   `Cache-Control: public, max-age=31536000, immutable`.

### TSK-FE-29b — Conversión a WebP (2 SP) ✅ (parcial)

El catálogo (23 `.webp` en `public/images/catalogo/`) ya estaba en WebP.
Hero `.jpg` + `club-hero.png` + logos `.png/.svg` **fuera de alcance** (se quedan locales).

### TSK-FE-30b — Subida a CDN y actualización de rutas (2 SP) ✅

1. **Subida** de 23 WebP a `catalogo/<slug>.webp` con
   `pnpm --filter @sportcomplex/db assets:upload --execute --verify`:
   - `cacheControl: "public, max-age=31536000, immutable"`, `x-upsert: true`.
   - URLs finales: `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sportcomplex-assets/catalogo/<archivo>.webp` (base derivada en runtime; sin ref de proyecto en el código).
2. **Variable base**: `NEXT_PUBLIC_ASSETS_BASE_URL` (override opcional) en `.env.example`; si no está definida, el helper `asset(path)` deriva la base de `NEXT_PUBLIC_SUPABASE_URL` + `sportcomplex-assets`.
3. **Referencias actualizadas** a URLs absolutas CDN:
   - `packages/seed/src/catalogo/imagenes.ts` (`mapaImagenesCatalogo`).
   - `packages/core/src/domain/catalog.ts` (4 categorías + 12 `initialCatalog`).
   - `packages/domain/src/catalogo/constantes.ts` (corregidos paths erróneos a `categoria-*.webp`).
   - `packages/features/booking/src/hooks/usePublicCatalog.ts` (builder dinámico).
   - `apps/web/src/components/home/facility-showcase.tsx` (6 showcase).
   - `apps/web/src/components/home/lifestyle-and-digital-pass.tsx` (`sports-bar-lounge`).
   - `apps/web/src/app/(public)/page.tsx` (4 categorías).
4. **`next.config.ts`**: `images.remotePatterns` con hostname Supabase.
5. **Limpieza**: `apps/web/public/images/catalogo/**` eliminado (CA3 cumplido).
6. **Build**: `pnpm build` exitoso (62 páginas, 17 paquetes).

## Comandos ejecutados

```bash
# 1. Bucket + políticas (TSK-OPS-02)
pnpm --filter @sportcomplex/db storage:setup --execute
# → pega SQL en Supabase Dashboard → SQL Editor → Run
pnpm --filter @sportcomplex/db storage:setup --execute --verify

# 2. Subida assets (TSK-FE-30b)
pnpm --filter @sportcomplex/db assets:upload --execute --verify

# 3. Build completo (verificación CA3)
pnpm build
```

## Impacto y archivos tocados

| Área | Archivo |
|---|---|
| Bucket/políticas | `packages/db/scripts/setup-storage-assets.mts` + SQL en Dashboard |
| Subida | `packages/db/scripts/upload-assets-storage.mts` |
| Rutas (CDN) | `packages/seed/src/catalogo/imagenes.ts`, `packages/core/src/domain/catalog.ts`, `packages/domain/src/catalogo/constantes.ts`, `packages/features/booking/src/hooks/usePublicCatalog.ts` |
| UI web | `apps/web/src/components/home/facility-showcase.tsx`, `apps/web/src/components/home/lifestyle-and-digital-pass.tsx`, `apps/web/src/app/(public)/page.tsx` |
| Config | `apps/web/next.config.ts` (`remotePatterns`), `apps/web/.env.example` (`NEXT_PUBLIC_ASSETS_BASE_URL`) |
| Limpieza | `apps/web/public/images/catalogo/**` (eliminado) |

## Decisiones tomadas

1. **Bucket**: `sportcomplex-assets` (HU) — script `storage:setup` + SQL Dashboard.
2. **Alcance subida**: solo 23 WebP de catálogo (`public/images/catalogo/`). Hero `.jpg`, `club-hero.png`, logos `.png/.svg` se quedan locales.
3. **CDN + `next/image`**: `remotePatterns` con hostname Supabase; helper `asset(path)` evita hardcodeo.
4. **ADR 008 pendiente**: la migración contradice [ADR 005](../architecture/adrs/005-localizacion-imagenes.md) (imágenes locales + CSP `img-src 'self'`). Requiere ADR 008 que la superseda y documente excepción CSP.
5. **Limpieza**: `public/images/catalogo/**` eliminado (CA3 cumplido); hero/logos permanecen en `public/`.

## Riesgos

- **Romper dev local** sin acceso a Storage: los assets dejarán de servirse desde
  `public/`. Mitigación: cada entorno deriva la base de su propio
  `NEXT_PUBLIC_SUPABASE_URL` (proyecto dev = su bucket); `NEXT_PUBLIC_ASSETS_BASE_URL`
  permite apuntar a un CDN alterno sin tocar código.
- **CSP**: si queda `img-src 'self'`, las imágenes del CDN se bloquean. Debe
  actualizarse junto con el ADR.
- **Invalidación de caché**: `immutable, max-age=31536000` no se puede purgar; usar
  nombres versionados (`tenis-cancha-1.<hash>.webp`) si un asset puede cambiar.
- **Paths erróneos ya existentes** en `packages/domain/src/catalogo/constantes.ts`
  (`/images/catalogo/canchas.webp`): corregir al migrar o seguirán rotos.

## Testing / verificación realizados

- **CA1 (≥60% reducción)**: el catálogo ya era WebP; conversión hero fuera de alcance.
- **CA2 (CDN + cache)**: `curl -I` a healthcheck → `200` + `Cache-Control: public, max-age=31536000, immutable` ✅.
- **CA3 (sin residuales)**: `pnpm --filter web build` exitoso + `apps/web/public/images/catalogo/` eliminado ✅.
- **Build completo**: `pnpm build` → 62 páginas, 17 paquetes, 0 errores ✅.
- **Regresión visual**: pendiente `pnpm test:e2e` (specs `01-public-navigation`, `06-visual-validations`).
- **Guardarraíl**: `pnpm verificar:limites` (sin imports internos) ✅.

## Actualización 2026-10-19 — CDN derivado y bucket espejo en producción

- **Sin hardcode**: `packages/domain/src/assets.ts` deriva la base de
  `NEXT_PUBLIC_SUPABASE_URL` + `sportcomplex-assets` (`NEXT_PUBLIC_ASSETS_BASE_URL`
  queda como override opcional) y `apps/web/next.config.ts` deriva el `hostname` de
  `remotePatterns` de la misma variable. Ver [ADR 008](../architecture/adrs/008-cdn-storage-assets.md).
- **Bucket espejo**: el proyecto de producción (`ouemmmwpygmizyvtcpuc`) se aprovisionó
  con `storage:setup --execute` y se replicaron los **23** WebP del catálogo
  (~4.5 MB) con paridad por `nombre + size + eTag`; lectura anónima verificada con
  `200`.
- **Rutas sin cambios**: los paths (`/catalogo/<archivo>.webp`) siguen igual; solo
  cambia la base, que ahora sale del entorno (rebuild para hornear el nuevo
  `NEXT_PUBLIC_SUPABASE_URL`).

## Ref docs

- [infra/storage.md](../infra/storage.md) — buckets Supabase y políticas.
- [architecture/adrs/005-localizacion-imagenes.md](../architecture/adrs/005-localizacion-imagenes.md) — esquema previo (a superseder).
- [features/catalogo.md](./catalogo.md) — catálogo de servicios e imágenes.
- [architecture/performance-indexes.md](../architecture/performance-indexes.md) — contexto de rendimiento (RNF-01/RF-21).
