import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    if (typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env.local"));
      } catch {}
      try {
        process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env"));
      } catch {}
    }
  } catch {}
}

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

// Supabase Transaction / Session Pooler requiere IPv4 (family: 4) y terminación TLS.
// rejectUnauthorized: false permite conectar a poolers de Supabase sin bundle de certificados CA local.
const isLocal = connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");
const sslConfig = isLocal ? false : { rejectUnauthorized: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pool = new pg.Pool({ connectionString, family: 4, ssl: sslConfig } as any);
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { __scPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__scPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.__scPrisma = prisma;
