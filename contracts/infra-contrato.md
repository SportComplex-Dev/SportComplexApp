# Contrato Infra — v1 (Phase 0)

## Base
`origin/develop@f961ee1`.

## Entregables
1. `scripts/verificar-limites.ts` + task turbo `verificar:limites` obligatoria CI (§5.1 tabla 5 reglas: subpath `/src/`, mock prod, unsplash, `any` prod, circulares `domain`).
2. TS estricto `config/typescript/base.json`: `noImplicitAny, strictNullChecks, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noUnusedLocals, noUnusedParameters`. Corregir 12+ `any` prod (repos `disponibilidad`, mappers, `portal-utils`).
3. Enforcement `hotfix/* → main` job en `ci.yml` (§5.3).
4. `@sportcomplex/config` real: `eslint/{base,nextjs,react,node}, typescript/{base,nextjs,node}, prettier, tailwind/preset`.
5. `exports` + `dist/` + `apps/web/tsconfig paths → ../../packages/*/dist` + `turbo build.dependsOn ^build` (§2.8).
6. ADRs en su propia carpeta `docs/architecture/adrs/`: `001-limites-paquetes, 002-separacion-domain-seed, 003-cero-mock-en-produccion, 004-resolucion-dual-ids, 005-localizacion-imagenes, 006-grafo-dependencias`.
7. `db/test/mock-prisma.ts 1755` → `db/test/mocks/{fabricas/*,escenarios/*,estado,utilidades}` (coordina con cell-db para no chocar).

## Verificación
`pnpm verificar:limites` verde, `pnpm build` artefactos en todos packages, 0 `any` prod, 6 ADRs. No escribe fuera de `scripts/**, .github/**, packages/config/**, docs/architecture/**, turbo.json, package.json`.
