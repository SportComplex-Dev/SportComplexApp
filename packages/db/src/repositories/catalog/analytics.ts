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
 * Único camino de producción: agrega directamente sobre las tablas
 * transaccionales (`reserva`, `pago`, `ticket_qr`) en PostgreSQL y delega la
 * agregación de negocio en `calcularAnalitica` (función pura). Los tests
 * inyectan un doble de Prisma que implementa `$queryRawUnsafe` devolviendo
 * filas equivalentes; este módulo no conoce ni detecta el doble.
 *
 * Nota: antes se consultaban las vistas `vw_kpi_*`, pero ninguna migración
 * las creaba, así que el endpoint respondía 500 (`42P01 relation does not
 * exist`) tanto en CI como en producción. Los mismos KPI se calculan ahora
 * con `COUNT`/`SUM` directos, que es además el criterio de aceptación del
 * test de integración (cuadrar contra COUNT directo sobre las tablas).
 */
export async function getAnalytics(
  options: GetAnalyticsOptions = {},
): Promise<AnalyticsData> {
  const db = options.db || defaultPrisma;
  const { startDate, endDate, period = "daily" } = options;

  const startDateParam = startDate ?? null;
  const endDateParam = endDate ?? null;

  // Ejecución concurrente de las 4 agregaciones sobre las tablas transaccionales
  const [attendanceRows, revenueRows, categoryRows, serviceRows] = await Promise.all([
    // Asistencia: tickets usados por día y usuarios únicos que ingresaron.
    db.$queryRawUnsafe(
      `SELECT date(t.usado_en AT TIME ZONE 'America/Bogota')::text AS fecha_uso,
              count(t.id)::bigint AS total_afluencia_tickets,
              count(DISTINCT r.titular_id)::bigint AS usuarios_unicos_ingresados
       FROM ticket_qr t
         JOIN reserva r ON (r.id = t.reserva_id)
       WHERE t.estado = 'USADO'::"EstadoTicket"
         AND t.usado_en IS NOT NULL
         AND ($1::text IS NULL OR date(t.usado_en AT TIME ZONE 'America/Bogota') >= $1::date)
         AND ($2::text IS NULL OR date(t.usado_en AT TIME ZONE 'America/Bogota') <= $2::date)
       GROUP BY 1
       ORDER BY 1 ASC`,
      startDateParam,
      endDateParam,
    ) as Promise<AttendanceRow[]>,

    // Ingresos: transacciones e importes aprobados por día y tipo de pago.
    db.$queryRawUnsafe(
      `SELECT date(p.creado_en AT TIME ZONE 'America/Bogota')::text AS fecha_pago,
              p.tipo::text AS tipo_pago,
              count(p.id)::bigint AS total_transacciones,
              COALESCE(sum(p.monto), 0.00)::numeric(12,2) AS ingresos_totales
       FROM pago p
       WHERE p.estado = 'APROBADO'::"EstadoPago"
         AND ($1::text IS NULL OR date(p.creado_en AT TIME ZONE 'America/Bogota') >= $1::date)
         AND ($2::text IS NULL OR date(p.creado_en AT TIME ZONE 'America/Bogota') <= $2::date)
       GROUP BY 1, 2
       ORDER BY 1 ASC`,
      startDateParam,
      endDateParam,
    ) as Promise<RevenueRow[]>,

    // Desempeño por categoría: reservas confirmadas, cupos e ingresos.
    db.$queryRawUnsafe(
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
    ) as Promise<CategoryRow[]>,

    // Vendidos vs. usados por servicio.
    db.$queryRawUnsafe(
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
    ) as Promise<ServiceRow[]>,
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
