# Docker — imágenes y orquestación

## Estrategia

La app se construye como una única imagen multi-stage en GitHub Actions y se publica en GHCR. El VPS **nunca compila**: solo `pull` y `up`. Migraciones de Prisma corren como job efímero (`migrate`) antes de levantar `web`.

```
Dockerfile.web (multi-stage)
deps → builder (prisma generate + next build) → runner (node:22-alpine, standalone ~180MB)
   ↓ push
ghcr.io/sportcomplex-dev/sportcomplex-web:{latest, <sha>}
   ↓ pull
VPS · docker compose up -d
```

## Archivos

| Archivo | Rol |
|---|---|
| `docker/Dockerfile.web` | Imagen de producción (standalone, usuario no-root `nodejs`, `EXPOSE 3000`) |
| `docker/docker-compose.yml` | Prod: `migrate` → `web` + `n8n` + `caddy` (único con `ports 80/443`) |
| `docker/Caddyfile` | Edge (ver `./caddy.md`) |
| `docker/docker-compose.dev.yml` | Local: solo `n8n` en `localhost:5678` |

## Reglas de convivencia en el VPS compartido

- `name: sportcomplex-prod` y red propia `sportcomplex-net`. Otros proyectos usan su propio `name:` y red.
- Solo `caddy` publica puertos (`80/443`). Todo lo demás usa `expose` (interno por red Docker).
- La imagen se referencia como `ghcr.io/sportcomplex-dev/sportcomplex-web:${IMAGE_TAG:-latest}` — el deploy fija `IMAGE_TAG=<sha>`.
- Límites de recursos en `web` (1 CPU / 1 GB) para no ahogar al otro proyecto.
- Red externa compartida `edge-shared` conecta Caddy con el contenedor del otro equipo (`jorge-web`); n8n y web quedan fuera de ella.

## Comandos diarios

```bash
# Build local de la imagen (igual que hace CI)
docker build -f docker/Dockerfile.web -t sportcomplex-web:local .

# Logs y estado en el VPS
cd ~/SportComplexApp/docker
sudo docker compose ps
sudo docker compose logs -f web

# Rollback a un sha anterior
IMAGE_TAG=<sha> sudo docker compose up -d --no-deps web

# Limpiar imágenes viejas (el VPS tiene ~37 GB)
sudo docker image prune -af --filter "until=168h"
```

## Notas

- El Dockerfile usa `corepack` con `pnpm@12.6.0` fijada y `output: 'standalone'` de Next.js — la imagen final no lleva `node_modules` de dev ni el monorepo completo.
- `migrate` corre con la misma imagen y `prisma migrate deploy`; si falla, `web` no arranca (`depends_on: condition: service_completed_successfully`).
- Volúmenes con estado real: `caddy_data` (certs), `data/n8n` (SQLite + credenciales). Ambos viven fuera de los contenedores y sobreviven a `down/up`.
