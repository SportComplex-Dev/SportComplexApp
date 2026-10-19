/**
 * setup-storage-assets — aprovisiona el bucket público de assets en Supabase
 * Storage (TSK-OPS-02 · SCRUM-179 · HU-29 · RNF-04).
 *
 * Crea de forma idempotente el bucket `sportcomplex-assets` con lectura pública
 * (`public: true`). Las políticas RLS sobre `storage.objects` **no se pueden**
 * aplicar desde el pooler (el usuario `postgres` no es owner de la tabla);
 * el script emite el SQL para pegar en el **SQL Editor del Dashboard de Supabase**
 * (corre como superusuario). El endpoint público `/storage/v1/object/public/...`
 * ya sirve archivos sin autenticación gracias a `public: true`.
 *
 * Uso:
 *   tsx scripts/setup-storage-assets.mts                    # dry-run (imprime el plan)
 *   tsx scripts/setup-storage-assets.mts --execute          # crea/actualiza bucket + emite SQL
 *   tsx scripts/setup-storage-assets.mts --execute --verify # + healthcheck público
 *
 * Variables (apps/web/.env.local | apps/web/.env | packages/db/.env):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL   URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY                 clave service role (Storage Admin API)
 *   ASSETS_STORAGE_BUCKET                     (opcional) nombre del bucket
 *                                             (default: sportcomplex-assets)
 *   DIRECT_URL | DATABASE_URL                 (opcional) si se quiere intentar
 *                                             políticas vía pg (fallará en Supabase)
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();
if (typeof process.loadEnvFile === "function") {
  for (const candidate of [
    "../../../apps/web/.env.local",
    "../../../apps/web/.env",
    "../.env",
  ]) {
    try {
      process.loadEnvFile(path.resolve(__dirname, candidate));
    } catch {
      /* archivo ausente: se ignora */
    }
  }
}

const EXECUTE = process.argv.includes("--execute");
const VERIFY = process.argv.includes("--verify");

const BUCKET = process.env.ASSETS_STORAGE_BUCKET || "sportcomplex-assets";
const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

// Guardarraíles del bucket (RNF-04: solo imágenes ya optimizadas).
const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = [
  "image/webp",
  "image/avif",
  "image/png",
  "image/svg+xml",
];
const CACHE_CONTROL = "public, max-age=31536000, immutable";

if (!/^[a-z0-9-]+$/.test(BUCKET)) {
  console.error(`Nombre de bucket inválido: "${BUCKET}" (solo [a-z0-9-]).`);
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Faltan SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

/** Sentencias SQL idempotentes de las políticas RLS del bucket. */
function policyStatements(bucket: string): string[] {
  return [
    // Lectura pública irrestricta (CA: acceso por URL directa sin token).
    `drop policy if exists "${bucket} public read" on storage.objects;`,
    `create policy "${bucket} public read"
       on storage.objects for select
       to anon, authenticated
       using (bucket_id = '${bucket}');`,
    // Escritura reservada al service_role (CA: sin credenciales privilegiadas
    // no se puede subir). service_role omite RLS; las políticas se declaran
    // por claridad/documentación.
    `drop policy if exists "${bucket} service insert" on storage.objects;`,
    `create policy "${bucket} service insert"
       on storage.objects for insert
       to service_role
       with check (bucket_id = '${bucket}');`,
    `drop policy if exists "${bucket} service update" on storage.objects;`,
    `create policy "${bucket} service update"
       on storage.objects for update
       to service_role
       using (bucket_id = '${bucket}')
       with check (bucket_id = '${bucket}');`,
    `drop policy if exists "${bucket} service delete" on storage.objects;`,
    `create policy "${bucket} service delete"
       on storage.objects for delete
       to service_role
       using (bucket_id = '${bucket}');`,
  ];
}

function printPolicySQL(): void {
  console.log("\n--- SQL para ejecutar en Supabase Dashboard → SQL Editor ---");
  for (const sql of policyStatements(BUCKET)) {
    console.log(sql);
  }
  console.log("--- Fin SQL ---\n");
}

/** Crea el bucket público (idempotente) y sincroniza su configuración. */
async function ensureBucket(): Promise<void> {
  const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: FILE_SIZE_LIMIT,
      allowed_mime_types: ALLOWED_MIME,
    }),
  });

  if (res.ok) {
    console.log(`✔ bucket "${BUCKET}" creado (lectura pública).`);
    printPolicySQL();
    return;
  }

  const body = await res.text();
  const exists =
    body.includes("BucketAlreadyExists") ||
    body.includes("already exists") ||
    res.status === 409;

  if (!exists) {
    throw new Error(`Crear bucket falló: ${res.status} ${body}`);
  }

  console.log(`• bucket "${BUCKET}" ya existe; se sincroniza su configuración…`);
  const upd = await fetch(`${supabaseUrl}/storage/v1/bucket/${BUCKET}`, {
    method: "PUT",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      public: true,
      file_size_limit: FILE_SIZE_LIMIT,
      allowed_mime_types: ALLOWED_MIME,
    }),
  });
  if (!upd.ok) {
    throw new Error(`Actualizar bucket falló: ${upd.status} ${await upd.text()}`);
  }
  console.log(`✔ configuración del bucket "${BUCKET}" sincronizada.`);
  printPolicySQL();
}

