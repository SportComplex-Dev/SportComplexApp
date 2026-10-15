# Dominio puro (`packages/domain`)

> Estado: vigente 2026-10-15

## Qué es

Capa 0: tipos y constantes del negocio sin lógica de infraestructura. Cero dependencias internas (`@{sportcomplex}/*`: prohibido) y cero deps externas salvo TypeScript.

## Estructura / Exports

```
src/{catalogo,reserva,membresia,usuario,precio,torneo,analitica,acceso}/index.ts
src/constantes.ts  # zonaHoraria, diasVentanaReserva, minutosTtlCheckout, horaApertura/Cierre
src/index.ts
```

Subpaths: `.`, `./catalogo`, `./reserva`, `./membresia`, `./usuario`, `./precio`, `./torneo`, `./analitica`, `./acceso`, `./constantes`.

## Cómo usar

```ts
import { TIMEZONE, BOOKING_WINDOW_DAYS } from "@sportcomplex/domain/constantes";
import type { Reserva } from "@sportcomplex/domain/reserva";
// TIMEZONE = "America/Bogota", ventana = 15 días
```

## Límites (No hacer)

- No importar nada de `@sportcomplex/*` ni `zod`/`date-fns`/`prisma` aquí.
- No poner seeds, IDs numéricos ni lógica con fechas/red (eso va en `seed`/`application`).
- No romper `verificar:limites`: el build falla si aparece una dep monorepo.

## Testing

```bash
pnpm --filter @sportcomplex/domain test
pnpm --filter @sportcomplex/domain typecheck
```

## Ref docs

- `docs/architecture/adrs/002-separacion-domain-seed.md` (aislamiento y flujo unidireccional), `docs/architecture/data-model.md`
