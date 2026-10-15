# Aprovisionamiento VPS
> Estado: vigente 2026-10-15
Este documento detalla la configuración inicial directamente en nuestro VPS **dedicado**. Todo el aprovisionamiento y los archivos de orquestación (Docker Compose, Caddyfile) viven en `~/SportComplexApp` (home del usuario `ubuntu`).

Caddy es el **único edge** en `80/443`. Dos proxies no pueden bindear los mismos puertos (`bind: address already in use`).

> VPS dedicado (2026-10-15): se retiró el esquema compartido con el equipo otium (`jorge-web`, red `edge-shared`, dominio `otium.coderhivex.com`). El historial queda en git; no recrear `edge-shared` ni bloques de terceros en el Caddyfile.

## 1. Configuración de Dominios (DNS)
Nuestros registros **A** apuntando a la IP del VPS:
* `A` -> `@`
* `A` -> `www`
* `A` -> `n8n`

## 2. Preparación del Entorno y Aprovisionamiento
Nos conectamos por SSH al VPS (usuario `ubuntu`) y usamos como base el home, igual que los otros proyectos en el servidor:
```bash
cd ~
rmdir SportComplexApp 2>/dev/null || true   # quitar la carpeta vacía si ya existe
git clone https://github.com/<org>/SportComplexApp.git SportComplexApp
cd SportComplexApp
```

La convención del VPS (home de `ubuntu`): `~/SportComplexApp` (proyecto único). Sin otros equipos en el host.

Creamos el script de aprovisionamiento:

### `provision.sh`
```bash
#!/bin/bash
set -e

echo "=== Iniciando Aprovisionamiento del VPS ==="

# Aprovisionamiento VPS
> Estado: vigente 2026-10-15
# - nginx 1.28 venía preinstalado → removido
# - docker-compose-v2 (ubuntu) choca con docker-compose-plugin (docker.com) → removerlo ANTES
# - caddy instalado vía apt toma 80/443 como servicio systemd y choca con nuestro Caddy Docker
#   → systemctl disable --now caddy && apt remove -y caddy
apt remove -y nginx docker-compose-v2 caddy 2>/dev/null || true
apt autoremove -y

# 1. Actualizar sistema
apt update && apt upgrade -y

# 1.5. Llave de despliegue para GitHub Actions (usuario ubuntu).
# Generar par dedicado localmente con `ssh-keygen -t ed25519` y pegar aquí la PÚBLICA:
# echo "ssh-ed25519 AAAA... github-actions-sportcomplex" | sudo tee -a /home/ubuntu/.ssh/authorized_keys

# 2. Configurar Firewall (UFW) — solo SSH + HTTP/S
echo "Configurando Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3. Docker + Compose plugin
# Ya instalado en el VPS vía repo oficial download.docker.com (docker-ce 29.9 + compose plugin 5.6.0).
# Si alguna vez nace de cero: quitar primero `docker-compose-v2` (Ubuntu) para evitar el conflicto de dpkg.

# 4. Crear estructura de volúmenes local (sin MinIO: storage en Supabase)
echo "Creando directorios de datos..."
mkdir -p ./n8n_data
mkdir -p ./caddy_data
mkdir -p ./caddy_config

# 5. Fix de permisos para n8n (Vital: UID 1000)
chown -R 1000:1000 ./n8n_data

# 6. Red privada del proyecto
docker network create sportcomplex-net || true

echo "=== Aprovisionamiento Completado ==="
```
Ejecutamos el script: `bash provision.sh`

### Orden de encendido
1. `docker compose up -d` en `~/SportComplexApp` + `docker exec caddy caddy reload`.
2. Verificar: `curl -Ik https://akros.lat` → `200`, cert válido.

## 3. Clonado de la App y Orquestación

El clonado se hace al inicio del paso 2 (ver arriba). Trabajamos dentro de `~/SportComplexApp`.

### Docker Compose Maestro
Controla App, Caddy y n8n (ver `./n8n.md` para el bloque n8n). Sin MinIO.

### `docker-compose.yml`
```yaml
name: sportcomplex-prod

services:
  migrate:
    image: ghcr.io/sportcomplex-dev/sportcomplex-web:${IMAGE_TAG:-latest}
    command: ["prisma", "migrate", "deploy", "--schema=packages/db/prisma/schema.prisma", "--config=packages/db/prisma.config.ts"]
    env_file:
      - ../apps/web/.env
    networks:
      - sportcomplex-net
    restart: "no"

  web:
    image: ghcr.io/sportcomplex-dev/sportcomplex-web:${IMAGE_TAG:-latest}
    depends_on:
      migrate:
        condition: service_completed_successfully
    env_file:
      - ../apps/web/.env
    expose:
      - "3000"
    networks:
      - sportcomplex-net
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - sportcomplex-net
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

networks:
  sportcomplex-net:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
```

Reglas:
- Los servicios usan `expose`, nunca `ports` (salvo Caddy con `80/443`).
- Todo corre en `sportcomplex-net`; sin redes externas.

---

### Reverse Proxy (Caddy)
### `Caddyfile`
```caddyfile
{
  email {$ACME_EMAIL:official@akros.lat}
}

# App principal
{$DOMAIN_APEX:akros.lat}, www.{$DOMAIN_APEX:akros.lat} {
  reverse_proxy web:3000
}

# n8n
{$DOMAIN_N8N:n8n.akros.lat} {
  reverse_proxy n8n:5678
}
```

Notas:
- Sintaxis Caddy es `reverse_proxy`, no `proxy_pass` (eso es Nginx).
- `localhost` **no** funciona desde dentro del contenedor Caddy (`localhost` es el propio Caddy → `502`). Por eso se usan nombres de servicio (`web:3000`, `n8n:5678`) en `sportcomplex-net`.
- Recargar sin downtime tras editar: `docker compose up -d caddy && docker exec caddy caddy reload`.

---

### Variables de Entorno
### `.env`
```env
# ==========================================
# INFRAESTRUCTURA VPS
# ==========================================
ACME_EMAIL=official@akros.lat
DOMAIN_APEX=akros.lat
DOMAIN_N8N=n8n.akros.lat

# App Next.js (Supabase externo: DB + Auth + Storage)
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Sin variables `MINIO_*` ni `DOMAIN_MINIO_*` / `DOMAIN_CDN`: storage vive en Supabase (ver `./storage.md`).

Con estos archivos listos, probamos con `docker compose up -d`.
