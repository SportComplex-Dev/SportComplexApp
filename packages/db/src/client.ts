import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pool = new pg.Pool({ connectionString, family: 4 } as any);
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { __scPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__scPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.__scPrisma = prisma;