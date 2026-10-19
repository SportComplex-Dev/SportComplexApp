/**
 * Cálculo puro de la analítica gerencial (RF-21 / TSK-BE-24).
 *
 * Recibe las filas ya obtenidas por el repositorio —agregaciones sobre las
 * tablas transaccionales en producción, filas derivadas del estado en memoria
 * en tests— y aplica las
 * reglas de agregación del dominio: agrupación diaria/semanal, porcentajes por
 * categoría y comparativa vendidos vs. usados.
 *
 * No conoce Prisma, ni SQL, ni el doble de pruebas: es una función pura y
 * determinista, testeable sin base de datos.
 */

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

/** Fila de la agregación diaria de asistencia. */
export interface AttendanceRow {
  fecha_uso: string;
  total_afluencia_tickets: bigint | number;
  usuarios_unicos_ingresados: bigint | number;
}

/** Fila de la agregación diaria de ingresos. */
export interface RevenueRow {
  fecha_pago: string;
  tipo_pago: string;
  total_transacciones: bigint | number;
  ingresos_totales: string | number;
}

/** Fila de la agregación de desempeño por categoría. */
export interface CategoryRow {
  categoria_id: number;
  categoria_nombre: string;
  categoria_tipo: string;
  total_reservas: bigint | number;
  total_cupos_vendidos: bigint | number;
  total_ingresos: string | number;
}

/** Fila de la agregación de vendidos vs. usados por servicio. */
export interface ServiceRow {
  servicio_id: number;
  servicio_nombre: string;
  modalidad: string;
  total_vendidos: bigint | number;
  total_usados: bigint | number;
  total_recaudado: string | number;
}

/** Conjunto de filas que consume el cálculo. */
export interface FilasAnalitica {
  attendance: AttendanceRow[];
  revenue: RevenueRow[];
  category: CategoryRow[];
  service: ServiceRow[];
}

function getWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setUTCDate(diff));
  return monday.toISOString().slice(0, 10);
}

function buildPeriodBreakdown(
  attendance: AttendanceMetric[],
  revenue: RevenueMetric[],
  period: AnalyticsPeriod,
): PeriodBreakdownItem[] {
  const breakdownMap = new Map<
    string,
    { attendance: number; transactions: number; revenue: number }
  >();

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

  return Array.from(breakdownMap.entries())
    .map(([periodKey, val]) => ({
      periodKey,
      periodLabel: period === "weekly" ? `Semana ${periodKey}` : periodKey,
      attendance: val.attendance,
      transactions: val.transactions,
      revenue: Number(val.revenue.toFixed(2)),
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

/**
 * Agrega las filas de las vistas analíticas en el contrato `AnalyticsData`.
 *
 * Es el único lugar donde viven las fórmulas de los KPIs, tanto para la ruta
 * SQL de producción como para el doble de pruebas.
 */
export function calcularAnalitica(
  filas: FilasAnalitica,
  filters: AnalyticsFilters,
): AnalyticsData {
  const { period } = filters;

  const attendance: AttendanceMetric[] = filas.attendance.map((row) => ({
    date: row.fecha_uso,
    ticketsUsed: Number(row.total_afluencia_tickets),
    uniqueUsers: Number(row.usuarios_unicos_ingresados),
  }));

  const revenue: RevenueMetric[] = filas.revenue.map((row) => ({
    date: row.fecha_pago,
    paymentType: row.tipo_pago,
    transactions: Number(row.total_transacciones),
    totalAmount: Number(Number(row.ingresos_totales).toFixed(2)),
  }));

  // Total ingresos para porcentaje por categoría
  const totalCatRevenue = filas.category.reduce(
    (acc, row) => acc + Number(row.total_ingresos),
    0,
  );

  const categoryPerformance: CategoryPerformanceMetric[] = filas.category.map((row) => {
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

  const servicesComparison: ServicePerformanceMetric[] = filas.service.map((row) => ({
    serviceId: row.servicio_id,
    serviceName: row.servicio_nombre,
    modality: row.modalidad,
    totalSold: Number(row.total_vendidos),
    totalUsed: Number(row.total_usados),
    totalRevenue: Number(Number(row.total_recaudado).toFixed(2)),
  }));

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
      items: buildPeriodBreakdown(attendance, revenue, period),
    },
    categoryPerformance,
    servicesComparison,
    filters,
  };
}
