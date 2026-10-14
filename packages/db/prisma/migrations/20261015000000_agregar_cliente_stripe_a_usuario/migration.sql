-- Migración 4.1: Agregar cliente Stripe a Usuario
-- Contract: 20261015000000_agregar_cliente_stripe_a_usuario: stripe_customer_id VARCHAR(100) UNIQUE + índice.
-- Prisma: clienteStripeId String? @unique @map("stripe_customer_id")

ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS "usuario_stripe_customer_id_key" ON "usuario"("stripe_customer_id");
