# Índice de documentación — Infraestructura

Despliegue y operación del VPS compartido (`148.113.252.230`). Todo corre en el home de `ubuntu`, cada proyecto en su carpeta (`~/SportComplexApp` nuestro). Edge único: **Caddy** en `80/443`.

| Doc | Contenido |
|---|---|
| [vps-provisioning.md](./vps-provisioning.md) | DNS, hardening (UFW), Docker, usuario SSH, `provision.sh`, compose maestro y Caddyfile de producción |
| [docker.md](./docker.md) | Estrategia de contenedores: `Dockerfile.web` multi-stage, compose de producción/desarrollo, red `edge-shared` compartida |
| [caddy.md](./caddy.md) | Edge/reverse proxy: auto-HTTPS, rutas por dominio, convivencia con `otium.coderhivex.com`, recarga sin downtime |
| [n8n.md](./n8n.md) | Instancia n8n: setup owner, importación de workflows JSON, credenciales, ciclo de vida y backups |
| [storage.md](./storage.md) | Supabase Storage (reemplazo de MinIO): buckets, políticas, uso desde la app |
| [local-dev.md](./local-dev.md) | Réplica local de n8n sin dominios ni proxy (`docker-compose.dev.yml`) |
| [ci-cd.md](./ci-cd.md) | GitHub Actions: CI en PRs, build→GHCR y deploy SSH a `main`, secrets y bootstrap |

## Decisiones vigentes (2026-10-12)

- Caddy es el único proxy: el otro equipo (`otium.coderhivex.com`) corre solo `jorge-web:3002`, sin Nginx/Certbot.
- Sin MinIO en el VPS: DB/Auth/Storage viven en Supabase cloud.
- Los `.env` no se editan a mano en el VPS: viajan cifrados como secrets del environment `production` y los escribe el pipeline.
- Los workflows n8n se versionan en `packages/automation/workflows/` y se importan solos en cada deploy.
