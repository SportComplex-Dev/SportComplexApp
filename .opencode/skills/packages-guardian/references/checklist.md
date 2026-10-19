# packages-guardian — checklist rápida

- [ ] `import @sportcomplex/X` (nunca `@sportcomplex/X/src/*`).
- [ ] `domain` 0 deps internas; `validation` solo `zod`; `application → domain+validation`.
- [ ] `rootDir: src`, `exports → dist/`, build antes de consumir.
- [ ] Sin `any`, sin mocks (`catalogoInicial|cuentasEjemplo`) en prod, sin `unsplash`, sin `X/X.tsx`, sin `__tests__/`.
- [ ] `pnpm verificar:limites --all` 0 infracciones + `turbo build` 16/16 + tests co-locados verdes.
