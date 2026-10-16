import { z } from "zod";

// RF-04/RF-05/RF-08 — aforo, ventana y bloqueo temporal.
export const bookingRequestSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  cantidadCupos: z.coerce.number().int().positive().default(1),
  titularId: z.string().uuid().optional(),
  canal: z.enum(["ONLINE", "TAQUILLA"]).optional(),
});

export const cartCheckoutSchema = z.object({
  items: z.array(z.object({
    serviceId: z.coerce.number().int().positive(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    cantidadCupos: z.coerce.number().int().positive().default(1),
  })).min(2),
});

export const availabilityQuerySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.iso.date(),
});

// RF-17 / TSK-FE-18 / TSK-BE-18 — Venta en Taquilla POS 100% Cashless (Stripe)
export const posCheckoutSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  disponibilidadId: z.union([z.string(), z.number()]).optional(),
  date: z.string().min(10),
  slotTime: z.string().min(3),
  cantidadCupos: z.coerce.number().int().positive().default(1),
  clienteNombre: z.string().min(2, "El nombre del cliente es obligatorio"),
  clienteDocumento: z.string().min(4, "El documento o cédula es obligatorio"),
  clienteEmail: z.string().email("Correo electrónico inválido"),
  clienteTelefono: z.string().optional().default(""),
  esSocio: z.boolean().default(false),
  // 100% Cashless: solo se admite tarjeta Stripe o enlace alternativo (Stripe link / QR móvil)
  paymentMode: z.enum(["stripe_card", "stripe_link"]).default("stripe_card"),
  cardLast4: z.string().optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
export type CartCheckoutRequest = z.infer<typeof cartCheckoutSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type PosCheckoutRequest = z.infer<typeof posCheckoutSchema>;

// TSK-BE-27 / SCRUM-212 — Filtros de consulta administrativa de reservas
export const adminBookingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum([
    "CONFIRMADA",
    "PENDIENTE_PAGO",
    "EXPIRADA",
    "CANCELADA_ADMINISTRATIVA",
    "CANCELADA_PAGO",
    "CANCELADA",
  ]).optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato dateFrom inválido (YYYY-MM-DD)").optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato dateTo inválido (YYYY-MM-DD)").optional(),
  search: z.string().trim().max(100).optional(),
});

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
