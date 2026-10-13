## Goal Description
Guía del **CI/CD** de GitHub Actions: CI en cada push/PR y CD hacia el VPS compartido al mergear en `main`.

## 1. Workflows

| Workflow | Trigger | Qué hace |
|---|---|---|
| `.github/workflows/ci.yml` | `push` a `develop`/`main` + PRs | `pnpm install` → `typecheck` → `lint` → `test` → build de `web` |
| `.github/workflows/deploy.yml` | `push` a `main` (+ manual) | Build de `docker/Dockerfile.web`, push a **GHCR** (`ghcr.io/sportcomplex-dev/sportcomplex-web:latest` y `:sha`) y despliegue SSH al VPS |

Usamos **GHCR (GitHub Container Registry)**, no Docker Hub: cero cuenta externa, el push lo hace el `GITHUB_TOKEN` automático del workflow (permiso `packages: write`).

## 2. Despliegue SSH
El job `deploy` se conecta por SSH como `ubuntu` y ejecuta:
```bash
cd ~/SportComplexApp/docker
sudo docker compose pull
sudo docker compose up migrate        # prisma migrate deploy (sale solo)
sudo docker compose up -d web caddy n8n
```
La imagen ya viene construida desde GitHub (`ghcr.io/sportcomplex-dev/sportcomplex-web:<sha>` y `:latest`); el VPS no compila.

> **Pull desde el VPS:** si el package GHCR es privado (por defecto), el VPS necesita login una vez:
> ```bash
> # En GitHub: Settings → Developer settings → Personal access tokens (classic) → scope read:packages
> echo "<PAT>" | sudo docker login ghcr.io -u Its-JrDev --password-stdin
> ```
> Alternativa (recomendada para este proyecto interno): tras el primer push, en GitHub abrir el package `sportcomplex-web` → **Package settings → Make public**, y el VPS hace pull anónimo sin login.

## 3. Secrets de GitHub (Settings → Secrets and variables → Actions)

| Secret | Ejemplo | Nota |
|---|---|---|
| `VPS_HOST` | `148.113.252.230` | IPv4 del VPS (`ip a`) |
| `VPS_USER` | `ubuntu` | Usuario SSH del VPS |
| `VPS_SSH_KEY` | `-----BEGIN ...` | Llave **privada** ed25519 dedicada a Actions |
| `APPS_WEB_ENV` | *(archivo completo)* | Contenido íntegro del `.env` de `apps/web` en producción |

*(Ya no se necesitan `DOCKERHUB_*`: la imagen vive en GHCR con el `GITHUB_TOKEN` automático del workflow.)*

Carga rápida con la CLI `gh` desde la raíz del repo:
```bash
gh secret set VPS_HOST --env production --body "148.113.252.230"
gh secret set VPS_USER --env production --body "ubuntu"
gh secret set VPS_SSH_KEY --env production < ~/.ssh/github-actions-sportcomplex
gh secret set APPS_WEB_ENV --env production < apps/web/.env
```

Generar la llave dedicada (en local) y registrar la pública en el VPS:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-actions-sportcomplex -N ""
ssh ubuntu@148.113.252.230 'echo "'$(cat ~/.ssh/github-actions-sportcomplex.pub)'" >> ~/.ssh/authorized_keys'
```

## 3.1. Secretos de la app (`.env`)
El `.env` **no** vive en el VPS a mano: viaja como secret `APPS_WEB_ENV` y el job `deploy` lo escribe en `~/SportComplexApp/apps/web/.env` (con `chmod 600`) antes de cada `docker compose up`. Para rotar un secreto: actualizar el secret y hacer `workflow_dispatch` o un push a `main`.

Contenido mínimo de ese secret = `apps/web/.env.example` con valores reales de producción (`NEXT_PUBLIC_APP_URL=https://akros.lat`, webhooks n8n con dominio `https://n8n.akros.lat/...`, claves Stripe reales cuando apliquen, `CRON_SECRET`, etc.).

## 4. Bootstrap inicial del VPS (una sola vez, manual)
1. Clonar el repo en `~/SportComplexApp` (ver `vps-provisioning.md`).
2. Registrar los 6 secrets de la tabla anterior en GitHub (`gh secret set ...`).
3. `mkdir -p ~/SportComplexApp/docker/data/n8n && sudo chown -R 1000:1000 ~/SportComplexApp/docker/data/n8n`.
4. `docker network create edge-shared` (si no existe).
5. Primer deploy: correr el workflow `deploy` (botón **Run workflow** en Actions) — él mismo escribe el `.env` desde `APPS_WEB_ENV`.
6. Verificar: `curl -Ik https://akros.lat` y `curl -Ik https://n8n.akros.lat`.

A partir de ahí, cada `git push` a `main` despliega solo. El rolback es `IMAGE_TAG=<sha_anterior> sudo docker compose up -d --no-deps web`.
