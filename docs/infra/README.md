# Índice de documentación — Infraestructura
> Estado: vigente 2026-10-15

Despliegue y operación del VPS dedicado (`148.113.252.230`). Todo corre en el home de `ubuntu` (`~/SportComplexApp`). Edge único: **Caddy** en `80/443`.

| Doc | Contenido |
|---|---|
| [vps-provisioning.md](./vps-provisioning.md) | DNS, hardening (UFW), Docker, usuario SSH, `provision.sh`, compose maestro y Caddyfile de producción |
| [docker.md](./docker.md) | Estrategia de contenedores: `Dockerfile.web` multi-stage, compose de producción/desarrollo, red `sportcomplex-net` |
| [caddy.md](./caddy.md) | Edge/reverse proxy: auto-HTTPS, rutas por dominio, recarga sin downtime |
| [n8n.md](./n8n.md) | Instancia n8n: setup owner, importación de workflows JSON, credenciales, ciclo de vida y backups |
| [storage.md](./storage.md) | Supabase Storage (reemplazo de MinIO): buckets, políticas, uso desde la app |
| [local-dev.md](./local-dev.md) | Réplica local de n8n sin dominios ni proxy (`docker-compose.dev.yml`) |
| [ci-cd.md](./ci-cd.md) | GitHub Actions: CI en PRs, build→GHCR y deploy SSH a `main`, secrets y bootstrap |
| [env-setup.md](./env-setup.md) | Configuración del `.env.local`: Supabase, Auth, Stripe, n8n, reset de admin y troubleshooting |
| [backup-produccion.md](./backup-produccion.md) | Backup verificado de la BD de producción: dump+GPG AES-256, verificación por restauración local y custodia en Storage |

## Decisiones vigentes (2026-10-12)

- Caddy es el único proxy en `80/443` del VPS dedicado.
- Sin MinIO en el VPS: DB/Auth/Storage viven en Supabase cloud.
- Los `.env` no se editan a mano en el VPS: viajan cifrados como secrets del environment `production` y los escribe el pipeline.
- Los workflows n8n se versionan en `packages/automation/workflows/` y se importan solos en cada deploy.
