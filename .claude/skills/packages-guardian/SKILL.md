---
name: packages-guardian
description: Blindaje de límites de paquetes, imports canónicos @sportcomplex/X, DAG domain-validation-application-db, builds y gates verificar:limites. Usa esta skill cuando crees imports, paquetes, exports o builds en el monorepo.
---

# packages-guardian

> Estado: vigente 2026-10-15

Guardián de fronteras del monorepo: imports, DAG, strictness y build 16/16.

## Triggers

- Nuevo import cruzado, nuevo `packages/*` o export map.
- PR que toca `tsconfig`, `package.json` de workspace o barrels.
- Fallo en `verificar:limites`, `turbo build`, `madge` o typecheck/test.
- Sospecha de ciclo, `any` nuevo o strictness debilitado.

## Reglas oro

1. Import canónico: `@sportcomplex/X` **nunca** `/src` ni `apps/web/src`. Web usa paths a `dist` de un solo elemento.
2. `domain`: **0 deps** internas y externas (solo tipos). `seed → domain` permitido; inverso prohibido.
3. `validation`: **zod-only** (Zod 4, sin `zod/v3`, Yup ni `any` para saltar schemas).
4. Cada paquete con `rootDir: src`, exports → `dist`, `sideEffects: false` donde aplique.
5. Layout plano: `src/<categoria>/Foo.ts(x)` + `Foo.test` co-locado + barrel; prohibido `X/X.tsx`, `__tests__/`, puentes `export * from "./X/index"`.
6. Nunca debilitar strictness global (`noImplicitAny: false`, `: any` en handlers) para callar worktrees.
7. DAG respetado: `ui` ← `shared` ← `booking` ← `pos`; `tournament` ← `portal` (+`booking`).

## Verificación (comandos exactos)

```bash
pnpm verificar:limites
pnpm build
pnpm typecheck
pnpm test
npx madge --circular packages/*/src/index.ts apps/web/src/proxy.ts
pnpm --filter @sportcomplex/domain test && pnpm --filter @sportcomplex/validation test
```

Gate esperado: build 16/16, typecheck exit 0, 0 infracciones, 0 fail. En worktrees con `node_modules` por junction el typecheck web no es válido (faltan tipos Prisma): verificar en checkout principal post-merge.

## Anti-patrones

- `import x from "../../packages/ui/src/Button"` o desde `apps/web/src`.
- `mocks`/`catalogoInicial` en producción; imágenes `unsplash`/remotas sin localizar.
- `export * from "./X/index"` puente; carpeta de un solo archivo `X/X.tsx`.
- `paths: [src, dist]` en web (Next 16 exige un solo `dist`).
- Tests en `__tests__/` o corridos desde la raíz (features se corren desde su dir; web desde `apps/web`).
- `token` (Argon2id) importado del barrel `core` en web (usar `@sportcomplex/security`).

## Ejemplos

```ts
// Bien
import { Button } from "@sportcomplex/ui";
import { ok, fail } from "@sportcomplex/shared/lib";
// Mal
import { Button } from "../../packages/ui/src/components/forms/Button";
import { x } from "../../../apps/web/src/lib/x";
```

```bash
grep -rn "apps/web/src" packages/features --include="*.ts" --include="*.tsx" | head -20
grep -rn ": any" packages/*/src apps/web/src --include="*.ts" | head -20
```

## Checklist PR

- [ ] `pnpm verificar:limites` 0 infracciones.
- [ ] `pnpm build` 16/16 y `pnpm typecheck` limpio.
- [ ] `madge --circular` sin ciclos.
- [ ] Imports solo `@sportcomplex/*`; `domain` sin deps monorepo.
- [ ] Tests co-locados verdes (`turbo run test`).
- [ ] Sin `: any` nuevo ni strictness debilitado.
- [ ] Exports apuntan a `dist`, `rootDir: src` presente.

## Ref docs

- `docs/architecture/packages-features.md`, `docs/architecture/adrs/001-limites-paquetes.md`, `docs/architecture/adrs/002-separacion-domain-seed.md`, `docs/architecture/adrs/006-grafo-dependencias.md`
- `scripts/verificar-limites.ts` (reglas implementadas), `turbo.json` (pipeline build)
