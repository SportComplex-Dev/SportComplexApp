## Goal Description

> **2026-10-12: MinIO eliminado.** No corremos MinIO en el VPS compartido (ahorra 2 contenedores, 1 volumen y 3 subdominios `s3/cdn/minio-admin`). Storage en **Supabase Storage** (mismo proyecto que DB/Auth). Este archivo reemplaza la guía anterior de MinIO.

## 1. Buckets (consola Supabase)

Crear en el proyecto de producción:

- `public-assets` → público (lectura abierta, ideal para catálogo/instalaciones).
- `private-assets` → privado (comprobantes, documentos; acceso solo con `SERVICE_ROLE` o RLS).

Equivalen a los antiguos buckets MinIO `public-assets` / `private-assets`, sin `mc` ni `minio-setup`.

## 2. Políticas sugeridas (RLS / Storage policies)

```sql
-- Lectura pública solo en public-assets
create policy "public read"
on storage.objects for select
using (bucket_id = 'public-assets');

-- Escritura solo desde backend (service_role); el frontend sube vía endpoint firmado
-- No crear policy de insert pública en private-assets.
```

## 3. Uso desde la app (Next.js)

Ya existen `@supabase/ssr` y `@supabase/supabase-js` en `apps/web/package.json`. No añadir SDK S3.

```ts
// Subida (server action / route, con SERVICE_ROLE o sesión)
supabase.storage.from('public-assets').upload(path, file)

// URL pública (catálogo)
supabase.storage.from('public-assets').getPublicUrl(path)

// Descarga privada (comprobantes)
supabase.storage.from('private-assets').createSignedUrl(path, 3600)
```

Variables ya definidas en `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). No se añaden `MINIO_*`.

## 4. Verificación

1. Subir una imagen a `public-assets` y abrir su URL pública (`https://<proyecto>.supabase.co/storage/v1/object/public/public-assets/...`). Debe verse sin auth.
2. Subir un archivo a `private-assets` y confirmar que su URL pública devuelve `403`; solo funciona `createSignedUrl`.

