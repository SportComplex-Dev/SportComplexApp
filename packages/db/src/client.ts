import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { __scPrisma?: PrismaClient };

function getPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__scPrisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__scPrisma = prisma;
