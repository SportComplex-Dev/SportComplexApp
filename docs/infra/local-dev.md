# Desarrollo local
> Estado: vigente 2026-10-15
Guía interna para **levantar la infraestructura en entorno local** (Development). En nuestras máquinas no usamos Caddy ni dominios reales (`akros.lat`), sino que exponemos los puertos directamente en `localhost`. Storage siempre contra Supabase (proyecto dev), nunca MinIO local.

## 1. Archivo Docker Compose para Desarrollo
Levanta solo **n8n**. La app Next.js corre con `pnpm dev` y el storage va contra Supabase cloud.

### `docker/docker-compose.dev.yml`
```yaml
name: sportcomplex-dev

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=development
      - WEBHOOK_URL=http://localhost:5678/
      - GENERIC_TIMEZONE=America/Bogota
    volumes:
      - ./dev_data/n8n:/home/node/.n8n
```

## 2. Preparación Local
```bash
mkdir -p ./docker/dev_data/n8n
# Desarrollo local
> Estado: vigente 2026-10-15
sudo chown -R 1000:1000 ./docker/dev_data/n8n
```

## 3. Levantando el Entorno
```bash
docker compose -f docker/docker-compose.dev.yml up -d
# App:
pnpm dev
```

## 4. Acceso Local y Setup
* **n8n:** `http://localhost:5678`.
* **App:** `http://localhost:3000` (`NEXT_PUBLIC_APP_URL=http://localhost:3000`).
* **Storage:** buckets `public-assets` / `private-assets` del proyecto Supabase dev (ver `./storage.md`). Nada en `localhost:9000/9001`.
