# Caddy — edge único del VPS dedicado
> Estado: vigente 2026-10-15

## Rol

Caddy es el **único proxy** del VPS en `80/443`. Auto-HTTPS con Let's Encrypt para nuestros dominios (`akros.lat`, `www`, `n8n.akros.lat`). No convive con Nginx ni Certbot (chocarían en los mismos puertos).

## Configuración activa (`docker/Caddyfile`)

```caddyfile
{
  email official@akros.lat
}

akros.lat, www.akros.lat {
  reverse_proxy web:3000
}

n8n.akros.lat {
  reverse_proxy n8n:5678
}
```

> VPS dedicado (2026-10-15): se eliminó el bloque `otium.coderhivex.com` y la red `edge-shared`. Los upstreams vuelven a nombres de servicio (`web:3000`, `n8n:5678`) dentro de `sportcomplex-net`. Historial: en el VPS compartido se usaban nombres de contenedor únicos (`sportcomplex-prod-web-1`) porque otro servicio `web` resolvía ambiguo en `edge-shared`.

## Reglas duras

1. **`reverse_proxy`, no `proxy_pass`** — eso es sintaxis Nginx.
2. **Nunca `localhost`** dentro del Caddyfile: el contenedor Caddy resolvería `localhost` consigo mismo (`502`).
3. **Upstreams por nombre de servicio** (`web`, `n8n`) en `sportcomplex-net`.
4. Sin `A record` en DNS no hay certificado: antes de encender, `dig +short <dominio>` debe devolver la IP del VPS.
5. Caddy vive en el compose `sportcomplex-prod`; `compose down` baja el edge con él — usar `up -d <servicio>` para operaciones parciales.

## Operación

```bash
# Estado y logs
sudo docker compose ps caddy
sudo docker compose logs -f caddy

# Validar el Caddyfile antes de tocar nada
sudo docker exec sportcomplex-prod-caddy-1 caddy validate --config /etc/caddy/Caddyfile

# Recarga sin downtime (tras editar docker/Caddyfile)
sudo docker compose up -d caddy       # aplica el archivo montado si cambió el contenedor
sudo docker exec sportcomplex-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Cómo agregar un subdominio nuevo

1. Crear el `A record` apuntando a la IP del VPS y esperar propagación.
2. Editar `docker/Caddyfile` con el bloque nuevo (apuntando al servicio por su nombre en `sportcomplex-net`).
3. Commit + push a `main` → el deploy hace `git pull` en el VPS y `docker compose up -d`; si el Caddyfile cambió, recargar:
   ```bash
   sudo docker exec sportcomplex-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
4. Verificar: `curl -Ik https://<subdominio>` debe devolver 200/302 con cert válido.

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `502` en `akros.lat` | `web` caído o nombre de servicio mal escrito | `docker compose ps web` + `logs -f web`, verificar `reverse_proxy web:3000` |
| Cert no emite / ACME failure | Falta el `A record` o el puerto 80 está tomado por otro proceso | `sudo ss -tlnp \| grep -E ':80\|:443'` debe mostrar solo Caddy |
| `bind: address already in use` | Otro proxy (nginx/caddy host) tomó 80/443 | `sudo systemctl disable --now caddy nginx` + `apt remove` |
