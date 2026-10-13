import { z } from "zod";

export const estadoTorneoSchema = z.enum([
  "BORRADOR",
  "INSCRIPCIONES_ABIERTAS",
  "EN_CURSO",
  "FINALIZADO",
  "CANCELADO",
]);
export type EstadoTorneoInput = z.infer<typeof estadoTorneoSchema>;

export const estadoInscripcionTorneoSchema = z.enum([
  "PENDIENTE_PAGO",
  "CONFIRMADA",
  "CANCELADA",
]);
export type EstadoInscripcionTorneoInput = z.infer<typeof estadoInscripcionTorneoSchema>;

const BOGOTA_TZ = "America/Bogota";
function getBogotaDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const torneoBloqueoInputSchema = z
  .object({
    servicioId: z.coerce.number().int().positive("El servicioId debe ser un número entero positivo"),
    horaInicio: z.iso.datetime({ offset: true, message: "horaInicio debe ser una fecha/hora ISO válida" }),
    horaFin: z.iso.datetime({ offset: true, message: "horaFin debe ser una fecha/hora ISO válida" }),
  })
  .refine(
    (data) => new Date(data.horaFin).getTime() > new Date(data.horaInicio).getTime(),
    {
      message: "horaFin debe ser posterior a horaInicio",
      path: ["horaFin"],
    },
  )
  .refine(
    (data) => getBogotaDateString(data.horaInicio) === getBogotaDateString(data.horaFin),
    {
      message: "El bloqueo de pista no puede cruzar la medianoche; debe pertenecer al mismo día calendario en America/Bogota",
      path: ["horaFin"],
    },
  );
export type TorneoBloqueoInput = z.infer<typeof torneoBloqueoInputSchema>;

export const createTournamentSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(120, "El título no puede exceder los 120 caracteres"),
    descripcion: z.string().trim().max(2000).optional().nullable(),
    categoriaId: z.coerce.number().int().positive("La categoría debe ser un número entero positivo"),
    nivel: z
      .string()
      .trim()
      .min(1, "El nivel del torneo es obligatorio")
      .max(60, "El nivel no puede exceder 60 caracteres"),
    fechaInicio: z.iso.datetime({ offset: true, message: "fechaInicio debe ser una fecha/hora ISO válida" }),
    fechaFin: z.iso.datetime({ offset: true, message: "fechaFin debe ser una fecha/hora ISO válida" }),
    cuposTotales: z.coerce
      .number()
      .int()
      .min(2, "Los cupos totales deben ser al menos 2"),
    precioInscripcion: z.coerce
      .number()
      .min(0, "El precio de inscripción no puede ser negativo")
      .default(0),
    estado: estadoTorneoSchema.optional().default("BORRADOR"),
    bloqueos: z.array(torneoBloqueoInputSchema).optional().default([]),
  })
  .refine(
    (data) => new Date(data.fechaFin).getTime() > new Date(data.fechaInicio).getTime(),
    {
      message: "fechaFin debe ser posterior a fechaInicio",
      path: ["fechaFin"],
    },
  )
  .refine(
    (data) => {
      if (!data.bloqueos || data.bloqueos.length === 0) return true;
      const tStart = new Date(data.fechaInicio).getTime();
      const tEnd = new Date(data.fechaFin).getTime();
      return data.bloqueos.every(
        (b) =>
          new Date(b.horaInicio).getTime() >= tStart &&
          new Date(b.horaFin).getTime() <= tEnd,
      );
    },
    {
      message: "Todos los bloqueos de pista deben estar contenidos en el rango del torneo",
      path: ["bloqueos"],
    },
  );
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(120, "El título no puede exceder los 120 caracteres")
      .optional(),
    descripcion: z.string().trim().max(2000).optional().nullable(),
    categoriaId: z.coerce.number().int().positive().optional(),
    nivel: z.string().trim().min(1).max(60).optional(),
    fechaInicio: z.iso.datetime({ offset: true, message: "fechaInicio debe ser una fecha/hora ISO válida" }).optional(),
    fechaFin: z.iso.datetime({ offset: true, message: "fechaFin debe ser una fecha/hora ISO válida" }).optional(),
    cuposTotales: z.coerce.number().int().min(2).optional(),
    precioInscripcion: z.coerce.number().min(0).optional(),
    estado: estadoTorneoSchema.optional(),
    bloqueos: z.array(torneoBloqueoInputSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.fechaInicio && data.fechaFin) {
        return new Date(data.fechaFin).getTime() > new Date(data.fechaInicio).getTime();
      }
      return true;
    },
    {
      message: "fechaFin debe ser posterior a fechaInicio",
      path: ["fechaFin"],
    },
  )
  .refine(
    (data) => {
      if (!data.bloqueos || data.bloqueos.length === 0) return true;
      if (data.fechaInicio && data.fechaFin) {
        const tStart = new Date(data.fechaInicio).getTime();
        const tEnd = new Date(data.fechaFin).getTime();
        return data.bloqueos.every(
          (b) =>
            new Date(b.horaInicio).getTime() >= tStart &&
            new Date(b.horaFin).getTime() <= tEnd,
        );
      }
      return true;
    },
    {
      message: "Todos los bloqueos de pista deben estar contenidos en el rango del torneo",
      path: ["bloqueos"],
    },
  );
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

export const tournamentIdParamSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "El ID del torneo debe ser un UUID válido.",
  );

export const tournamentQuerySchema = z.object({
  estado: estadoTorneoSchema.optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  soloActivos: z
    .preprocess((val) => {
      if (typeof val === "string") {
        const lower = val.trim().toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
      }
      if (typeof val === "boolean") return val;
      return val;
    }, z.boolean())
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type TournamentQueryInput = z.infer<typeof tournamentQuerySchema>;

export const registerTournamentSchema = z.object({
  nombrePareja: z
    .string()
    .trim()
    .min(2, "El nombre de la pareja debe tener al menos 2 caracteres")
    .max(120, "El nombre de la pareja no puede exceder 120 caracteres")
    .optional()
    .nullable(),
  pagoId: z
    .string()
    .trim()
    .uuid("El ID de pago debe ser un UUID válido.")
    .optional()
    .nullable(),
  stripePaymentIntentId: z.string().trim().optional().nullable(),
});
export type RegisterTournamentInput = z.infer<typeof registerTournamentSchema>;
