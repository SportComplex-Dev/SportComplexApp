import { z } from "zod";

// RF-13/RF-14 — lectura QR + turno
export const accessScanSchema = z.object({
  ticketId: z.uuid(), // contenido del QR = ticket_qr.codigo_uuid (UUIDv4)
  signature: z.string().min(32), // HMAC-SHA256 sobre el código (QR_HMAC_SECRET)
  // servicio del puesto seleccionado; FK a servicio.id (Int) — null = modo consulta
  postServiceId: z.coerce.number().int().positive().nullable(),
});

export type AccessScan = z.infer<typeof accessScanSchema>;
