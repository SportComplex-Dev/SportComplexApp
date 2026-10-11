/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma as defaultPrisma } from "../client";

export type AnalyticsPeriod = "daily" | "weekly";

export interface AnalyticsSummary {
  totalAttendance: number;
  totalTransactions: number;
  totalRevenue: number;
  uniqueAttendees: number;
  totalBookings: number;
  totalSpotsSold: number;
}

export interface AttendanceMetric {
  date: string;
  ticketsUsed: number;
  uniqueUsers: number;
}

export interface RevenueMetric {
  date: string;
  paymentType: string;
  transactions: number;
  totalAmount: number;
}

export interface PeriodBreakdownItem {
  periodKey: string;
  periodLabel: string;
  attendance: number;
  transactions: number;
  revenue: number;
}

export interface CategoryPerformanceMetric {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  totalBookings: number;
  totalSpotsSold: number;
  totalRevenue: number;
  revenuePercentage: number;
}

export interface ServicePerformanceMetric {
  serviceId: number;
  serviceName: string;
  modality: string;
  totalSold: number;
  totalUsed: number;
  totalRevenue: number;
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  period: AnalyticsPeriod;
  timezone: "America/Bogota";
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  attendance: AttendanceMetric[];
  revenue: RevenueMetric[];
  periodBreakdown: {
    period: AnalyticsPeriod;
    items: PeriodBreakdownItem[];
  };
  categoryPerformance: CategoryPerformanceMetric[];
  servicesComparison: ServicePerformanceMetric[];
  filters: AnalyticsFilters;
}

export interface GetAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  period?: AnalyticsPeriod;
  db?: any;
}

function toBogotaDate(date: Date): string {
  // ISO string offset by -5 hours
  const bogotaTime = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return bogotaTime.toISOString().slice(0, 10);
}

function getWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setUTCDate(diff));
  return monday.toISOString().slice(0, 10);
}

