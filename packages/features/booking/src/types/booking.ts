import { z } from "zod";

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

export const bookingRequestSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  cantidadCupos: z.coerce.number().int().positive().default(1),
  titularId: z.string().uuid().optional(),
  canal: z.enum(["ONLINE", "TAQUILLA"]).optional(),
});

export type SingleLockPayload = z.infer<typeof singleLockPayloadSchema>;
export type LockCartPayload = z.infer<typeof lockCartPayloadSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
