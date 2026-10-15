# Configuración compartida (`packages/config`)

> Estado: vigente 2026-10-15

## Qué es

Fuente única de configs base: TypeScript (`base/nextjs/node`), ESLint (`base/nextjs/react/node`), Prettier y preset Tailwind. Sin código de negocio.

## Estructura / Exports

```
eslint/{base,nextjs,react,node}.js
typescript/{base,nextjs,node}.json
prettier/index.js
tailwind/preset.js
```

Se importa por subpath, no por barrel:

```json
{ "extends": "@sportcomplex/config/typescript/nextjs.json" }
```

## Cómo usar

```ts
// eslint.config.js
import base from "@sportcomplex/config/eslint/base";
export default [...base];
```

```js
// tailwind.config.js
import preset from "@sportcomplex/config/tailwind/preset";
export default { presets: [preset] };
```

## Límites (No hacer)

- No añadir dependencias de runtime ni lógica (solo config).
- No extender con overrides laxos (`noImplicitAny: false`, `: any` en handlers).
- No importar este paquete desde runtime web (solo `extends`/`import` en configs).

## Testing

```bash
pnpm verificar:limites
pnpm --filter web typecheck
```

Sin tests propios: se verifica por consumo (typecheck/lint de los paquetes).

## Ref docs

- `docs/architecture/architecture.md` (versiones y convenciones), `packages/ui/README.md`
