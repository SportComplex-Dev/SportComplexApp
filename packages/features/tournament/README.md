# Feature tournament (`packages/features/tournament`)

> Estado: vigente 2026-10-15

## Qué es

Torneos: 5 componentes, `tournamentAdmin`, types con `UserTournamentItem`. Inscripciones y bloqueos de canchas.

## Estructura / Exports

```
src/{components,services,types,utils}/
src/services/tournamentAdmin.ts
```

Deps: `ui`, `validation`. Exports: `.`, `./components`, `./services`, `./types`, `./utils`.

## Cómo usar

```tsx
import { tournamentAdmin } from "@sportcomplex/features-tournament/services";

await tournamentAdmin.inscribir({ torneoId, usuarioId });
```

## Límites (No hacer)

- No duplicar chrome en este paquete (`Modal`/`ActionButton` viven en `ui`).
- No validar inscripciones sin schema de `validation/business/tournament.schema.ts`.
- No bloquear franjas fuera de la TX de torneos (ver `db`).

## Testing

```bash
pnpm --filter @sportcomplex/features-tournament test
pnpm --filter @sportcomplex/features-tournament typecheck
```

36 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/torneos.md`
