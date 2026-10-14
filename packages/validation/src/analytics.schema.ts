import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const analyticsPeriodSchema = z.enum(["daily", "weekly", "diario", "semanal"]);
export type AnalyticsPeriod = "daily" | "weekly";

export const analyticsQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para startDate (se espera YYYY-MM-DD)")
      .optional(),
    endDate: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para endDate (se espera YYYY-MM-DD)")
      .optional(),
    from: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para from (se espera YYYY-MM-DD)")
      .optional(),
    to: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para to (se espera YYYY-MM-DD)")
      .optional(),
    fechaInicio: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para fechaInicio (se espera YYYY-MM-DD)")
      .optional(),
    fechaFin: z
      .string()
      .regex(dateRegex, "Formato de fecha inválido para fechaFin (se espera YYYY-MM-DD)")
      .optional(),
    period: analyticsPeriodSchema.optional(),
    periodo: analyticsPeriodSchema.optional(),
  })
  .refine(
    (data) => {
      const start = data.startDate ?? data.from ?? data.fechaInicio;
      const end = data.endDate ?? data.to ?? data.fechaFin;
      if (start && end) {
        return start <= end;
      }
      return true;
    },
    {
      message: "La fecha inicial (startDate) no puede ser posterior a la fecha final (endDate)",
      path: ["startDate"],
    }
  );

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

export interface NormalizedAnalyticsFilter {
  startDate?: string;
  endDate?: string;
  period: AnalyticsPeriod;
}

export function normalizeAnalyticsQuery(raw: AnalyticsQueryInput): NormalizedAnalyticsFilter {
  const startDate = raw.startDate ?? raw.from ?? raw.fechaInicio;
  const endDate = raw.endDate ?? raw.to ?? raw.fechaFin;
  const rawPeriod = raw.period ?? raw.periodo ?? "daily";
  const period: AnalyticsPeriod =
    rawPeriod === "weekly" || rawPeriod === "semanal" ? "weekly" : "daily";

  return {
    startDate,
    endDate,
    period,
  };
}
