/**
 * backup-prod — backup completo de la BD de producción (SCRUM-222 / TSK-BD-01).
 *
 * Fases por subcomando:
 *   dump    pg_dump SQL completo + pg_dumpall --globals-only (roles, sin
 *           passwords) + snapshot de identidades Supabase Auth (Admin API) +
 *           manifiesto SHA-256 con conteo de filas por tabla.
 *   encrypt tar.gz del run + GPG simétrico AES-256 + prueba de roundtrip
 *           (descifra y compara hash sin escribir el .tar.gz en claro).
 *   verify  cluster PostgreSQL local transitorio (initdb/pg_ctl) → restaura el
 *           dump filtrando extensiones exclusivas de Supabase → compara el
 *           conteo de filas por tabla contra el manifiesto remoto.
 *   upload  bucket privado en Supabase Storage + verificación de hash
 *           descargando el objeto subido.
 *   all     dump → encrypt → verify → upload (orden que valida el CA: el
 *           backup solo se considera bueno si la restauración local coincide).
 *
 * Uso (desde packages/db):
 *   pnpm backup all
 *   pnpm backup dump | encrypt | verify | upload
 *
 * Variables (apps/web/.env.backup.local — gitignored):
 *   BACKUP_DATABASE_URL               pooler de sesión (:5432) de producción
 *   BACKUP_SUPABASE_URL               https://<ref>.supabase.co
 *   BACKUP_SUPABASE_SERVICE_ROLE_KEY  service role (Admin API + Storage)
 *   BACKUP_GPG_PASSPHRASE             frase del .gpg (obligatoria salvo en dump)
 *   BACKUP_STORAGE_BUCKET             bucket destino (default: backups)
 *   BACKUP_PG_BIN / GPG_BIN           rutas opcionales a herramientas
 *
 * Salida: backups/<ISO con guiones>/ (gitignored). El host de la URL de BD
 * debe ser siempre el proyecto de producción; el script aborta si no coincide.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import { Client } from "pg";

const PROJECT_REF = "phyesjwtzrmrcvmtajay";
const SUPABASE_ROLES = [
  "anon",
  "authenticated",
  "service_role",
  "supabase_admin",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "supabase_realtime_admin",
  "supabase_functions_admin",
  "dashboard_user",
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const RUNS_DIR = path.join(REPO_ROOT, "backups");
const ENV_FILE = path.resolve(SCRIPT_DIR, "../../../apps/web/.env.backup.local");

dotenvConfig({ path: ENV_FILE });

const ENV = {
  databaseUrl: process.env.BACKUP_DATABASE_URL ?? "",
  supabaseUrl: (process.env.BACKUP_SUPABASE_URL ?? "").replace(/\/$/, ""),
  serviceKey: process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY ?? "",
  passphrase: process.env.BACKUP_GPG_PASSPHRASE ?? "",
  bucket: process.env.BACKUP_STORAGE_BUCKET || "backups",
};

function requireEnv(needsPassphrase: boolean): void {
  const required: Array<[string, string]> = [
    ["BACKUP_DATABASE_URL", ENV.databaseUrl],
    ["BACKUP_SUPABASE_URL", ENV.supabaseUrl],
    ["BACKUP_SUPABASE_SERVICE_ROLE_KEY", ENV.serviceKey],
  ];
  if (needsPassphrase) required.push(["BACKUP_GPG_PASSPHRASE", ENV.passphrase]);
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Faltan variables en ${ENV_FILE}: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!ENV.databaseUrl.includes(PROJECT_REF)) {
    console.error(`BACKUP_DATABASE_URL no apunta al proyecto de producción ${PROJECT_REF}. Abortando.`);
    process.exit(1);
  }
}

function findPgTool(name: string): string {
  const exe = `${name}.exe`;
  const candidates: string[] = [];
  if (process.env.BACKUP_PG_BIN) candidates.push(path.join(process.env.BACKUP_PG_BIN, exe));
  const toolsRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "SportComplexTools") : null;
  if (toolsRoot && existsSync(toolsRoot)) {
    for (const entry of readdirSync(toolsRoot)) {
      if (/^postgresql-/i.test(entry)) candidates.push(path.join(toolsRoot, entry, "pgsql", "bin", exe));
    }
  }
  candidates.push(exe);
  for (const candidate of candidates) {
    if (candidate === exe || existsSync(candidate)) return candidate;
  }
  return exe;
}

function findGpg(): string {
  if (process.env.GPG_BIN && existsSync(process.env.GPG_BIN)) return process.env.GPG_BIN;
  for (const candidate of [
    "C:\\Program Files\\Git\\usr\\bin\\gpg.exe",
    "C:\\Program Files (x86)\\GnuPG\\bin\\gpg.exe",
    "C:\\Program Files\\Gpg4win\\bin\\gpg.exe",
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return "gpg";
}

interface PgConn {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function parsePgUrl(url: string): PgConn {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
  };
}

function pgEnv(_conn: PgConn): NodeJS.ProcessEnv {
  return { ...process.env };
}

function psqlBase(conn: { host: string; port: number; user: string }): string[] {
  return ["-h", conn.host, "-p", String(conn.port), "-U", conn.user, "--no-psqlrc"];
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(
  cmd: string,
  args: string[],
  opts: { input?: string; env?: NodeJS.ProcessEnv; allowFail?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: opts.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
    child.on("error", reject);
    // Resolvemos en "exit" y no en "close": pg_ctl/heredados dejan pipes de
    // stdio abiertos por el postgres daemon, y "close" nunca llegaría.
    child.on("exit", (code) => {
      const result = { code: code ?? -1, stdout, stderr };
      if (code !== 0 && !opts.allowFail) {
        reject(new Error(`${path.basename(cmd)} ${args[0] ?? ""} falló (code ${code}):\n${stderr.slice(-2000)}`));
        return;
      }
      resolve(result);
    });
  });
}

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function sha256File(file: string): Promise<string> {
  return sha256(await readFile(file));
}

function gpgDecryptToHash(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      findGpg(),
      ["--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-fd", "0", "-d", file],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const hash = createHash("sha256");
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => hash.update(chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.stdin.write(ENV.passphrase);
    child.stdin.end();
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(hash.digest("hex"));
      else reject(new Error(`gpg decrypt falló (code ${code}): ${stderr.slice(-1000)}`));
    });
  });
}

function latestRunDir(): string {
  if (!existsSync(RUNS_DIR)) {
    console.error("No existe backups/. Ejecuta primero: pnpm backup dump");
    process.exit(1);
  }
  const candidates: string[] = [];
  if (existsSync(RUNS_DIR)) {
    for (const entry of readdirSync(RUNS_DIR)) {
      const full = path.join(RUNS_DIR, entry);
      if (statSync(full).isDirectory()) candidates.push(full);
    }
  }
  const altDir = path.resolve("C:/SC");
  if (existsSync(altDir)) {
    for (const entry of readdirSync(altDir)) {
      const full = path.join(altDir, entry);
      if (entry === "verify-cluster") continue;
      if (statSync(full).isDirectory() && !candidates.includes(entry)) candidates.push(full);
    }
  }
  const dirs = candidates.sort();
  const last = dirs[dirs.length - 1];
  if (!last) {
    console.error("No hay runs en backups/. Ejecuta primero: pnpm backup dump");
    process.exit(1);
  }
  return last;
}

async function freePort(start: number): Promise<number> {
  for (let port = start; port < start + 30; port += 1) {
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error("Sin puerto libre para el cluster de verificación");
}

async function snapshotAuthUsers(runDir: string): Promise<number> {
  const users: unknown[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const res = await fetch(`${ENV.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: { apikey: ENV.serviceKey, Authorization: `Bearer ${ENV.serviceKey}` },
    });
    if (!res.ok) throw new Error(`Admin API users falló: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { users?: unknown[] };
    const batch = body.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  const file = path.join(runDir, `auth_users_snapshot_${path.basename(runDir)}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { projectRef: PROJECT_REF, exportedAt: new Date().toISOString(), count: users.length, users },
      null,
      2,
    ),
  );
  return users.length;
}

const COUNTABLE_RELATIONS_SQL = `
  SELECT n.nspname AS schema, c.relname AS table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg\\_%'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    )
  ORDER BY 1, 2`;

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function tableCounts(client: Client): Promise<Record<string, number>> {
  const rels = await client.query<{ schema: string; table: string }>(COUNTABLE_RELATIONS_SQL);
  const counts: Record<string, number> = {};
  for (const { schema, table } of rels.rows) {
    const row = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${quoteIdent(schema)}.${quoteIdent(table)}`,
    );
    counts[`${schema}.${table}`] = row.rows[0].n;
  }
  return counts;
}

function remoteClient(conn: PgConn, overrides: Partial<PgConn> = {}): Client {
  return new Client({
    host: overrides.host ?? conn.host,
    port: overrides.port ?? conn.port,
    user: overrides.user ?? conn.user,
    password: overrides.password ?? conn.password,
    database: overrides.database ?? conn.database,
    connectionTimeoutMillis: 20000,
  });
}

interface Manifest {
  task: string;
  jira: string;
  projectRef: string;
  generatedAt: string;
  files: Array<{ name: string; bytes: number; sha256: string }>;
  remoteRows: Record<string, number>;
  authIdentities: { fromAdminApi: number };
  [key: string]: unknown;
}

async function cmdDump(): Promise<string> {
  requireEnv(false);
  const conn = parsePgUrl(ENV.databaseUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(RUNS_DIR, stamp);
  mkdirSync(runDir, { recursive: true });
  console.log(`Run: ${runDir}`);

  const dumpFile = path.join(runDir, "backup_prod_pre_purge.sql");
  const globalsFile = path.join(runDir, "globals_roles.sql");

  console.log("→ pg_dump (SQL completo, sin owner ni ACL)…");
  const pgDumpVersion = await run(findPgTool("pg_dump"), ["--version"]);
  await run(findPgTool("pg_dump"), [
    "--no-owner",
    "--no-privileges",
    "--dbname", ENV.databaseUrl,
    "-f", dumpFile,
  ], { env: pgEnv(conn) });

  console.log("→ pg_dumpall --globals-only (roles sin passwords)…");
  await run(findPgTool("pg_dumpall"), [
    "--globals-only",
    "--no-role-passwords",
    "--dbname", ENV.databaseUrl,
    "-f", globalsFile,
  ], { env: pgEnv(conn) });

  console.log("→ snapshot Supabase Auth (Admin API)…");
  const authCount = await snapshotAuthUsers(runDir);

  console.log("→ conteo de filas por tabla (producción)…");
  const client = remoteClient(conn);
  await client.connect();
  let remoteRows: Record<string, number>;
  try {
    remoteRows = await tableCounts(client);
  } finally {
    await client.end();
  }

  const manifest: Manifest = {
    task: "TSK-BD-01",
    jira: "SCRUM-222",
    projectRef: PROJECT_REF,
    generatedAt: new Date().toISOString(),
    files: [],
    remoteRows,
    authIdentities: { fromAdminApi: authCount },
  };
  for (const name of ["backup_prod_pre_purge.sql", "globals_roles.sql"]) {
    const file = path.join(runDir, name);
    manifest.files.push({ name, bytes: statSync(file).size, sha256: await sha256File(file) });
  }
  const snapshotName = `auth_users_snapshot_${stamp}.json`;
  const snapshotFile = path.join(runDir, snapshotName);
  manifest.files.push({ name: snapshotName, bytes: statSync(snapshotFile).size, sha256: await sha256File(snapshotFile) });

  writeFileSync(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nDump OK — ${Object.keys(remoteRows).length} tablas, ${authCount} identidades Auth.`);
  console.log(pgDumpVersion.stdout.trim());
  return runDir;
}

async function cmdEncrypt(): Promise<void> {
  requireEnv(true);
  const runDir = latestRunDir();
  const tarPath = path.join(runDir, "backup-prod.tar.gz");
  const gpgPath = `${tarPath}.gpg`;

  const members = readdirSync(runDir).filter(
    (file) => !file.endsWith(".tar.gz") && !file.endsWith(".gpg") && file !== "verify-report.json" && file !== "backup-report.json",
  );
  console.log(`→ tar.gz de ${members.length} archivos…`);
  await run("tar", ["-czf", tarPath, "-C", runDir, ...members]);

  console.log("→ GPG AES-256 simétrico…");
  const tarSha = await sha256File(tarPath);
  await run(findGpg(), [
    "--batch",
    "--yes",
    "--pinentry-mode", "loopback",
    "--passphrase-fd", "0",
    "--symmetric",
    "--cipher-algo", "AES256",
    "-o", gpgPath,
    tarPath,
  ], { input: ENV.passphrase });
  rmSync(tarPath);

  const decryptedSha = await gpgDecryptToHash(gpgPath);
  if (tarSha !== decryptedSha) {
    throw new Error("Roundtrip GPG falló: el hash descifrado no coincide con el original.");
  }
  writeFileSync(
    path.join(runDir, "encrypt-report.json"),
    JSON.stringify(
      { encryptedAt: new Date().toISOString(), cipher: "AES256", tarSha256: tarSha, gpgBytes: statSync(gpgPath).size },
      null,
      2,
    ),
  );

  console.log(`Encrypt OK — ${path.basename(gpgPath)} (${statSync(gpgPath).size} bytes, roundtrip verificado).`);
}

interface VerifyReport {
  ok: boolean;
  runDir: string;
  checkedAt: string;
  missingExtensions: string[];
  remoteTables: number;
  localTables: number;
  missingTables: string[];
  rowMismatches: string[];
  error?: string;
}

const SUPABASE_ROLES_SQL = `
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[${SUPABASE_ROLES.map((role) => `'${role}'`).join(",")}] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I', r);
    END IF;
  END LOOP;
END $$;`;

async function cmdVerify(): Promise<void> {
  requireEnv(false);
  const runDir = latestRunDir();
  const dumpFile = path.join(runDir, "backup_prod_pre_purge.sql");
  const raw = readFileSync(dumpFile, "utf8");

  const createExtRe = /^CREATE EXTENSION\s+IF NOT EXISTS\s+("?)([\w-]+)\1/i;
  const alterExtRe = /^ALTER EXTENSION\s+("?)([\w-]+)\1/i;
  const commentExtRe = /^COMMENT ON EXTENSION\s+("?)([\w-]+)\1/i;
  const dumpExtensions = new Set<string>();
  for (const line of raw.split("\n")) {
    const match = createExtRe.exec(line);
    if (match) dumpExtensions.add(match[2]);
  }

  const conn = parsePgUrl(ENV.databaseUrl);
  const port = await freePort(54331);
  const clusterDir = path.resolve("C:/SC/verify-cluster");
  rmSync(clusterDir, { recursive: true, force: true });

  console.log(`→ initdb en ${clusterDir} (puerto ${port})…`);
  await run(findPgTool("initdb"), ["-D", clusterDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"]);
  await run(findPgTool("pg_ctl"), [
    "-D", clusterDir,
    "-l", path.join(runDir, "verify-cluster.log"),
    "-w",
    "-t", "120",
    "-o", `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
    "start",
  ]);

  try {
    console.log("→ roles Supabase locales…");
    await run(findPgTool("psql"), [...psqlBase({ host: "127.0.0.1", port, user: "postgres" }), "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", SUPABASE_ROLES_SQL]);

    const localAdmin = remoteClient(conn, { host: "127.0.0.1", port, user: "postgres", password: "", database: "postgres" });
    await localAdmin.connect();
    let missingExtensions: string[] = [];
    let localRows: Record<string, number> = {};
    // Schemas que pertenecen a extensiones exclusivas de Supabase: si la
    // extensión falta localmente, sus tablas tampoco existen y hay que
    // saltar también sus bloques COPY de datos.
    const EXT_OWNED_SCHEMAS: Record<string, string[]> = { supabase_vault: ["vault"] };
    let skippedSchemas = new Set<string>();
    try {
      const avail = await localAdmin.query<{ name: string }>("SELECT name FROM pg_available_extensions");
      const availSet = new Set(avail.rows.map((row) => row.name));
      missingExtensions = [...dumpExtensions].filter((name) => !availSet.has(name));
      skippedSchemas = new Set(missingExtensions.flatMap((name) => EXT_OWNED_SCHEMAS[name] ?? []));

      const verifyFile = path.join(runDir, "backup_prod_pre_purge.verify.sql");
      const copySchemaRe = /^COPY\s+("?)([\w-]+)\1\s*\./i;
      const lines = raw.split("\n");
      const outLines: string[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const create = createExtRe.exec(line);
        if (create && missingExtensions.includes(create[2])) {
          outLines.push(line.replace(/^CREATE EXTENSION/, "-- TSK-BD-01: extensión Supabase omitida localmente → CREATE EXTENSION"));
          continue;
        }
        const alter = alterExtRe.exec(line);
        if (alter && missingExtensions.includes(alter[2])) {
          outLines.push(`-- TSK-BD-01: extensión Supabase omitida localmente → ${line}`);
          continue;
        }
        const comment = commentExtRe.exec(line);
        if (comment && missingExtensions.includes(comment[2])) {
          outLines.push(`-- TSK-BD-01: extensión Supabase omitida localmente → ${line}`);
          continue;
        }
        const copy = copySchemaRe.exec(line);
        if (copy && skippedSchemas.has(copy[2])) {
          outLines.push(`-- TSK-BD-01: datos de schema ${copy[2]} omitidos (extensión Supabase ausente) → ${line}`);
          while (i + 1 < lines.length && lines[i + 1] !== "\\.") {
            i += 1;
            outLines.push(`-- TSK-BD-01: ${lines[i]}`);
          }
          if (i + 1 < lines.length && lines[i + 1] === "\\.") {
            i += 1;
            outLines.push(`-- TSK-BD-01: ${lines[i]}`);
          }
          continue;
        }
        outLines.push(line);
      }
      const filtered = outLines.join("\n");
      writeFileSync(verifyFile, filtered);
      if (missingExtensions.length > 0) {
        console.log(`→ extensiones omitidas localmente (exclusivas de Supabase): ${missingExtensions.join(", ")}`);
      }

      console.log("→ restauración del dump en el cluster local…");
      const restore = await run(
        findPgTool("psql"),
        [...psqlBase({ host: "127.0.0.1", port, user: "postgres" }), "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", verifyFile],
        { allowFail: true },
      );
      if (restore.code !== 0) {
        const report: VerifyReport = {
          ok: false,
          runDir,
          checkedAt: new Date().toISOString(),
          missingExtensions,
          remoteTables: 0,
          localTables: 0,
          missingTables: [],
          rowMismatches: [],
          error: restore.stderr.slice(-4000),
        };
        writeFileSync(path.join(runDir, "verify-report.json"), JSON.stringify(report, null, 2));
        throw new Error(`VERIFY FALLÓ — la restauración local devolvió errores:\n${report.error}`);
      }

      console.log("→ comparación de conteos por tabla…");
      localRows = await tableCounts(localAdmin);
    } finally {
      await localAdmin.end();
    }

    const manifest = JSON.parse(readFileSync(path.join(runDir, "manifest.json"), "utf8")) as Manifest;
    const missingTables: string[] = [];
    const rowMismatches: string[] = [];
    for (const [table, expected] of Object.entries(manifest.remoteRows)) {
      if (skippedSchemas.has(table.split(".")[0])) continue;
      const actual = localRows[table];
      if (actual === undefined) missingTables.push(table);
      else if (actual !== expected) rowMismatches.push(`${table}: producción=${expected} local=${actual}`);
    }

    const ok = missingTables.length === 0 && rowMismatches.length === 0;
    const report: VerifyReport = {
      ok,
      runDir,
      checkedAt: new Date().toISOString(),
      missingExtensions,
      remoteTables: Object.keys(manifest.remoteRows).length,
      localTables: Object.keys(localRows).length,
      missingTables,
      rowMismatches,
    };
    writeFileSync(path.join(runDir, "verify-report.json"), JSON.stringify(report, null, 2));

    if (!ok) {
      const detail = [
        missingTables.length > 0 ? `Ausentes: ${missingTables.slice(0, 20).join(", ")}` : "",
        rowMismatches.length > 0 ? rowMismatches.slice(0, 20).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
      throw new Error(
        `VERIFY FALLÓ — tablas ausentes: ${missingTables.length}, filas distintas: ${rowMismatches.length}\n${detail}`,
      );
    }
    console.log(`\nVERIFY OK — ${report.remoteTables} tablas restauradas con conteos idénticos a producción.`);
  } finally {
    await run(findPgTool("pg_ctl"), ["-D", clusterDir, "-m", "immediate", "-w", "stop"], { allowFail: true, env: { ...process.env } });
    rmSync(clusterDir, { recursive: true, force: true });
  }
}

async function cmdUpload(): Promise<void> {
  requireEnv(true);
  const runDir = latestRunDir();
  const gpgFile = path.join(runDir, "backup-prod.tar.gz.gpg");
  const manifestFile = path.join(runDir, "manifest.json");
  const verifyFile = path.join(runDir, "verify-report.json");
  const stamp = path.basename(runDir);
  const prefix = `tsk-bd-01/${stamp}`;

  const jsonHeaders = {
    apikey: ENV.serviceKey,
    Authorization: `Bearer ${ENV.serviceKey}`,
    "Content-Type": "application/json",
  };

  console.log(`→ bucket "${ENV.bucket}"…`);
  const bucketRes = await fetch(`${ENV.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id: ENV.bucket, name: "Backups TSK-BD-01", public: false }),
  });
  if (!bucketRes.ok && bucketRes.status !== 409) {
    const body = await bucketRes.text();
    // Supabase responde HTTP 400 con code "BucketAlreadyExists" si ya existe.
    if (!body.includes("BucketAlreadyExists") && !body.includes('"statusCode":409')) {
      throw new Error(`Crear bucket falló: ${bucketRes.status} ${body}`);
    }
  }

  const uploads: Array<[string, string]> = [[gpgFile, "application/octet-stream"], [manifestFile, "application/json"]];
  if (existsSync(verifyFile)) uploads.push([verifyFile, "application/json"]);

  const gpgSha = await sha256File(gpgFile);
  for (const [file, contentType] of uploads) {
    const objectPath = `${prefix}/${path.basename(file)}`;
    console.log(`→ subiendo ${objectPath}…`);
    const res = await fetch(`${ENV.supabaseUrl}/storage/v1/object/${ENV.bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: ENV.serviceKey,
        Authorization: `Bearer ${ENV.serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: await readFile(file),
    });
    if (!res.ok) throw new Error(`Upload ${path.basename(file)} falló: ${res.status} ${await res.text()}`);
  }

  console.log("→ verificación de objetos subidos…");
  const listRes = await fetch(`${ENV.supabaseUrl}/storage/v1/object/list/${ENV.bucket}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ prefix, limit: 100 }),
  });
  if (!listRes.ok) throw new Error(`List falló: ${listRes.status} ${await listRes.text()}`);
  const listed = (await listRes.json()) as Array<{ name: string }>;
  // El listado con prefix devuelve "name" relativo al prefix, no la ruta completa.
  const expected = uploads.map(([file]) => path.basename(file));
  for (const name of expected) {
    if (!listed.some((entry) => entry.name === name)) throw new Error(`El objeto ${name} no aparece en el listado del bucket.`);
  }

  const dl = await fetch(`${ENV.supabaseUrl}/storage/v1/object/${ENV.bucket}/${prefix}/backup-prod.tar.gz.gpg`, {
    headers: { apikey: ENV.serviceKey, Authorization: `Bearer ${ENV.serviceKey}` },
  });
  if (!dl.ok) throw new Error(`Descarga de verificación falló: ${dl.status}`);
  const remoteSha = sha256(Buffer.from(await dl.arrayBuffer()));
  if (remoteSha !== gpgSha) throw new Error("El hash del .gpg descargado no coincide con el local.");

  const report = {
    bucket: ENV.bucket,
    prefix,
    uploadedAt: new Date().toISOString(),
    files: uploads.map(([file]) => `${prefix}/${path.basename(file)}`),
    gpgSha256: gpgSha,
    hashDownloadVerified: true,
  };
  writeFileSync(path.join(runDir, "upload-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nUPLOAD OK — ${expected.length} objetos en ${ENV.bucket}/${prefix} (hash verificado por descarga).`);
}

async function cmdAll(): Promise<void> {
  const started = Date.now();
  await cmdDump();
  await cmdEncrypt();
  await cmdVerify();
  await cmdUpload();
  const runDir = latestRunDir();
  const summary = {
    task: "TSK-BD-01",
    completedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - started) / 1000),
    runDir: path.relative(REPO_ROOT, runDir),
    artifact: "backups (bucket privado Supabase Storage)",
  };
  writeFileSync(path.join(runDir, "backup-report.json"), JSON.stringify(summary, null, 2));
  console.log(`\nBACKUP COMPLETO en ${summary.durationSeconds}s — CA satisfecho: dump verificado por restauración local y subido cifrado.`);
}

const command = process.argv[2] ?? "all";
const commands: Record<string, () => Promise<void>> = {
  dump: cmdDump,
  encrypt: cmdEncrypt,
  verify: cmdVerify,
  upload: cmdUpload,
  all: cmdAll,
};
const handler = commands[command];
if (!handler) {
  console.error(`Comando desconocido: ${command}. Usa: ${Object.keys(commands).join(" | ")}`);
  process.exit(1);
}
handler().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
