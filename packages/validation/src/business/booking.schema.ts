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

const cartItemSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  cantidadCupos: z.coerce.number().int().positive().default(1),
});

const legacyCartCheckoutSchema = z.object({
  items: z.array(z.object({
    serviceId: cartItemSchema.shape.serviceId,
    startTime: cartItemSchema.shape.startTime,
    endTime: cartItemSchema.shape.endTime,
    cantidadCupos: cartItemSchema.shape.cantidadCupos,
  })).min(2),
});

const continuousCartCheckoutSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  franjas: z.array(z.object({ inicio: z.iso.datetime(), fin: z.iso.datetime() })).min(2),
}).superRefine(({ franjas }, ctx) => {
  franjas.forEach((franja, index) => {
    const inicio = Date.parse(franja.inicio);
    const fin = Date.parse(franja.fin);
    if (fin <= inicio) {
      ctx.addIssue({ code: "custom", path: ["franjas", index, "fin"], message: "La hora de fin debe ser posterior al inicio." });
    }
    if (index > 0 && inicio !== Date.parse(franjas[index - 1]!.fin)) {
      ctx.addIssue({ code: "custom", path: ["franjas", index, "inicio"], message: "Las franjas deben ser consecutivas y estar ordenadas." });
    }
  });
}).transform(({ serviceId, franjas }) => ({
  mode: "continuous" as const,
  items: franjas.map(({ inicio, fin }) => ({ serviceId, startTime: inicio, endTime: fin, cantidadCupos: 1 })),
}));

export const cartCheckoutSchema = z.union([
  legacyCartCheckoutSchema.transform(({ items }) => ({ mode: "cart" as const, items })),
  continuousCartCheckoutSchema,
]);

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
export const adminBookingsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z
      .enum([
        "CONFIRMADA",
        "PENDIENTE",
        "PENDIENTE_PAGO",
        "EXPIRADA",
        "CANCELADA_ADMINISTRATIVA",
        "CANCELADA_PAGO",
        "CANCELADA",
      ])
      .optional(),
    serviceId: z.coerce.number().int().positive().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    search: z.string().trim().max(100).optional(),
  })
  .refine(
    (data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo,
    {
      message: "dateFrom must be earlier than or equal to dateTo",
      path: ["dateTo"],
    },
  );

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
