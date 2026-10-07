import { z } from "zod";

// ==========================================
// ENUMS DE SERVICIO Y CATEGORÍA (RF-03, RF-04)
// ==========================================

export const tipoCategoriaServicioSchema = z.enum([
  "CANCHA",
  "PISCINA",
  "GIMNASIO",
  "ZONA_HUMEDA",
]);
export type TipoCategoriaServicioInput = z.infer<typeof tipoCategoriaServicioSchema>;

export const modalidadServicioSchema = z.enum(["EXCLUSIVA", "AFORO"]);
export type ModalidadServicioInput = z.infer<typeof modalidadServicioSchema>;

export const tipoPiscinaSchema = z.enum(["PUBLICA", "PRIVADA"]);
export type TipoPiscinaInput = z.infer<typeof tipoPiscinaSchema>;

export const estadoServicioSchema = z.enum(["ACTIVO", "INHABILITADO"]);
export type EstadoServicioInput = z.infer<typeof estadoServicioSchema>;

// ==========================================
// FRANJA HORARIA (CALENDARIO PROPIO)
// ==========================================

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function timeToSeconds(time: string): number {
  const [hours, minutes, seconds = "0"] = time.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export const franjaHorariaSchema = z
  .object({
    diaSemana: z.coerce
      .number()
      .int()
      .min(1, "El día de la semana debe ser entre 1 (Lunes) y 7 (Domingo)")
      .max(7, "El día de la semana debe ser entre 1 (Lunes) y 7 (Domingo)"),
    horaInicio: z.string().regex(timeRegex, "horaInicio debe tener formato HH:mm o HH:mm:ss"),
    horaFin: z.string().regex(timeRegex, "horaFin debe tener formato HH:mm o HH:mm:ss"),
  })
  .refine(
    (data) => {
      return timeToSeconds(data.horaFin) > timeToSeconds(data.horaInicio);
    },
    {
      message: "horaFin debe ser posterior a horaInicio",
      path: ["horaFin"],
    },
  );
export type FranjaHorariaInput = z.infer<typeof franjaHorariaSchema>;

// ==========================================
// CATEGORIA_SERVICIO
// ==========================================

export const createCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre de la categoría debe tener al menos 2 caracteres")
    .max(60, "El nombre de la categoría no puede superar 60 caracteres"),
  tipo: tipoCategoriaServicioSchema,
});
export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>;

export const updateCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre de la categoría debe tener al menos 2 caracteres")
    .max(60, "El nombre de la categoría no puede superar 60 caracteres")
    .optional(),
  tipo: tipoCategoriaServicioSchema.optional(),
});
export type UpdateCategoriaInput = z.infer<typeof updateCategoriaSchema>;

// ==========================================
// SERVICIO (INSTANCIAS CON CALENDARIO PROPIO)
// ==========================================

export const createServicioSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre del servicio debe tener al menos 2 caracteres")
      .max(80, "El nombre del servicio no puede superar 80 caracteres"),
    categoriaId: z.coerce
      .number()
      .int()
      .positive("El identificador de categoría debe ser un número positivo"),
    capacidadMaxima: z.coerce
      .number()
      .int()
      .positive("La capacidad máxima debe ser mayor a 0"),
    tarifa: z.coerce
      .number()
      .nonnegative("La tarifa debe ser un monto igual o mayor a 0"),
    modalidad: modalidadServicioSchema,
    tipoPiscina: tipoPiscinaSchema.nullable().optional(),
    estado: estadoServicioSchema.optional().default("ACTIVO"),
    franjasHorarias: z.array(franjaHorariaSchema).optional().default([]),
  })
  .refine(
    (data) => {
      // Si la modalidad es AFORO y es piscina privada, no es consistente
      if (data.tipoPiscina === "PRIVADA" && data.modalidad === "AFORO") {
        return false;
      }
      return true;
    },
    {
      message: "Una piscina privada debe operar bajo modalidad EXCLUSIVA",
      path: ["modalidad"],
    },
  );
export type CreateServicioInput = z.infer<typeof createServicioSchema>;

export const updateServicioSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre del servicio debe tener al menos 2 caracteres")
      .max(80, "El nombre del servicio no puede superar 80 caracteres")
      .optional(),
    categoriaId: z.coerce
      .number()
      .int()
      .positive("El identificador de categoría debe ser un número positivo")
      .optional(),
    capacidadMaxima: z.coerce
      .number()
      .int()
      .positive("La capacidad máxima debe ser mayor a 0")
      .optional(),
    tarifa: z.coerce
      .number()
      .nonnegative("La tarifa debe ser un monto igual o mayor a 0")
      .optional(),
    modalidad: modalidadServicioSchema.optional(),
    tipoPiscina: tipoPiscinaSchema.nullable().optional(),
    estado: estadoServicioSchema.optional(),
    franjasHorarias: z.array(franjaHorariaSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.tipoPiscina === "PRIVADA" && data.modalidad === "AFORO") {
        return false;
      }
      return true;
    },
    {
      message: "Una piscina privada debe operar bajo modalidad EXCLUSIVA",
      path: ["modalidad"],
    },
  );
export type UpdateServicioInput = z.infer<typeof updateServicioSchema>;

// ==========================================
// COMPATIBILIDAD RETROACTIVA (serviceSchema previo)
// ==========================================

export const serviceSchema = z.object({
  name: z.string().min(2),
  categoryId: z.union([z.coerce.number().int().positive(), z.string()]),
  capacity: z.coerce.number().int().positive(),
  isPool: z.boolean().default(false),
  modality: z.enum(["Publica", "Privada", "EXCLUSIVA", "AFORO"]).optional(),
  tarifa: z.coerce.number().nonnegative().optional(),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

/**
 * Normaliza nombres de atributos entre camelCase / inglés y el modelo canónico en español.
 */
export function normalizeServicePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const modalidadRaw = raw.modalidad ?? raw.modality;
  let modalidadNormalized: "EXCLUSIVA" | "AFORO" | undefined;
  if (modalidadRaw === "Publica" || modalidadRaw === "AFORO") {
    modalidadNormalized = "AFORO";
  } else if (modalidadRaw === "Privada" || modalidadRaw === "EXCLUSIVA") {
    modalidadNormalized = "EXCLUSIVA";
  }

  let tipoPiscinaNormalized = raw.tipoPiscina as "PUBLICA" | "PRIVADA" | null | undefined;
  if (!tipoPiscinaNormalized && raw.isPool) {
    tipoPiscinaNormalized = modalidadNormalized === "EXCLUSIVA" ? "PRIVADA" : "PUBLICA";
  }

  return {
    ...raw,
    nombre: raw.nombre ?? raw.name,
    categoriaId: raw.categoriaId ?? raw.categoryId,
    capacidadMaxima: raw.capacidadMaxima ?? raw.capacity,
    tarifa: raw.tarifa ?? raw.price ?? raw.tariff ?? 0,
    modalidad: modalidadNormalized ?? modalidadRaw,
    tipoPiscina: tipoPiscinaNormalized,
    estado: raw.estado ?? raw.status ?? "ACTIVO",
    franjasHorarias: raw.franjasHorarias ?? raw.schedule ?? raw.schedules ?? [],
  };
}
