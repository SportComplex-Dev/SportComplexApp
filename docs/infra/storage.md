# Storage (Supabase)

> Estado: vigente 2026-10-18

> **2026-10-12: MinIO eliminado.** No corremos MinIO en el VPS dedicado (ahorra 2 contenedores, 1 volumen y 3 subdominios `s3/cdn/minio-admin`). Storage en **Supabase Storage** (mismo proyecto que DB/Auth). Este archivo reemplaza la guía anterior de MinIO.

## 1. Buckets (Supabase)

| Bucket | Visibilidad | Uso |
|---|---|---|
| `sportcomplex-assets` | Público (lectura abierta) | Catálogo, hero e imágenes de marca servidos por CDN (HU-29) |
| `private-assets` | Privado | Comprobantes y documentos (acceso solo con `SERVICE_ROLE` o `createSignedUrl`) |
| `backups` | Privado | Backups de BD cifrados (ver `backup-produccion.md`) |

Equivalen a los antiguos buckets MinIO `public-assets` / `private-assets`, sin `mc` ni `minio-setup`. `sportcomplex-assets` reemplaza al antiguo nombre `public-assets`.

## 2. Aprovisionamiento de `sportcomplex-assets` (TSK-OPS-02 · SCRUM-179)

Script idempotente que crea el bucket público y aplica sus políticas RLS:

```bash
# Dry-run (imprime el plan, no toca nada)
pnpm --filter @sportcomplex/db storage:setup

# Aplica bucket + políticas
pnpm --filter @sportcomplex/db storage:setup --execute

# Además sube un healthcheck y verifica la lectura anónima + Cache-Control
pnpm --filter @sportcomplex/db storage:setup --execute --verify
```

`packages/db/scripts/setup-storage-assets.mts`:

- Crea `POST /storage/v1/bucket` con `public: true`, `file_size_limit` 5 MB y
  `allowed_mime_types` (`image/webp`, `image/avif`, `image/png`, `image/svg+xml`).
  Si el bucket ya existe, sincroniza la configuración (`PUT`).
- Aplica las políticas RLS de §3 sobre `storage.objects` vía la conexión Postgres.
- Requiere `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  y `DIRECT_URL`/`DATABASE_URL`. `ASSETS_STORAGE_BUCKET` permite sobreescribir el nombre.

## 3. Políticas (RLS / Storage policies)

- **SELECT:** permitido para `anon` y `authenticated` (lectura pública irrestricta).
- **INSERT/UPDATE/DELETE:** reservado al `service_role`; `anon`/`authenticated` no
  tienen política permisiva ⇒ **denegado por defecto**.

```sql
-- Lectura pública
create policy "sportcomplex-assets public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'sportcomplex-assets');

-- Escritura solo desde el backend (service_role)
create policy "sportcomplex-assets service insert"
on storage.objects for insert to service_role
with check (bucket_id = 'sportcomplex-assets');
create policy "sportcomplex-assets service update"
on storage.objects for update to service_role
using (bucket_id = 'sportcomplex-assets')
with check (bucket_id = 'sportcomplex-assets');
create policy "sportcomplex-assets service delete"
on storage.objects for delete to service_role
using (bucket_id = 'sportcomplex-assets');
```

> `service_role` omite RLS; sus políticas se declaran por claridad. Lo que
> garantiza el bloqueo de escritura anónima es la **ausencia** de política
> permisiva para `anon`/`authenticated`.

## 4. Uso desde la app (Next.js)

Ya existen `@supabase/ssr` y `@supabase/supabase-js` en `apps/web/package.json`. No añadir SDK S3.

```ts
// Subida (server action / route / script, con SERVICE_ROLE)
await supabase.storage.from('sportcomplex-assets').upload(path, file, {
  cacheControl: '31536000',
  upsert: true,
  contentType: 'image/webp',
})

// URL pública (catálogo)
supabase.storage.from('sportcomplex-assets').getPublicUrl(path)

// Descarga privada (comprobantes)
supabase.storage.from('private-assets').createSignedUrl(path, 3600)
```

Variables ya definidas en `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). No se añaden `MINIO_*`.

La base pública de assets **no** se hardcodea: el helper `@sportcomplex/core/assets`
la deriva de `NEXT_PUBLIC_SUPABASE_URL` + `sportcomplex-assets`
(`NEXT_PUBLIC_ASSETS_BASE_URL` es un override opcional). El bucket se aprovisiona
por proyecto (`storage:setup`); el de producción se mantiene como **espejo** del
catálogo (los mismos 23 objetos con el mismo `eTag`).

## 5. Verificación

```bash
# Bucket público: HEAD anónimo debe responder 200 (no 400/401/403)
curl -I "https://<ref>.supabase.co/storage/v1/object/public/sportcomplex-assets/<ruta>.webp"

# Lectura + Cache-Control automatizada
pnpm --filter @sportcomplex/db storage:setup --execute --verify
```

1. `200` en la URL pública sin token ⇒ lectura pública OK (CA: acceso directo sin auth).
2. Un `POST /storage/v1/object/sportcomplex-assets/...` sin `SERVICE_ROLE` debe
   responder `400/401/403` ⇒ escritura anónima denegada (CA: solo credenciales privilegiadas).
3. `private-assets`: su URL pública devuelve `403`; solo funciona `createSignedUrl`.

## Ref docs

- [`../features/assets-multimedia.md`](../features/assets-multimedia.md) — pipeline de assets (Sharp/WebP, CDN, rutas).
- [`backup-produccion.md`](./backup-produccion.md) — patrón de script Storage Admin API.
- [`../features/catalogo.md`](../features/catalogo.md) — catálogo que consume estas imágenes.