/** Intenta aplicar políticas vía pg (fallará en Supabase: must be owner). */
async function tryApplyPolicies(): Promise<void> {
  if (!dbUrl) {
    console.log("• DIRECT_URL/DATABASE_URL no configurado → omitiendo intento de RLS vía pg.");
    return;
  }

  // Import dinámico para no requerir `pg` si no se usa.
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(`alter table storage.objects enable row level security`);
    for (const sql of policyStatements(BUCKET)) {
      await client.query(sql);
    }
    console.log(`✔ políticas RLS aplicadas vía pg (inesperado en Supabase cloud).`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("must be owner of table objects")) {
      console.warn("⚠ pg no puede crear políticas (usuario no owner de storage.objects).");
      console.warn("  → Ejecuta el SQL de arriba en Supabase Dashboard → SQL Editor.");
    } else {
      console.warn(`⚠ Error aplicando políticas vía pg: ${msg}`);
    }
  } finally {
    await client.end();
  }
}

/** 1x1 PNG transparente para el healthcheck público. */
const HEALTHCHECK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const HEALTHCHECK_PATH = "_healthcheck/healthcheck.png";

/** Sube un objeto de prueba y confirma la lectura anónima + Cache-Control. */
async function verifyPublicRead(): Promise<void> {
  const upload = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${HEALTHCHECK_PATH}`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "image/png",
        "cache-control": CACHE_CONTROL,
        "x-upsert": "true",
      },
      body: HEALTHCHECK_PNG,
    },
  );
  if (!upload.ok) {
    throw new Error(`Subida de healthcheck falló: ${upload.status} ${await upload.text()}`);
  }

  const anon = await fetch(
    `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${HEALTHCHECK_PATH}`,
  );
  if (!anon.ok) {
    throw new Error(
      `Lectura anónima falló: ${anon.status} (el bucket debe ser público).`,
    );
  }
  console.log(
    `✔ lectura anónima OK · Cache-Control: ${anon.headers.get("cache-control") ?? "(no expuesto)"}`,
  );

  await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [HEALTHCHECK_PATH] }),
  });
  console.log("✔ healthcheck eliminado.");
}

async function main(): Promise<void> {
  console.log(`Bucket destino: ${BUCKET} (${supabaseUrl})`);

  if (!EXECUTE) {
    console.log("\n[dry-run] Se aplicaría:");
    console.log(`  • bucket público "${BUCKET}" (files ≤ 5 MB, ${ALLOWED_MIME.join(", ")})`);
    console.log("  • políticas RLS (SQL para Dashboard):");
    for (const sql of policyStatements(BUCKET)) {
      if (sql.startsWith("create policy")) console.log(`     - ${sql.split("\n")[0].trim()}`);
    }
    console.log("\nReejecuta con --execute para aplicar.");
    return;
  }

  await ensureBucket();
  await tryApplyPolicies();

  if (VERIFY) {
    await verifyPublicRead();
  }

  console.log(`\nLISTO — URL pública base:`);
  console.log(
    `  ${supabaseUrl}/storage/v1/object/public/${BUCKET}/<ruta>`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
