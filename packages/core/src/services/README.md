# Servicios core (`packages/core/src/services`)

> Estado: vigente 2026-10-15

## Qué es

Reglas puras del negocio: `pricing` (tarifas + 30% membresía), `availability` (franjas 06:00–22:00), `pool-policy` (aforo/exclusividad), `access-control` (vigencia de franja). `now` siempre inyectable.

## Estructura / Exports

```
services/{pricing,availability,pool-policy,access-control}.ts (+ *.test.ts co-locado)
```

## Cómo usar

```ts
import { calcularPrecio } from "@sportcomplex/core/services/pricing";
import { franjaVigente } from "@sportcomplex/core/services/access-control";

calcularPrecio({ base: 80000, esMiembro: true }, new Date());
```

Todas las fechas en `America/Bogota`; nunca `new Date()` oculto en la regla.

## Límites (No hacer)

- No hacer fetch/SQL/Stripe aquí; no usar `Response`.
- No fijar slots hardcodeados (derivar de `domain` 06–22).
- No crear `Date` sin zona (usar `date-fns-tz` + `TIMEZONE`).

## Testing

```bash
pnpm --filter @sportcomplex/core test
```

77 tests.

## Ref docs

- `packages/core/README.md`, `docs/features/reservas.md`, `docs/features/piscinas.md`
