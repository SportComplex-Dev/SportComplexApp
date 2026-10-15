# docs-sync — checklist rápida

- [ ] Dominio: `product|architecture|features|automation|infra|onboarding`.
- [ ] Crear vs actualizar: `features/*` se actualiza mismo PR; `packages/apps` faltante se crea; ADR `NNN-kebab` + índice.
- [ ] `kebab-case.md`, 1x H1 dominio, español, `> Estado: vigente YYYY-MM-DD`.
- [ ] Sin `TSK/HU` en H1; IDs solo como `> Ref histórica:` o `## Trazabilidad`.
- [ ] Snippet ejecutable + comando testing exacto.
- [ ] Registrado en `docs/README.md` (tabla del tema).
- [ ] Links validados + `pnpm docs:check` verde.
