import { TIMEZONE } from "./index";

export type AnalyticsPeriodType = "daily" | "weekly";

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
  period: AnalyticsPeriodType;
  timezone: typeof TIMEZONE;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  attendance: AttendanceMetric[];
  revenue: RevenueMetric[];
  periodBreakdown: {
    period: AnalyticsPeriodType;
    items: PeriodBreakdownItem[];
  };
  categoryPerformance: CategoryPerformanceMetric[];
  servicesComparison: ServicePerformanceMetric[];
  filters: AnalyticsFilters;
}
