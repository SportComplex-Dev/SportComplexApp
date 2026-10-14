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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = new pg.Pool({ connectionString, family: 4, ssl: sslConfig } as any);
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __scPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__scPrisma ?? crearClientePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.__scPrisma = prisma;
