# ADR 008: Migración de Assets Multimedia a Supabase Storage CDN

- **Título y Estado**: Aprobado (Fase F2 · HU-29)
- **Fecha y Autores**: 2026-10-18 · Célula Infra / SportComplex

## Contexto y Problema

El [ADR 005](./005-localizacion-imagenes.md) (2026-10-14) establecía una política estricta de **imágenes locales obligatorias** en `/public/images/catalogo/` con CSP `img-src 'self'`, prohibiendo dominios externos (Unsplash, etc.). Esta decisión se tomó para:

1. Resiliencia offline completa.
2. Seguridad CSP robusta (`img-src 'self'`).
3. Rendimiento predecible (WebP servido con `Cache-Control: immutable`).

Sin embargo, la evolución del producto (HU-29, RF-00, RNF-04) exige:

- **Entrega por CDN global** para latencia mínima en móviles (Medellín y visitantes internacionales).
- **Invalidación controlada** sin rebuild del frontend (assets inmutables con `max-age=31536000, immutable`).
- **Reducción de bundle/repo** (eliminar ~4.4 MB de WebP del repositorio).
- **Escalabilidad**: nuevos assets (hero, marca, eventos) sin tocar código ni repo.

La política de "todo local" del ADR 005 entra en conflicto directo con estos requisitos operativos.

## Decisión Arquitectónica

1. **Migración a Supabase Storage CDN** para todos los assets de catálogo (23 WebP).
   - Bucket público `sportcomplex-assets` (políticas RLS: `SELECT` público, escritura solo `service_role`).
   - `Cache-Control: public, max-age=31536000, immutable` en cada objeto.
   - URLs canónicas: `https://<ref>.supabase.co/storage/v1/object/public/sportcomplex-assets/catalogo/<slug>.webp`.

2. **Excepción controlada a CSP** (`img-src`):
   - Se añade el host **derivado de `NEXT_PUBLIC_SUPABASE_URL`** a `images.remotePatterns` en `next.config.ts` (y a `img-src` si se declara CSP). Sin refs de proyecto hardcodeadas.
   - **No** se relaja a `*` ni a dominios arbitrarios; solo el bucket oficial del proyecto.

3. **Helper centralizado** `getAssetUrl(path)` en `@sportcomplex/core/assets`:
   - Base **derivada** de `NEXT_PUBLIC_SUPABASE_URL` + bucket `sportcomplex-assets`: sin proyecto hardcodeado (ver *Actualización 2026-10-19*).
   - `NEXT_PUBLIC_ASSETS_BASE_URL` manda cuando está definida (override explícito, p. ej. un CDN externo).
   - Cada proyecto aprovisiona su propio bucket con `storage:setup`; el de producción es **espejo** del catálogo (mismos 23 objetos, mismo `eTag`).

4. **Limpieza de repo**: `apps/web/public/images/catalogo/**` eliminado (CA3 cumplido). Hero `.jpg`, `club-hero.png`, logos `.png/.svg` permanecen locales (fuera de alcance HU-29).

## Diagrama Mermaid

```mermaid
flowchart LR
    subgraph Dev["Desarrollo Local"]
        DevEnv["NEXT_PUBLIC_ASSETS_BASE_URL = undefined"]
        Helper["getAssetUrl(path)"]
        DevDerived["base derivada: NEXT_PUBLIC_SUPABASE_URL + bucket"]
    end

    subgraph Prod["Producción"]
        ProdEnv["NEXT_PUBLIC_ASSETS_BASE_URL = undefined"]
        SameHelper["getAssetUrl(path)"]
        ProdURL["Misma base derivada"]
    end

    subgraph Storage["Supabase Storage"]
        Bucket["sportcomplex-assets (público)"]
        Policy["RLS: SELECT anon/authenticated, WRITE service_role"]
        Cache["Cache-Control: public, max-age=31536000, immutable"]
    end

    DevEnv --> Helper
    Helper --> DevDerived
    ProdEnv --> SameHelper
    SameHelper --> ProdURL
    DevDerived --> Bucket
    ProdURL --> Bucket
    Bucket --> Policy
    Bucket --> Cache

    classDef dev fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef prod fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef storage fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
    class DevEnv,DevDerived,Helper dev;
    class ProdEnv,ProdURL,SameHelper prod;
    class Bucket,Policy,Cache storage;
```

## Consecuencias

### Positivas
- **Latencia global baja**: CDN de Supabase (edge global) vs. origen único.
- **Cero 404 en dev**: la base se deriva de `NEXT_PUBLIC_SUPABASE_URL`, así que cada entorno lee del bucket de **su** proyecto (sin apuntar al CDN ajeno).
- **Invalidez controlada**: nombres inmutables → nueva versión = nuevo nombre (hash).
- **Repo ligero**: -4.4 MB binarios; build más rápido, clon más ligero.
- **Escalabilidad**: nuevos assets (hero, eventos, marca) suben a Storage sin tocar código.

### Compromisos
- **CSP `img-src` ampliado**: se añade el host derivado de `NEXT_PUBLIC_SUPABASE_URL` (excepción documentada y acotada, sin literal de proyecto).
- **Dependencia externa**: disponibilidad del CDN de Supabase (SLA 99.9%).
- **Hero/logo locales**: `club-hero.png`, heroes `.jpg`, logos `.png/.svg` permanecen en `public/` (fuera de HU-29).

## Actualización 2026-10-19 — sin refs de proyecto hardcodeadas

El fallback fijo `DEFAULT_ASSETS_CDN` (URL del proyecto de producción escrito en
código) se elimina. Ahora:

- `packages/domain/src/assets.ts` (fuente; `packages/core/src/assets.ts` re-exporta)
  construye la base como `NEXT_PUBLIC_SUPABASE_URL` +
  `/storage/v1/object/public/sportcomplex-assets`, con
  `NEXT_PUBLIC_ASSETS_BASE_URL` como override explícito.
- `apps/web/next.config.ts` deriva `images.remotePatterns[].hostname` de
  `NEXT_PUBLIC_SUPABASE_URL` (`new URL(...).hostname`), sin literal.
- El bucket se aprovisiona **por proyecto** (`storage:setup`). El de producción se
  replicó como espejo del catálogo: 23 objetos, paridad verificada por
  `nombre + size + eTag` y lectura anónima `200`.

Consecuencia: cambiar de proyecto Supabase o clonar el bucket es una operación de
entorno (variables + `storage:setup`), no de código.

## Validación y Guardrails

- **Script `storage:setup --verify`**: healthcheck anónimo + `Cache-Control` verificado.
- **Script `assets:upload --verify`**: subida 23 WebP + verificación HEAD anónima.
- **Build gate**: `pnpm build` verifica `next.config.ts` `remotePatterns` + sin 404 en páginas estáticas.
- **Lint de límites**: `pnpm verificar:limites` (sin imports internos en helpers).

## Referencias

- HU-29 · RF-00 · RNF-04 · RN-13
- TSK-OPS-02 (SCRUM-179) · TSK-FE-29b (SCRUM-180) · TSK-FE-30b (SCRUM-181)
- [ADR 005](./005-localizacion-imagenes.md) (supersedido parcialmente)
- `docs/features/assets-multimedia.md` (implementación)
- `docs/infra/storage.md` (bucket, políticas, scripts)
- `packages/domain/src/assets.ts` (helper centralizado; `packages/core/src/assets.ts` re-exporta)
- `packages/db/scripts/setup-storage-assets.mts` / `upload-assets-storage.mts`