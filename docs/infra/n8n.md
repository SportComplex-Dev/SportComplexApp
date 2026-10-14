## Goal Description
Guía interna para **crear, inicializar y mantener** nuestra instancia de n8n en el VPS compartido. Todo corre dentro de `~/SportComplexApp` en la red privada `sportcomplex-net`; el tráfico externo entra por Caddy (`n8n.akros.lat`).

## 0. Cómo viajan los workflows
Los flujos n8n viven versionados en el repo:

```
packages/automation/workflows/*.json
```

El servicio n8n en `docker/docker-compose.yml` los monta de solo lectura:

```yaml
    volumes:
      - ./data/n8n:/home/node/.n8n
      - ../packages/automation/workflows:/opt/workflows:ro
```

**El deploy los lleva solo**: el workflow `deploy.yml` hace `git pull` en el VPS e importa cualquier JSON nuevo automáticamente. No hay que tocar el servidor.

## 1. Setup inicial (una sola vez)

1. Levantar todo: `cd ~/SportComplexApp/docker && sudo docker compose up -d`.
2. Abrir `https://n8n.akros.lat` (Caddy saca el cert en el primer acceso).
3. Crear la **cuenta Owner** (email + password del equipo). Queda persistida en `./data/n8n` (SQLite). Guardarla en el gestor de contraseñas.
4. Importar los workflows con n8n **detenido** (contenedor one-off, evita el race SQLite "table migrations already exists"):
   ```bash
   cd ~/SportComplexApp/docker
   sudo docker compose run --rm n8n import:workflow --separate --input=/opt/workflows/
   ```
   > Sin el `n8n` inicial: `run --rm n8n <subcomando>` (el entrypoint ya es `n8n`). El comando `activate:workflow` **no existe** en n8n actual.
5. Publicar cada workflow por `--id` (con el servidor detenido) y levantar n8n:
   ```bash
   IDS=$(python3 -c "import sqlite3; c=sqlite3.connect('file:$HOME/SportComplexApp/docker/data/n8n/database.sqlite?mode=ro', uri=True); print(' '.join(r[0] for r in c.execute('select id from workflow_entity order by id')))")
   for id in $IDS; do sudo docker compose run --rm n8n publish:workflow --id="$id"; done
   sudo docker compose up -d n8n
   ```
6. **Cero credenciales guardadas en n8n.** Política vigente: los workflows llaman por HTTP usando keys desde `$env`, nunca credenciales almacenadas (las del JSON de dev no existen en prod y rompen import/publish). Hoy:
   - Emails (6 workflows): `POST https://api.resend.com/emails` con header `Authorization: Bearer {{ $env.RESEND_API_KEY }}`. La key llega por `docker/.env` (la escribe el deploy desde el secret `RESEND_API_KEY`).
   - Festivos: `POST http://web:3000/api/internal/festivos` con header `x-internal-key: {{ $env.INTERNAL_API_KEY }}` (ver `apps/web/src/app/api/internal/festivos/route.ts`). La key vive en `APPS_WEB_ENV` y el deploy la propaga a `docker/.env`.
   Sin estas env vars los flujos fallan al ejecutar aunque estén activos.
7. Prueba de humo: abrir el workflow de webhook de prueba, pulsar **Execute**, copiar la *Test URL* (`https://n8n.akros.lat/webhook-test/...`) y abrirla — debe responder 200.

## 2. Cuando se añade un JSON nuevo al repo

El flujo es cero-SSH:

1. Alguien exporta el workflow desde n8n (o lo crea a mano) y lo guarda en `packages/automation/workflows/nombre-nuevo.json` **sin credenciales guardadas** (ver política en el paso 6 anterior: HTTP + `$env`).
2. PR → merge a `main`.
3. El workflow `deploy.yml` solo: hace `git pull` en el VPS → monta el JSON en `/opt/workflows` → importa con n8n detenido (`run --rm`) y publica por `--id`.
4. El JSON nuevo aparece en la lista de workflows en la UI y queda activo. Para reactivar manualmente: repetir el paso 5 anterior (publish por `--id` con el servidor detenido).

### Actualizar un workflow existente
El import por CLI no sobrescribe workflows cuyo `id` ya existe (falla con "already exists" y el loop lo omite). Para actualizar uno que ya está en n8n:
- Opción A (la fácil): editarlo en la UI directamente. El JSON del repo queda de respaldo/versionado.
- Opción B (desde código): en la UI borrar el workflow viejo y reimportar el JSON nuevo (el import lo recrea).
- Opción C (API n8n): con `N8N_API_KEY` haces `PUT /api/v1/workflows/:id` con el JSON. Solo si terminamos con muchos cambios fluyendo código → servidor.

## 3. Operación del día a día

```bash
# Ver estado y logs
cd ~/SportComplexApp/docker
sudo docker compose ps
sudo docker compose logs -f n8n

# Reiniciar solo n8n
sudo docker compose restart n8n

# Backup del estado (SQLite + credenciales cifradas)
sudo tar -czf n8n-data-$(date +%F).tar.gz -C ~/SportComplexApp/docker data/n8n
```

## 4. Si muere n8n

1. `sudo docker compose up -d n8n` — se levanta otra vez con el volumen intacto.
2. Si la SQLite se corrompe: parar n8n, restaurar el backup tar en `data/n8n`, levantar de nuevo.
3. Si el volumen se pierde completo: recrear cuenta Owner paso 1-3, reimportar workflows (paso 1.4), recrear credenciales (paso 1.6). Los webhooks conservan las mismas URLs si los paths no cambiaron en el JSON.
