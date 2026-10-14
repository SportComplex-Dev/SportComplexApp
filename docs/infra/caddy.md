# Caddy — edge único del VPS compartido

## Rol

Caddy es el **único proxy** del VPS en `80/443`. Auto-HTTPS con Let's Encrypt para todos los dominios — los nuestros (`akros.lat`, `www`, `n8n.akros.lat`) y el del otro equipo (`otium.coderhivex.com`). No convive con Nginx ni Certbot (chocarían en los mismos puertos).

## Configuración activa (`docker/Caddyfile`)

```caddyfile
{
  email official@akros.lat
}

akros.lat, www.akros.lat {
  reverse_proxy sportcomplex-prod-web-1:3000
}

n8n.akros.lat {
  reverse_proxy sportcomplex-prod-n8n-1:5678
}

otium.coderhivex.com {
  reverse_proxy jorge-web:3000
}
```

> **Puerto: 3000, no 3002.** Al proxyear por red Docker (`edge-shared`) se usa el puerto **interno** del contenedor. Su compose publica `3002:3000` para pruebas manuales en el host, pero por DNS de Docker (`jorge-web`) se llega al puerto del contenedor: `3000`. Usar `jorge-web:3002` da `502`.

## Reglas duras

1. **`reverse_proxy`, no `proxy_pass`** — eso es sintaxis Nginx.
2. **Nunca `localhost`** dentro del Caddyfile: el contenedor Caddy resolvería `localhost` consigo mismo (`502`).
3. **Upstreams por nombre de contenedor único, nunca por alias de servicio.** **2026-10-14**: `akros.lat` sirvió la app de otium porque su servicio compose también se llama `web` y publica ese alias en `edge-shared`; Caddy (conectado a ambas redes) resolvía `web:3000` de forma ambigua. `sportcomplex-prod-web-1`, `sportcomplex-prod-n8n-1` y `jorge-web` son únicos y no colisionan.
4. **`jorge-web` solo es alcanzable vía la red externa `edge-shared`** — los contenedores del otro equipo deben estar conectados a ella, no a `sportcomplex-net`.
5. Sin `A record` en DNS no hay certificado: antes de encender, `dig +short <dominio>` debe devolver la IP del VPS.
6. **Convivencia del proxy compartido**: nunca `compose down` del proyecto `sportcomplex-prod` (bajaría Caddy y con él el sitio de otium), no publicar nada más en 80/443, no borrar la red `edge-shared`.

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
2. Editar `docker/Caddyfile` con el bloque nuevo (apuntando al servicio por su nombre de red Docker).
3. Commit + push a `main` → el deploy hace `git pull` en el VPS y `docker compose up -d`; si el Caddyfile cambió, recargar:
   ```bash
   sudo docker exec sportcomplex-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
4. Verificar: `curl -Ik https://<subdominio>` debe devolver 200/302 con cert válido.

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `502` en `otium.coderhivex.com` | `jorge-web` no está en `edge-shared` o está caído | `docker network connect edge-shared jorge-web` o el otro equipo levanta su contenedor |
| Cert no emite / ACME failure | Falta el `A record` o el puerto 80 está tomado por otro proceso | `sudo ss -tlnp \| grep -E ':80\|:443'` debe mostrar solo Caddy |
| `bind: address already in use` | Otro proxy (nginx/caddy host) tomó 80/443 | `sudo systemctl disable --now caddy nginx` + `apt remove` |
