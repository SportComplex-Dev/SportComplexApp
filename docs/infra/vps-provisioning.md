## Goal Description
Este documento detalla la configuración inicial directamente en nuestro VPS **compartido**. Todo el aprovisionamiento y los archivos de orquestación (Docker Compose, Caddyfile) viven en `~/SportComplexApp` (home del usuario `ubuntu`). El otro equipo trabaja en `~/OtiumProyect` con sus propias llaves. Nunca se comparten `.env` ni SSH keys.

Caddy es el **único edge** en `80/443`. Dos proxies no pueden bindear los mismos puertos (`bind: address already in use`).

**Acuerdo confirmado con el otro equipo (2026-10-12):** no tienen Nginx ni Certbot. Solo Docker con su Next.js (`jorge-web`, interno `3002`, escucha en `0.0.0.0`). Todo su tráfico va por nuestro Caddy.

## 1. Configuración de Dominios (DNS)
Nuestros registros **A** apuntando a la IP del VPS:
* `A` -> `@`
* `A` -> `www`
* `A` -> `n8n`

El otro equipo gestiona su propio DNS: `A otium.coderhivex.com -> misma IP del VPS` (requisito previo: sin ese `A`, Let's Encrypt no emite su certificado). No tocamos su zona.

Checklist pre-despliegue del otro equipo (confirmado por ellos antes de montar):
- [ ] `A otium.coderhivex.com` resuelve a la IP del VPS (`dig +short otium.coderhivex.com`).
- [ ] Su Next.js escucha en `0.0.0.0:3002` (`HOSTNAME=0.0.0.0`, `PORT=3002`), no en `localhost`.
- [ ] Servicio `jorge-web` con `expose: ["3002"]` (sin `ports: 80/443`), en redes `jorge-net` + `edge-shared` externa.
- [ ] Directorio `~/OtiumProyect`, compose con `name:` propio.

## 2. Preparación del Entorno y Aprovisionamiento
Nos conectamos por SSH al VPS (usuario `ubuntu`) y usamos como base el home, igual que los otros proyectos en el servidor:
```bash
cd ~
rmdir SportComplexApp 2>/dev/null || true   # quitar la carpeta vacía si ya existe
git clone https://github.com/<org>/SportComplexApp.git SportComplexApp
cd SportComplexApp
```

La convención real del VPS (home de `ubuntu`): `~/OtiumProyect` (Jorge), `~/SportComplexApp` (nosotros). El acuerdo original de `/opt/<proyecto>` con usuarios dedicados quedó descartado: el aislamiento real lo dan el `name:` de compose y las redes Docker separadas.

Creamos el script de aprovisionamiento:

### `provision.sh`
```bash
#!/bin/bash
set -e

echo "=== Iniciando Aprovisionamiento del VPS ==="

# 0. Limpieza de conflictos (estado real del VPS Ubuntu 26.04)
# - nginx 1.28 venía preinstalado → removido
# - docker-compose-v2 (ubuntu) choca con docker-compose-plugin (docker.com) → removerlo ANTES
# - caddy instalado vía apt toma 80/443 como servicio systemd y choca con nuestro Caddy Docker
#   → systemctl disable --now caddy && apt remove -y caddy
apt remove -y nginx docker-compose-v2 caddy 2>/dev/null || true
apt autoremove -y

# 1. Actualizar sistema
apt update && apt upgrade -y

# 1.5. Llave de despliegue para GitHub Actions (usuario ubuntu, convención real del VPS).
# Generar par dedicado localmente con `ssh-keygen -t ed25519` y pegar aquí la PÚBLICA:
# echo "ssh-ed25519 AAAA... github-actions-sportcomplex" | sudo tee -a /home/ubuntu/.ssh/authorized_keys
# El equipo de otium genera y registra la suya por su cuenta.

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

# 6. Red externa compartida con el otro equipo (solo para el edge)
docker network create edge-shared || true

echo "=== Aprovisionamiento Completado ==="
```
Ejecutamos el script: `bash provision.sh`

> El otro equipo trabaja en `~/OtiumProyect` con su propio compose (`name:` propio) y sus propias llaves. No corre proxy ni publica `80/443`. Lo demás lo montan ellos.

### Orden de encendido (evita 502 / fallo ACME)
1. `docker network create edge-shared` (una sola vez, compartida).
2. Ellos: `docker compose up -d` en `~/OtiumProyect` (`jorge-web` resoluble en `edge-shared`).
3. Nosotros: `docker compose up -d` en `~/SportComplexApp` + `docker exec caddy caddy reload`.
4. Verificar: `curl -Ik https://otium.coderhivex.com` → `200`, cert válido.

## 3. Clonado de la App y Orquestación

El clonado se hace al inicio del paso 2 (ver arriba). Trabajamos dentro de `~/SportComplexApp`.

### Docker Compose Maestro
Controla App, Caddy y n8n (ver `./n8n.md` para el bloque n8n). Sin MinIO.

### `docker-compose.yml`
```yaml
name: sportcomplex-prod

services:
  migrate:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    command: ["pnpm", "--filter", "@sportcomplex/db", "db:migrate:deploy"]
    env_file:
      - .env
    networks:
      - prod-net
    restart: "no"

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    depends_on:
      migrate:
        condition: service_completed_successfully
    env_file:
      - .env
    expose:
      - "3000"
    networks:
      - prod-net
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
      - ./caddy_data:/data
      - ./caddy_config:/config
    networks:
      - prod-net
      - edge-shared
    restart: unless-stopped

networks:
  prod-net:
    driver: bridge
  edge-shared:
    external: true
```

Reglas de convivencia:
- Nuestros servicios usan `expose`, nunca `ports` (salvo Caddy con `80/443`). Así los puertos internos (`3000`, `5678`) pueden repetirse en el otro equipo sin chocar.
- `name:` y red `prod-net` son solo nuestros. El otro equipo usa su propio `name:` y su red.
- Solo `caddy` y ambas apps tocan `edge-shared`. n8n y demás quedan en `prod-net`.

El otro equipo, en `~/OtiumProyect` (configuración confirmada por ellos, sin proxy propio):
```yaml
services:
  jorge-web:
    image: su-app
    expose: ["3002"]
    networks: [jorge-net, edge-shared]
```

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

# Otro equipo (su DNS lo gestionan ellos; requiere red edge-shared)
# OJO: dentro de edge-shared hay que apuntar al puerto INTERNO del contenedor,
# no al publicado en el host. Su compose publica 3002 host -> 3000 contenedor.
# Estado verificado (2026-10-12): jorge-web:3000 responde 200 vía edge-shared.
{$JORGE_DOMAIN:otium.coderhivex.com} {
  reverse_proxy jorge-web:3000
}
```

Notas:
- Sintaxis Caddy es `reverse_proxy`, no `proxy_pass` (eso es Nginx).
- `localhost:3002` **no** funciona desde dentro del contenedor Caddy (`localhost` es el propio Caddy → `502`). Por eso se usa el nombre de servicio `jorge-web:3002` sobre la red `edge-shared`.
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
JORGE_DOMAIN=otium.coderhivex.com

# App Next.js (Supabase externo: DB + Auth + Storage)
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Sin variables `MINIO_*` ni `DOMAIN_MINIO_*` / `DOMAIN_CDN`: storage vive en Supabase (ver `./storage.md`).

Con estos archivos listos, probamos con `docker compose up -d`.
