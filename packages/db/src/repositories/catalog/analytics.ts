import { prisma as defaultPrisma } from "../../client";
import type { ClienteDb } from "../tipos-db";
import { calcularAnalitica } from "./analytics-calculo";
import type {
  AnalyticsData,
  AnalyticsPeriod,
  AttendanceRow,
  CategoryRow,
  RevenueRow,
  ServiceRow,
} from "./analytics-calculo";

export * from "./analytics-calculo";

export interface GetAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  period?: AnalyticsPeriod;
  db?: ClienteDb;
}

/**
 * Analítica gerencial (RF-21 / TSK-BE-24).
 *
 * Único camino de producción: consulta las vistas `vw_kpi_*` en PostgreSQL y
 * delega la agregación en `calcularAnalitica` (función pura). Los tests
 * inyectan un doble de Prisma que implementa `$queryRawUnsafe` devolviendo
 * filas equivalentes; este módulo no conoce ni detecta el doble.
 */
export async function getAnalytics(
  options: GetAnalyticsOptions = {},
): Promise<AnalyticsData> {
  const db = options.db || defaultPrisma;
  const { startDate, endDate, period = "daily" } = options;

  const startDateParam = startDate ?? null;
  const endDateParam = endDate ?? null;

  // Ejecución concurrente sobre PostgreSQL usando el modelo analítico de vistas
  const [attendanceRows, revenueRows, categoryRows, serviceRows] = await Promise.all([
    db.$queryRawUnsafe(
      `SELECT fecha_uso::text AS fecha_uso,
              total_afluencia_tickets::bigint AS total_afluencia_tickets,
              usuarios_unicos_ingresados::bigint AS usuarios_unicos_ingresados
       FROM vw_kpi_daily_attendance
       WHERE ($1::text IS NULL OR fecha_uso >= $1::date)
         AND ($2::text IS NULL OR fecha_uso <= $2::date)
       ORDER BY fecha_uso ASC`,
      startDateParam,
      endDateParam,
    ) as Promise<AttendanceRow[]>,

    db.$queryRawUnsafe(
      `SELECT fecha_pago::text AS fecha_pago,
              tipo_pago::text AS tipo_pago,
              total_transacciones::bigint AS total_transacciones,
              ingresos_totales::numeric(12,2) AS ingresos_totales
       FROM vw_kpi_daily_revenue
       WHERE ($1::text IS NULL OR fecha_pago >= $1::date)
         AND ($2::text IS NULL OR fecha_pago <= $2::date)
       ORDER BY fecha_pago ASC`,
      startDateParam,
      endDateParam,
    ) as Promise<RevenueRow[]>,

    // Si no hay filtro de fechas, se consulta directamente la vista vw_kpi_category_performance
    (!startDate && !endDate
      ? db.$queryRawUnsafe(`SELECT * FROM vw_kpi_category_performance`)
      : db.$queryRawUnsafe(
          `SELECT cs.id AS categoria_id,
                  cs.nombre AS categoria_nombre,
                  cs.tipo::text AS categoria_tipo,
                  count(DISTINCT r.id)::bigint AS total_reservas,
                  COALESCE(sum(r.cantidad_cupos), 0::bigint)::bigint AS total_cupos_vendidos,
                  COALESCE(sum(r.total), 0.00)::numeric(12,2) AS total_ingresos
           FROM categoria_servicio cs
             JOIN servicio s ON (cs.id = s.categoria_id)
             JOIN disponibilidad d ON (s.id = d.servicio_id)
             JOIN reserva r ON (d.id = r.disponibilidad_id AND r.estado = 'CONFIRMADA'::"EstadoReserva")
           WHERE ($1::text IS NULL OR date(r.creado_en AT TIME ZONE 'America/Bogota') >= $1::date)
             AND ($2::text IS NULL OR date(r.creado_en AT TIME ZONE 'America/Bogota') <= $2::date)
           GROUP BY cs.id, cs.nombre, cs.tipo
           ORDER BY COALESCE(sum(r.total), 0.00) DESC`,
          startDateParam,
          endDateParam,
        )) as Promise<CategoryRow[]>,

    // Si no hay filtro de fechas, se consulta directamente la vista vw_kpi_services_sold_vs_used
    (!startDate && !endDate
      ? db.$queryRawUnsafe(`SELECT * FROM vw_kpi_services_sold_vs_used`)
      : db.$queryRawUnsafe(
          `WITH ventas AS (
             SELECT d.servicio_id,
                sum(r.cantidad_cupos)::bigint AS cupos_vendidos,
                sum(r.total)::numeric(12,2) AS total_recaudado
             FROM reserva r
                JOIN disponibilidad d ON (r.disponibilidad_id = d.id)
             WHERE r.estado = 'CONFIRMADA'::"EstadoReserva"
               AND ($1::text IS NULL OR date(r.creado_en AT TIME ZONE 'America/Bogota') >= $1::date)
               AND ($2::text IS NULL OR date(r.creado_en AT TIME ZONE 'America/Bogota') <= $2::date)
             GROUP BY d.servicio_id
           ), usos AS (
             SELECT d.servicio_id,
                count(t.id)::bigint AS cupos_usados
             FROM ticket_qr t
                JOIN reserva r ON (t.reserva_id = r.id)
                JOIN disponibilidad d ON (r.disponibilidad_id = d.id)
             WHERE t.estado = 'USADO'::"EstadoTicket"
               AND ($1::text IS NULL OR date(t.usado_en AT TIME ZONE 'America/Bogota') >= $1::date)
               AND ($2::text IS NULL OR date(t.usado_en AT TIME ZONE 'America/Bogota') <= $2::date)
             GROUP BY d.servicio_id
           )
           SELECT s.id AS servicio_id,
              s.nombre AS servicio_nombre,
              s.modalidad::text AS modalidad,
              COALESCE(v.cupos_vendidos, 0::bigint)::bigint AS total_vendidos,
              COALESCE(u.cupos_usados, 0::bigint)::bigint AS total_usados,
              COALESCE(v.total_recaudado, 0.00)::numeric(12,2) AS total_recaudado
           FROM servicio s
              LEFT JOIN ventas v ON (s.id = v.servicio_id)
              LEFT JOIN usos u ON (s.id = u.servicio_id)
           ORDER BY COALESCE(v.cupos_vendidos, 0::bigint) DESC`,
          startDateParam,
          endDateParam,
        )) as Promise<ServiceRow[]>,
  ]);

  return calcularAnalitica(
    {
      attendance: attendanceRows,
      revenue: revenueRows,
      category: categoryRows,
      service: serviceRows,
    },
    { startDate, endDate, period, timezone: "America/Bogota" },
  );
}
