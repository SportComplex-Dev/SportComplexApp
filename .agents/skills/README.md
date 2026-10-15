# Skills — SportComplex (`/.agents/skills/`)

> Estado: vigente 2026-10-15

Suite premium workspace-scope para Antigravity (compatible también con OpenCode vía `.agents/skills`, y con Claude). Fuente canónica OpenCode en `.opencode/skills/`; este mirror es el que carga Antigravity (`/.agents/skills/` > `~/.gemini/config/skills/`).

| Skill | Invocar `/nombre` cuando... | Núcleo |
|---|---|---|
| `docs-sync` | toques `docs/`, crees READMEs o propongas ADRs | crear-vs-actualizar por dominio, plantilla Estado, registro en `docs/README.md`, validación links |
| `packages-guardian` | crees imports, paquetes, exports o builds | `import @sportcomplex/X` nunca `/src`, `domain 0-deps`, `validation zod-only`, `verificar:limites` + build 16/16 |
| `frontend-premium` | crees rutas, componentes `ui/features` o flujos checkout/QR/scanner/POS | web orquesta, chrome en `ui`, Zod de `validation`, QR único, `force-static`, `TIMEZONE` |
| `backend-contract` | crees `route.ts`, repos, webhooks o crons | `auth→Zod→repo→ok/fail`, RBAC doble capa, `now` inyectable, SQL solo en `db`, n8n fire-and-forget |

Ver detalle en cada `SKILL.md` + `references/` + `scripts/verify.sh`.
