import { fail } from "@/lib/api-response";
import { authorizeApiRoles } from "@/lib/api-auth";

// RNF-05 — comprobante PDF con QR centrado (plantilla @sportcomplex/ui ticket-receipt)
export async function GET() {
  try {
    const denied = await authorizeApiRoles(["Cliente"]);
    if (denied) return denied;
    return fail("NOT_IMPLEMENTED", "Emisión PDF pendiente (feature/pdf-receipt-simulation)", 501);
  } catch (error: unknown) {
    console.error("Error en GET /api/pdf:", error);
    return fail("SERVER_ERROR", "No fue posible emitir el comprobante.", 500);
  }
}
