import { z } from "zod";

// RF-13/RF-14 — lectura QR + turno
export const accessScanSchema = z.object({
  ticketId: z.uuid(), // contenido del QR = ticket_qr.codigo_uuid (UUIDv4)
  // HMAC-SHA256 sobre el código (QR_HMAC_SECRET): 32 bytes en hex = 64 chars.
  signature: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "La firma debe ser un HMAC-SHA256 en hexadecimal."),
  // servicio del puesto seleccionado; FK a servicio.id (Int) — null = modo consulta
  postServiceId: z.coerce.number().int().positive().nullable(),
});

export type AccessScan = z.infer<typeof accessScanSchema>;
