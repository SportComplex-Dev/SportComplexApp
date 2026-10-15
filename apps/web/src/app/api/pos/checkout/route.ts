import {
  createPosCheckoutPostHandler,
  type PosCheckoutHandlerDependencies,
} from "@sportcomplex/features-pos";
import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";
import { prisma } from "@sportcomplex/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { PosCheckoutHandlerDependencies };
export { createPosCheckoutPostHandler };

export const POST = createPosCheckoutPostHandler({
  authorize: authorizeApiRequest,
  db: prisma,
  ok: (data) => ok(data),
  fail,
});
