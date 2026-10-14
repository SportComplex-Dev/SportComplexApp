import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cliente de BD aceptado por los repositorios.
 *
 * En producción siempre es `PrismaClient` (o su cliente transaccional).
 * En tests se inyecta el doble de `test/mocks` (`createMockPrisma`), que
 * replica por duck-typing los delegados usados (`_state` + modelos +
 * `$transaction`). Los tests no se verifican con tsc (ver `tsconfig`),
 * así que el contrato con el mock vive en `test/mocks/*.ts`, no aquí.
 */
export type ClienteDb = PrismaClient | Prisma.TransactionClient;

/** Cliente dentro de `$transaction` (producción: `Prisma.TransactionClient`). */
export type TxDb = Prisma.TransactionClient;

/** Re-export para filtros de escritura sin importar `@prisma/client` en cada repo. */
export type { Prisma };
