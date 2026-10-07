import { z } from "zod";

// RF-04/RF-05/RF-08 — aforo, ventana y bloqueo temporal.
export const bookingRequestSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  cantidadCupos: z.coerce.number().int().positive().default(1),
});

export const availabilityQuerySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.iso.date(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
