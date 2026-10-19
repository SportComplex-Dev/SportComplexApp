import { z } from "zod";

// Single source of truth para el boundary de API: packages/validation.
// Los schemas de bloqueo son dominio del carrito cliente (llevan `date` y min(1),
// a diferencia de cartCheckoutSchema del API que exige min(2)): se quedan aquí.
export {
  bookingRequestSchema,
  type BookingRequest,
} from "@sportcomplex/validation";

export const singleLockPayloadSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.string().min(10),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  cantidadCupos: z.coerce.number().int().positive().default(1),
});

export const lockCartPayloadSchema = z.object({
  items: z.array(singleLockPayloadSchema).min(1),
});

export const continuousLockCartPayloadSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  franjas: z.array(z.object({
    inicio: z.string().datetime(),
    fin: z.string().datetime(),
  })).min(2),
});

export type SingleLockPayload = z.infer<typeof singleLockPayloadSchema>;
export type LockCartPayload = z.infer<typeof lockCartPayloadSchema>;
export type ContinuousLockCartPayload = z.infer<typeof continuousLockCartPayloadSchema>;
