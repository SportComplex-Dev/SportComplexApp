import { z } from "zod";

// Validador estricto para ID de servicio: acepta enteros positivos
// o strings numéricos que representan enteros positivos, rechazando booleanos (ej. true -> 1).
const positiveIntServiceIdSchema = z.union([
  z.number().int().positive({ message: "El ID de servicio debe ser un entero positivo." }),
  z
    .string()
    .regex(/^[1-9]\d*$/, "El ID de servicio debe ser un número entero positivo.")
    .transform(Number),
]);

// RF-13/RF-14 — lectura QR + turno
export const accessScanSchema = z.object({
  ticketId: z.uuid(), // contenido del QR = ticket_qr.codigo_uuid (UUIDv4)
  // HMAC-SHA256 sobre el código (QR_HMAC_SECRET): 32 bytes en hex = 64 chars.
  // Normalizado a minúsculas para coincidir exactamente con el digest de Node crypto
  signature: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "La firma debe ser un HMAC-SHA256 en hexadecimal.")
    .transform((s) => s.toLowerCase()),
  // servicio del puesto seleccionado; FK a servicio.id (Int) — null = modo consulta
  postServiceId: positiveIntServiceIdSchema.nullable(),
});

export type AccessScan = z.infer<typeof accessScanSchema>;

// RF-13 (HU-14 / TSK-BE-14) — canje de ticket en modo turno
export const accessRedeemSchema = z.object({
  ticketId: z.uuid(), // contenido del QR = ticket_qr.codigo_uuid (UUIDv4)
  // HMAC-SHA256 sobre el código (QR_HMAC_SECRET): 32 bytes en hex = 64 chars.
  // Normalizado a minúsculas para coincidir exactamente con el digest de Node crypto
  signature: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "La firma debe ser un HMAC-SHA256 en hexadecimal.")
    .transform((s) => s.toLowerCase()),
  // servicio del puesto seleccionado; FK a servicio.id (Int) — obligatorio en modo turno
  postServiceId: positiveIntServiceIdSchema,
});

export type AccessRedeem = z.infer<typeof accessRedeemSchema>;

