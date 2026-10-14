import { zonaHoraria } from "../constantes.js";

export type TipoPeriodoAnalitica = "daily" | "weekly";
export type AnalyticsPeriodType = TipoPeriodoAnalitica;

export interface ResumenAnalitica {
  totalAttendance: number;
  totalTransactions: number;
  totalRevenue: number;
  uniqueAttendees: number;
  totalBookings: number;
  totalSpotsSold: number;
}
export type AnalyticsSummary = ResumenAnalitica;

export interface MetricaAsistencia {
  date: string;
  ticketsUsed: number;
  uniqueUsers: number;
}
export type AttendanceMetric = MetricaAsistencia;

export interface MetricaIngresos {
  date: string;
  paymentType: string;
  transactions: number;
  totalAmount: number;
}
export type RevenueMetric = MetricaIngresos;

export interface ElementoDesglosePeriodo {
  periodKey: string;
  periodLabel: string;
  attendance: number;
  transactions: number;
  revenue: number;
}
export type PeriodBreakdownItem = ElementoDesglosePeriodo;

export interface MetricaRendimientoCategoria {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  totalBookings: number;
  totalSpotsSold: number;
  totalRevenue: number;
  revenuePercentage: number;
}
export type CategoryPerformanceMetric = MetricaRendimientoCategoria;

export interface MetricaRendimientoServicio {
  serviceId: number;
  serviceName: string;
  modality: string;
  totalSold: number;
  totalUsed: number;
  totalRevenue: number;
}
export type ServicePerformanceMetric = MetricaRendimientoServicio;

export interface FiltrosAnalitica {
  startDate?: string;
  endDate?: string;
  period: TipoPeriodoAnalitica;
  timezone: typeof zonaHoraria;
}
export type AnalyticsFilters = FiltrosAnalitica;

export interface DatosAnalitica {
  summary: ResumenAnalitica;
  attendance: MetricaAsistencia[];
  revenue: MetricaIngresos[];
  periodBreakdown: {
    period: TipoPeriodoAnalitica;
    items: ElementoDesglosePeriodo[];
  };
  categoryPerformance: MetricaRendimientoCategoria[];
  servicesComparison: MetricaRendimientoServicio[];
  filters: FiltrosAnalitica;
}
export type AnalyticsData = DatosAnalitica;
