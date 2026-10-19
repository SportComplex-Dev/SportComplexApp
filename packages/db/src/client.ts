import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Factory para instanciar PrismaClient con adaptador PostgreSQL (pg.Pool).
 * Desacoplado de variables de entorno de apps/web: recibe cadena de conexión opcional o usa process.env.
 */
export function crearClientePrisma(cadenaConexion?: string): PrismaClient {
  const connectionString =
    cadenaConexion || process.env.DATABASE_URL || process.env.DIRECT_URL;

  // Supabase Transaction / Session Pooler requiere IPv4 (family: 4) y terminación TLS.
  // rejectUnauthorized: false permite conectar a poolers de Supabase sin bundle de certificados CA local.
  const isLocal =
    connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");
  const sslConfig = isLocal ? false : { rejectUnauthorized: false };

  // `family: 4` no existe en `pg.PoolConfig` pero el pooler de Supabase lo
  // requiere para forzar IPv4; el cast evita `any` sin cambiar runtime.
  const pool = new pg.Pool({ connectionString, family: 4, ssl: sslConfig } as pg.PoolConfig);
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __scPrisma?: PrismaClient };

/**
 * Composition root del cliente Prisma.
 *
 * `globalThis` evita abrir un pool nuevo en cada recarga de Next (HMR). Un
 * entorno de ejecución (SSR, scripts, pruebas) puede instalar su propio
 * cliente antes de importar los repositorios. Este módulo no consulta el
 * entorno ni contiene lógica de pruebas.
 */
export const prisma =
  globalForPrisma.__scPrisma ?? crearClientePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.__scPrisma = prisma;
