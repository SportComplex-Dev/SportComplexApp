/**
 * upload-assets-storage — sube los assets WebP del catálogo a Supabase Storage
 * (TSK-FE-30b · SCRUM-181 · HU-29 · RNF-04).
 *
 * Sube todos los *.webp de apps/web/public/images/catalogo/ al bucket
 * sportcomplex-assets con clave catalogo/<slug>.webp, cacheControl 1 año
 * e inmutable. Idempotente (x-upsert).
 *
 * Uso:
 *   tsx scripts/upload-assets-storage.mts           # dry-run (lista archivos)
 *   tsx scripts/upload-assets-storage.mts --execute # sube de verdad
 *   tsx scripts/upload-assets-storage.mts --execute --verify # sube + verifica GET anónimo
 *
 * Variables (apps/web/.env.local | apps/web/.env | packages/db/.env):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL   URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY                 clave service role (Storage Admin API)
 *   ASSETS_STORAGE_BUCKET                     (opcional) bucket, default sportcomplex-assets
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
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

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const SOURCE_DIR = path.resolve(__dirname, "../../../apps/web/public/images/catalogo");
const DEST_PREFIX = "catalogo";

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

function listWebP(): string[] {
  if (!SOURCE_DIR) return [];
  return readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".webp"))
    .sort();
}

async function uploadFile(filename: string): Promise<{ ok: boolean; url: string; status?: number; error?: string }> {
  const filePath = path.join(SOURCE_DIR, filename);
  const destPath = `${DEST_PREFIX}/${filename}`;
  const body = readFileSync(filePath);

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${destPath}`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "image/webp",
        "cache-control": CACHE_CONTROL,
        "x-upsert": "true",
      },
      body,
    },
  );

  if (!res.ok) {
    return { ok: false, url: destPath, status: res.status, error: await res.text() };
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${destPath}`;
  return { ok: true, url: publicUrl };
}

async function verifyPublic(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const files = listWebP();
  console.log(`Encontrados ${files.length} .webp en ${SOURCE_DIR}:`);
  for (const f of files) console.log(`  - ${f}`);

  if (!EXECUTE) {
    console.log("\n[dry-run] Se subirían a:");
    for (const f of files) {
      console.log(`  ${supabaseUrl}/storage/v1/object/public/${BUCKET}/${DEST_PREFIX}/${f}`);
    }
    console.log("\nReejecuta con --execute para subir.");
    return;
  }

  console.log(`\nSubiendo a bucket "${BUCKET}" (${supabaseUrl})...\n`);

  const results: Array<{ file: string; ok: boolean; url: string; status?: number; error?: string }> = [];

  for (const file of files) {
    const r = await uploadFile(file);
    results.push({ file, ...r });
    if (r.ok) {
      console.log(`  ✔ ${file} → ${r.url}`);
    } else {
      console.error(`  ✖ ${file} (${r.status}) ${r.error}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\nFallaron ${failed.length} subidas.`);
    process.exit(1);
  }

  if (VERIFY) {
    console.log("\nVerificando lectura anónima (HEAD)...");
    for (const r of results) {
      const ok = await verifyPublic(r.url);
      console.log(`  ${ok ? "✔" : "✖"} ${r.url}`);
    }
  }

  console.log("\n--- Resumen URLs CDN ---");
  for (const r of results) console.log(r.url);
  console.log("\nLISTO.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});