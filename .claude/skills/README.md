# Skills — SportComplex (`.claude/skills/`)

> Estado: vigente 2026-10-15

Suite premium project-scope para Claude Code (auto-descubierta en `.claude/skills/` y también vía OpenCode como path compatible). Espejo de la fuente canónica `.opencode/skills/`; mismo contenido, frontmatter estándar `name` + `description`.

| Skill | Invocar `/nombre` cuando... | Núcleo |
|---|---|---|
| `docs-sync` | toques `docs/`, crees READMEs o propongas ADRs | crear-vs-actualizar por dominio, plantilla Estado, registro en `docs/README.md`, validación links |
| `packages-guardian` | crees imports, paquetes, exports o builds | `import @sportcomplex/X` nunca `/src`, `domain 0-deps`, `validation zod-only`, `verificar:limites` + build 16/16 |
| `frontend-premium` | crees rutas, componentes `ui/features` o flujos checkout/QR/scanner/POS | web orquesta, chrome en `ui`, Zod de `validation`, QR único, `force-static`, `TIMEZONE` |
| `backend-contract` | crees `route.ts`, repos, webhooks o crons | `auth→Zod→repo→ok/fail`, RBAC doble capa, `now` inyectable, SQL solo en `db`, n8n fire-and-forget |

Ver detalle en cada `SKILL.md` + `references/` + `scripts/verify.sh`.