function calculateMockAnalytics(options: GetAnalyticsOptions, mockState: any): AnalyticsData {
  const { startDate, endDate, period = "daily" } = options;

  // Filter tickets
  const usedTickets = (mockState.tickets || []).filter((t: any) => {
    if (t.estado !== "USADO" || !t.usadoEn) return false;
    const dateStr = toBogotaDate(new Date(t.usadoEn));
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });

  // Group attendance by day
  const dailyAttendanceMap = new Map<string, { ticketsUsed: number; userIds: Set<string> }>();
  for (const t of usedTickets) {
    const dateStr = toBogotaDate(new Date(t.usadoEn));
    const entry = dailyAttendanceMap.get(dateStr) || { ticketsUsed: 0, userIds: new Set<string>() };
    entry.ticketsUsed += 1;
    const res = mockState.reservas?.find((r: any) => r.id === t.reservaId);
    if (res?.titularId) entry.userIds.add(res.titularId);
    dailyAttendanceMap.set(dateStr, entry);
  }

  const attendance: AttendanceMetric[] = Array.from(dailyAttendanceMap.entries())
    .map(([date, val]) => ({
      date,
      ticketsUsed: val.ticketsUsed,
      uniqueUsers: val.userIds.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Filter payments
  const approvedPayments = (mockState.pagos || []).filter((p: any) => {
    if (p.estado !== "APROBADO") return false;
    const dateStr = toBogotaDate(p.creadoEn ? new Date(p.creadoEn) : new Date());
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });

  const dailyRevenueMap = new Map<string, { [type: string]: { count: number; total: number } }>();
  for (const p of approvedPayments) {
    const dateStr = toBogotaDate(p.creadoEn ? new Date(p.creadoEn) : new Date());
    const byDate = dailyRevenueMap.get(dateStr) || {};
    const type = p.tipo || "RESERVA";
    const current = byDate[type] || { count: 0, total: 0 };
    current.count += 1;
    current.total += Number(p.monto || 0);
    byDate[type] = current;
    dailyRevenueMap.set(dateStr, byDate);
  }

  const revenue: RevenueMetric[] = [];
  for (const [date, types] of Array.from(dailyRevenueMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [paymentType, val] of Object.entries(types)) {
      revenue.push({
        date,
        paymentType,
        transactions: val.count,
        totalAmount: Number(val.total.toFixed(2)),
      });
    }
  }

  // Filter confirmed bookings
  const confirmedReservas = (mockState.reservas || []).filter((r: any) => {
    if (r.estado !== "CONFIRMADA") return false;
    const dateStr = toBogotaDate(r.creadoEn ? new Date(r.creadoEn) : new Date());
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });

  // Categories
  const categoriesList = mockState.categorias || [];
  const servicesList = mockState.servicios || [];

  let totalRevenueCategories = 0;
  const categoryMetrics: CategoryPerformanceMetric[] = categoriesList.map((c: any) => {
    const cServicios = servicesList.filter((s: any) => s.categoriaId === c.id);
    const sIds = new Set(cServicios.map((s: any) => s.id));
    const disps = (mockState.disponibilidades || []).filter((d: any) => sIds.has(d.servicioId));
    const dIds = new Set(disps.map((d: any) => d.id));
    const catRes = confirmedReservas.filter((r: any) => dIds.has(r.disponibilidadId));

    const totalBookings = catRes.length;
    const totalSpotsSold = catRes.reduce((acc: number, r: any) => acc + (r.cantidadCupos || 1), 0);
    const totalRev = catRes.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0);
    totalRevenueCategories += totalRev;

    return {
      categoryId: c.id,
      categoryName: c.nombre,
      categoryType: c.tipo,
      totalBookings,
      totalSpotsSold,
      totalRevenue: Number(totalRev.toFixed(2)),
      revenuePercentage: 0,
    };
  });

  for (const c of categoryMetrics) {
    c.revenuePercentage =
      totalRevenueCategories > 0
        ? Number(((c.totalRevenue / totalRevenueCategories) * 100).toFixed(2))
        : 0;
  }
  categoryMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Services sold vs used
  const serviceMetrics: ServicePerformanceMetric[] = servicesList.map((s: any) => {
    const disps = (mockState.disponibilidades || []).filter((d: any) => d.servicioId === s.id);
    const dIds = new Set(disps.map((d: any) => d.id));
    const sReservas = confirmedReservas.filter((r: any) => dIds.has(r.disponibilidadId));
    const rIds = new Set(sReservas.map((r: any) => r.id));
    const sTickets = usedTickets.filter((t: any) => rIds.has(t.reservaId));

    const totalSold = sReservas.reduce((acc: number, r: any) => acc + (r.cantidadCupos || 1), 0);
    const totalUsed = sTickets.length;
    const totalRev = sReservas.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0);

    return {
      serviceId: s.id,
      serviceName: s.nombre,
      modality: s.modalidad,
      totalSold,
      totalUsed,
      totalRevenue: Number(totalRev.toFixed(2)),
    };
  });
  serviceMetrics.sort((a, b) => b.totalSold - a.totalSold);

  // Summary
  const totalAttendance = usedTickets.length;
  const totalTransactions = approvedPayments.length;
  const totalRevenue = Number(approvedPayments.reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0).toFixed(2));
  const uniqueAttendees = new Set(usedTickets.map((t: any) => {
    const res = mockState.reservas?.find((r: any) => r.id === t.reservaId);
    return res?.titularId;
  }).filter(Boolean)).size;
  const totalBookings = confirmedReservas.length;
  const totalSpotsSold = confirmedReservas.reduce((acc: number, r: any) => acc + (r.cantidadCupos || 1), 0);

  // Period breakdown
  const breakdownMap = new Map<string, { attendance: number; transactions: number; revenue: number }>();
  for (const a of attendance) {
    const key = period === "weekly" ? getWeekKey(a.date) : a.date;
    const current = breakdownMap.get(key) || { attendance: 0, transactions: 0, revenue: 0 };
    current.attendance += a.ticketsUsed;
    breakdownMap.set(key, current);
  }
  for (const r of revenue) {
    const key = period === "weekly" ? getWeekKey(r.date) : r.date;
    const current = breakdownMap.get(key) || { attendance: 0, transactions: 0, revenue: 0 };
    current.transactions += r.transactions;
    current.revenue += r.totalAmount;
    breakdownMap.set(key, current);
  }

  const periodBreakdownItems: PeriodBreakdownItem[] = Array.from(breakdownMap.entries())
    .map(([key, val]) => ({
      periodKey: key,
      periodLabel: period === "weekly" ? `Semana ${key}` : key,
      attendance: val.attendance,
      transactions: val.transactions,
      revenue: Number(val.revenue.toFixed(2)),
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    summary: {
      totalAttendance,
      totalTransactions,
      totalRevenue,
      uniqueAttendees,
      totalBookings,
      totalSpotsSold,
    },
    attendance,
    revenue,
    periodBreakdown: {
      period,
      items: periodBreakdownItems,
    },
    categoryPerformance: categoryMetrics,
    servicesComparison: serviceMetrics,
    filters: {
      startDate,
      endDate,
      period,
      timezone: "America/Bogota",
    },
  };
}

export async function getAnalytics(options: GetAnalyticsOptions = {}): Promise<AnalyticsData> {
  const db = options.db || defaultPrisma;
  const { startDate, endDate, period = "daily" } = options;

  // Si db tiene _state, es un mock en memoria
  if (db && db._state) {
    return calculateMockAnalytics(options, db._state);
  }

  const startDateParam = startDate ?? null;
  const endDateParam = endDate ?? null;

  // 1. Attendance (asistencia diaria desde la vista analítica vw_kpi_daily_attendance)
  interface AttendanceRow {
    fecha_uso: string;
    total_afluencia_tickets: bigint | number;
    usuarios_unicos_ingresados: bigint | number;
  }

  // 2. Revenue (ingresos diarios desde la vista analítica vw_kpi_daily_revenue)
  interface RevenueRow {
    fecha_pago: string;
    tipo_pago: string;
    total_transacciones: bigint | number;
    ingresos_totales: string | number;
  }

  // 3. Category performance
  interface CategoryRow {
    categoria_id: number;
    categoria_nombre: string;
    categoria_tipo: string;
    total_reservas: bigint | number;
    total_cupos_vendidos: bigint | number;
    total_ingresos: string | number;
  }

  // 4. Services comparison
  interface ServiceRow {
    servicio_id: number;
    servicio_nombre: string;
    modalidad: string;
    total_vendidos: bigint | number;
    total_usados: bigint | number;
    total_recaudado: string | number;
  }

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
      endDateParam
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
      endDateParam
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
          endDateParam
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
          endDateParam
        )) as Promise<ServiceRow[]>,
  ]);

  const attendance: AttendanceMetric[] = attendanceRows.map((row) => ({
    date: row.fecha_uso,
    ticketsUsed: Number(row.total_afluencia_tickets),
    uniqueUsers: Number(row.usuarios_unicos_ingresados),
  }));

  const revenue: RevenueMetric[] = revenueRows.map((row) => ({
    date: row.fecha_pago,
    paymentType: row.tipo_pago,
    transactions: Number(row.total_transacciones),
    totalAmount: Number(Number(row.ingresos_totales).toFixed(2)),
  }));

  // Total ingresos para porcentaje por categoría
  const totalCatRevenue = categoryRows.reduce(
    (acc, row) => acc + Number(row.total_ingresos),
    0
  );

  const categoryPerformance: CategoryPerformanceMetric[] = categoryRows.map((row) => {
    const totalRev = Number(Number(row.total_ingresos).toFixed(2));
    const revenuePercentage =
      totalCatRevenue > 0
        ? Number(((totalRev / totalCatRevenue) * 100).toFixed(2))
        : 0;

    return {
      categoryId: row.categoria_id,
      categoryName: row.categoria_nombre,
      categoryType: row.categoria_tipo,
      totalBookings: Number(row.total_reservas),
      totalSpotsSold: Number(row.total_cupos_vendidos),
      totalRevenue: totalRev,
      revenuePercentage,
    };
  });

  const servicesComparison: ServicePerformanceMetric[] = serviceRows.map((row) => ({
    serviceId: row.servicio_id,
    serviceName: row.servicio_nombre,
    modality: row.modalidad,
    totalSold: Number(row.total_vendidos),
    totalUsed: Number(row.total_usados),
    totalRevenue: Number(Number(row.total_recaudado).toFixed(2)),
  }));

  // Agregación para desglose diario o semanal (periodBreakdown)
  const breakdownMap = new Map<string, { attendance: number; transactions: number; revenue: number }>();

  for (const a of attendance) {
    const key = period === "weekly" ? getWeekKey(a.date) : a.date;
    const current = breakdownMap.get(key) || { attendance: 0, transactions: 0, revenue: 0 };
    current.attendance += a.ticketsUsed;
    breakdownMap.set(key, current);
  }

  for (const r of revenue) {
    const key = period === "weekly" ? getWeekKey(r.date) : r.date;
    const current = breakdownMap.get(key) || { attendance: 0, transactions: 0, revenue: 0 };
    current.transactions += r.transactions;
    current.revenue += r.totalAmount;
    breakdownMap.set(key, current);
  }

  const periodBreakdownItems: PeriodBreakdownItem[] = Array.from(breakdownMap.entries())
    .map(([key, val]) => ({
      periodKey: key,
      periodLabel: period === "weekly" ? `Semana ${key}` : key,
      attendance: val.attendance,
      transactions: val.transactions,
      revenue: Number(val.revenue.toFixed(2)),
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  // Cálculo de totales para el summary consolidado
  const totalAttendance = attendance.reduce((acc, a) => acc + a.ticketsUsed, 0);
  const totalTransactions = revenue.reduce((acc, r) => acc + r.transactions, 0);
  const totalRevenue = Number(revenue.reduce((acc, r) => acc + r.totalAmount, 0).toFixed(2));
  const uniqueAttendees = attendance.reduce((acc, a) => acc + a.uniqueUsers, 0);
  const totalBookings = categoryPerformance.reduce((acc, c) => acc + c.totalBookings, 0);
  const totalSpotsSold = categoryPerformance.reduce((acc, c) => acc + c.totalSpotsSold, 0);

  return {
    summary: {
      totalAttendance,
      totalTransactions,
      totalRevenue,
      uniqueAttendees,
      totalBookings,
      totalSpotsSold,
    },
    attendance,
    revenue,
    periodBreakdown: {
      period,
      items: periodBreakdownItems,
    },
    categoryPerformance,
    servicesComparison,
    filters: {
      startDate,
      endDate,
      period,
      timezone: "America/Bogota",
    },
  };
}
