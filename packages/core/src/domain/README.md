# Dominio core (`packages/core/src/domain`)

> Estado: vigente 2026-10-15

## Qué es

Entidades y catálogo en memoria del núcleo (`catalog.ts`, `analytics.ts`). Base que usan `services/` sin tocar BD.

## Estructura / Exports

```
domain/{catalog,analytics}.ts + index.ts
```

Re-exportado desde `@sportcomplex/core` raíz.

## Cómo usar

```ts
import { catalogoServicios } from "@sportcomplex/core/domain/catalog";
```

## Límites (No hacer)

- No importar `db`/`seed` ni hacer I/O aquí.
- No duplicar tipos de `@sportcomplex/domain` (usar esos).

## Testing

```bash
pnpm --filter @sportcomplex/core test
```

## Ref docs

- `packages/core/README.md`, `packages/domain/README.md`
