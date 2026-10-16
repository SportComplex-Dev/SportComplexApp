import { prisma } from "../../../client";
import type { EstadoReserva, Prisma } from "@prisma/client";

export interface AdminBookingFilters {
  limit?: number;
  offset?: number;
  status?: string;
  serviceId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ServiceOccupancyMetric {
  serviceId: number;
  serviceName: string;
  count: number;
}

export interface AdminBookingMetrics {
  todayTotal: number;
  confirmedCount: number;
  pendingCount: number;
  byService: ServiceOccupancyMetric[];
}

export interface AdminBookingItem {
  id: string;
  disponibilidadId: string;
  titularId: string;
  vendedorId: string | null;
  pagoId: string | null;
  membresiaId: number | null;
  inhabilitacionId: number | null;
  cantidadCupos: number;
  canal: string;
  estado: EstadoReserva;
  subtotal: number;
  descuentoPct: number;
  total: number;
  expiraEn: Date | null;
  creadoEn: Date;
  titular: {
    id: string;
    nombre: string;
    correo: string;
    avatar: string | null;
  };
  disponibilidad: {
    id: string;
    fecha: Date;
    servicioId: number;
    franjaId: number;
    servicio: {
      id: number;
      nombre: string;
      tarifa: number;
      categoria: {
        id: number;
        nombre: string;
        tipo: string;
      };
    };
    franja: {
      id: number;
      diaSemana: number;
      horaInicio: Date;
      horaFin: Date;
    };
  };
  ticketQr: {
    id: string;
    codigoUuid: string;
    estado: string;
    emitidoEn: Date;
    usadoEn: Date | null;
  } | null;
  pago: {
    id: string;
    monto: number;
    tipo: string;
    stripePaymentIntentId: string;
    estado: string;
  } | null;
}

export interface ListAdminBookingsResult {
  items: AdminBookingItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  metrics: AdminBookingMetrics;
}

/**
 * TSK-BE-27 / SCRUM-212
 * Consulta administrativa consolidada de reservas con filtros a nivel SQL en PostgreSQL y métricas de ocupación.
 */
export async function listAdminBookings(
  filters: AdminBookingFilters = {},
  now = new Date(),
): Promise<ListAdminBookingsResult> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const where: Prisma.ReservaWhereInput = {};

  if (filters.status) {
    if (filters.status === "CANCELADA") {
      where.estado = { in: ["CANCELADA_ADMINISTRATIVA", "CANCELADA_PAGO"] };
    } else {
      where.estado = filters.status as EstadoReserva;
    }
  }

  const dispConditions: Prisma.DisponibilidadWhereInput = {};
  if (filters.serviceId) {
    dispConditions.servicioId = filters.serviceId;
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) {
      dateFilter.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      dateFilter.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }
    dispConditions.fecha = dateFilter;
  }

  if (Object.keys(dispConditions).length > 0) {
    where.disponibilidad = { is: dispConditions };
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);
    where.OR = [
      { titular: { is: { nombre: { contains: term, mode: "insensitive" } } } },
      { titular: { is: { correo: { contains: term, mode: "insensitive" } } } },
      ...(isUuid ? [{ id: term }] : []),
    ];
  }

  // Fecha hoy en America/Bogota para métrica todayTotal
  const bogotaDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayStart = new Date(`${bogotaDateStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${bogotaDateStr}T23:59:59.999Z`);

  const [total, rows, todayTotal, confirmedCount, pendingCount, services] = await Promise.all([
    prisma.reserva.count({ where }),
    prisma.reserva.findMany({
      where,
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit,
      include: {
        titular: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            avatar: true,
          },
        },
        disponibilidad: {
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                tarifa: true,
                categoria: {
                  select: {
                    id: true,
                    nombre: true,
                    tipo: true,
                  },
                },
              },
            },
            franja: {
              select: {
                id: true,
                diaSemana: true,
                horaInicio: true,
                horaFin: true,
              },
            },
          },
        },
        ticketQr: {
          select: {
            id: true,
            codigoUuid: true,
            estado: true,
            emitidoEn: true,
            usadoEn: true,
          },
        },
        pago: {
          select: {
            id: true,
            monto: true,
            tipo: true,
            stripePaymentIntentId: true,
            estado: true,
          },
        },
      },
    }),
    prisma.reserva.count({
      where: {
        disponibilidad: {
          is: {
            fecha: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
    }),
    prisma.reserva.count({ where: { estado: "CONFIRMADA" } }),
    prisma.reserva.count({ where: { estado: "PENDIENTE_PAGO" } }),
    prisma.servicio.findMany({
      select: { id: true, nombre: true },
      orderBy: { id: "asc" },
    }),
  ]);

  // Agregación de reservas confirmadas por servicio
  const serviceCounts = await prisma.disponibilidad.findMany({
    where: {
      reservas: {
        some: { estado: "CONFIRMADA" },
      },
    },
    select: {
      servicioId: true,
      _count: {
        select: {
          reservas: {
            where: { estado: "CONFIRMADA" },
          },
        },
      },
    },
  });

  const countMap = new Map<number, number>();
  for (const item of serviceCounts) {
    const current = countMap.get(item.servicioId) ?? 0;
    countMap.set(item.servicioId, current + item._count.reservas);
  }

  const byService: ServiceOccupancyMetric[] = services.map((s) => ({
    serviceId: s.id,
    serviceName: s.nombre,
    count: countMap.get(s.id) ?? 0,
  }));

  const items: AdminBookingItem[] = rows.map((r) => ({
    id: r.id,
    disponibilidadId: String(r.disponibilidadId),
    titularId: r.titularId,
    vendedorId: r.vendedorId,
    pagoId: r.pagoId,
    membresiaId: r.membresiaId,
    inhabilitacionId: r.inhabilitacionId,
    cantidadCupos: r.cantidadCupos,
    canal: r.canal,
    estado: r.estado,
    subtotal: Number(r.subtotal),
    descuentoPct: Number(r.descuentoPct),
    total: Number(r.total),
    expiraEn: r.expiraEn,
    creadoEn: r.creadoEn,
    titular: r.titular,
    disponibilidad: {
      id: String(r.disponibilidad.id),
      fecha: r.disponibilidad.fecha,
      servicioId: r.disponibilidad.servicioId,
      franjaId: r.disponibilidad.franjaId,
      servicio: {
        id: r.disponibilidad.servicio.id,
        nombre: r.disponibilidad.servicio.nombre,
        tarifa: Number(r.disponibilidad.servicio.tarifa),
        categoria: r.disponibilidad.servicio.categoria,
      },
      franja: r.disponibilidad.franja,
    },
    ticketQr: r.ticketQr,
    pago: r.pago
      ? {
          id: r.pago.id,
          monto: Number(r.pago.monto),
          tipo: r.pago.tipo,
          stripePaymentIntentId: r.pago.stripePaymentIntentId,
          estado: r.pago.estado,
        }
      : null,
  }));

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
    metrics: {
      todayTotal,
      confirmedCount,
      pendingCount,
      byService,
    },
  };
}
