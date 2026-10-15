import {
  createPosCheckoutPostHandler,
  type PosCheckoutHandlerDependencies,
} from "@sportcomplex/features-pos";
import { authorizeApiRequest } from "@/lib/api/api-auth";
import type { CanonicalRole } from "@/lib/auth/session";
import { fail, ok } from '@sportcomplex/shared/lib';
import { prisma } from "@sportcomplex/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { PosCheckoutHandlerDependencies };
export { createPosCheckoutPostHandler };

export const POST = createPosCheckoutPostHandler({
  // `authorizeApiRequest` exige `readonly CanonicalRole[]`; el POS solo
  // inyecta "Empleado_Vendedor"/"Administrador", siempre miembros válidos.
  authorize: (allowedRoles: readonly string[]) =>
    authorizeApiRequest(allowedRoles as readonly CanonicalRole[]),
  db: prisma,
  ok: (data) => ok(data),
  fail,
});
