# Casos de uso (`packages/application`)

> Estado: vigente 2026-10-15

## Qué es

Orquesta reglas de negocio puras: combina `domain` + `validation` + fechas (`date-fns-tz`) sin tocar BD ni red. Lógica de disponibilidad, reservas, precios, piscinas, membresías, torneos y control de acceso.

## Estructura / Exports

```
src/{reserva,disponibilidad,precio,politica-piscina,membresia,torneo,control-acceso}/index.ts
src/index.ts  # barrel raíz
```

Exports por subpath (`precio`, `disponibilidad`, `control-acceso`, `politica-piscina`, `reserva`, `membresia`, `torneo`). `rootDir: src`, salida `dist/`.

## Cómo usar

```ts
import { generarFranjasOperativas } from "@sportcomplex/application/disponibilidad";
import { calcularPrecio } from "@sportcomplex/application/precio";

const franjas = generarFranjasOperativas(new Date(), 6, 22);
```

## Límites (No hacer)

- No importar `@sportcomplex/db`, `@sportcomplex/core`, `apps/web` ni fetch/Stripe.
- No poner SQL, `Response.json` ni `now = new Date()` oculto (recibir `now` por parámetro).
- No duplicar constantes de `domain` (zona horaria, ventana 15 días).

## Testing

```bash
pnpm --filter @sportcomplex/application test
pnpm --filter @sportcomplex/application typecheck
```

## Ref docs

- `docs/architecture/architecture.md` (capas), `docs/features/reservas.md`, `docs/features/piscinas.md`
