/**
 * Derivación de las filas de las vistas `vw_kpi_*` a partir del estado en
 * memoria del doble de Prisma (`MockState`).
 *
 * Vive en `test/` a propósito: es código de pruebas. El repositorio de
 * analítica no sabe que existe; solo ejecuta `$queryRawUnsafe` y agrega las
 * filas recibidas.
 */
import type {
  MockDisponibilidad,
  MockReserva,
  MockState,
  MockTicketQr,
} from "./estado.js";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha ISO (YYYY-MM-DD) en America/Bogota (UTC-5, sin DST). */
export function toBogotaDate(date: Date): string {
  return new Date(date.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function pasaFiltroFecha(
  value: Date | string | null | undefined,
  startDate: string | null,
  endDate: string | null,
): boolean {
  // Sin filtros, la vista devuelve todas las filas (incluidas fechas nulas).
  if (!startDate && !endDate) return true;
  if (!value) return false;
  const dateStr = toBogotaDate(new Date(value));
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

function reservasConfirmadas(state: MockState): MockReserva[] {
  return state.reservas.filter((r) => r.estado === "CONFIRMADA");
}

function disponibilidadesDeServicio(
  state: MockState,
  servicioId: number,
): MockDisponibilidad[] {
  return state.disponibilidades.filter((d) => d.servicioId === servicioId);
}

function ticketsUsados(state: MockState): MockTicketQr[] {
  return state.tickets.filter((t) => t.estado === "USADO" && t.usadoEn);
}

function derivarAsistencia(state: MockState, startDate: string | null, endDate: string | null) {
  const porFecha = new Map<string, { tickets: number; usuarios: Set<string> }>();

  for (const ticket of ticketsUsados(state)) {
    if (!pasaFiltroFecha(ticket.usadoEn, startDate, endDate)) continue;
    const fecha = toBogotaDate(new Date(ticket.usadoEn as Date));
    const entry = porFecha.get(fecha) ?? { tickets: 0, usuarios: new Set<string>() };
    entry.tickets += 1;
    const reserva = state.reservas.find((r) => r.id === ticket.reservaId);
    if (reserva?.titularId) entry.usuarios.add(reserva.titularId);
    porFecha.set(fecha, entry);
  }

  return Array.from(porFecha.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, entry]) => ({
      fecha_uso: fecha,
      total_afluencia_tickets: entry.tickets,
      usuarios_unicos_ingresados: entry.usuarios.size,
    }));
}

function derivarIngresos(state: MockState, startDate: string | null, endDate: string | null) {
  const porFechaYTipo = new Map<string, { fecha: string; tipo: string; count: number; total: number }>();

  for (const pago of state.pagos) {
    if (pago.estado !== "APROBADO") continue;
    const creadoEn = pago.creadoEn ?? new Date();
    if (!pasaFiltroFecha(creadoEn, startDate, endDate)) continue;
    const fecha = toBogotaDate(new Date(creadoEn));
    const tipo = pago.tipo || "RESERVA";
    const key = `${fecha}|${tipo}`;
    const entry = porFechaYTipo.get(key) ?? { fecha, tipo, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(pago.monto || 0);
    porFechaYTipo.set(key, entry);
  }

  return Array.from(porFechaYTipo.values())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((entry) => ({
      fecha_pago: entry.fecha,
      tipo_pago: entry.tipo,
      total_transacciones: entry.count,
      ingresos_totales: entry.total.toFixed(2),
    }));
}

function derivarCategorias(state: MockState, startDate: string | null, endDate: string | null) {
  const rows = [];

  for (const categoria of state.categorias) {
    const servicios = state.servicios.filter((s) => s.categoriaId === categoria.id);
    const servicioIds = new Set(servicios.map((s) => s.id));
    const disponibilidadIds = new Set(
      state.disponibilidades
        .filter((d) => servicioIds.has(d.servicioId))
        .map((d) => d.id),
    );

    const reservas = reservasConfirmadas(state).filter(
      (r) =>
        disponibilidadIds.has(r.disponibilidadId) &&
        pasaFiltroFecha(r.creadoEn, startDate, endDate),
    );

    // La consulta real usa INNER JOIN: una categoría sin reservas no aparece.
    if (reservas.length === 0) continue;

    const idsUnicos = new Set(reservas.map((r) => r.id));
    const cupos = reservas.reduce((acc, r) => acc + (r.cantidadCupos ?? 1), 0);
    const ingresos = reservas.reduce((acc, r) => acc + Number(r.total ?? 0), 0);

    rows.push({
      categoria_id: categoria.id,
      categoria_nombre: categoria.nombre,
      categoria_tipo: categoria.tipo,
      total_reservas: idsUnicos.size,
      total_cupos_vendidos: cupos,
      total_ingresos: ingresos.toFixed(2),
    });
  }

  return rows.sort((a, b) => Number(b.total_ingresos) - Number(a.total_ingresos));
}

function derivarServicios(state: MockState, startDate: string | null, endDate: string | null) {
  const rows = [];

  for (const servicio of state.servicios) {
    const disponibilidadIds = new Set(
      disponibilidadesDeServicio(state, servicio.id).map((d) => d.id),
    );

    const ventas = reservasConfirmadas(state).filter(
      (r) =>
        disponibilidadIds.has(r.disponibilidadId) &&
        pasaFiltroFecha(r.creadoEn, startDate, endDate),
    );
    const reservaIds = new Set(ventas.map((r) => r.id));

    const usos = ticketsUsados(state).filter(
      (t) => reservaIds.has(t.reservaId) && pasaFiltroFecha(t.usadoEn, startDate, endDate),
    );

    rows.push({
      servicio_id: servicio.id,
      servicio_nombre: servicio.nombre,
      modalidad: servicio.modalidad,
      total_vendidos: ventas.reduce((acc, r) => acc + (r.cantidadCupos ?? 1), 0),
      total_usados: usos.length,
      total_recaudado: ventas.reduce((acc, r) => acc + Number(r.total ?? 0), 0).toFixed(2),
    });
  }

  return rows.sort((a, b) => Number(b.total_vendidos) - Number(a.total_vendidos));
}

/**
 * Despacha el SQL de analítica al derivador correspondiente.
 *
 * `$queryRawUnsafe(sql, $1, $2)` recibe las fechas como parámetros; los
 * derivadores replican el `WHERE` de las vistas con zona America/Bogota.
 */
export function consultarVistasAnalitica(
  state: MockState,
  sql: string,
  params: unknown[],
) {
  const startDate = (params[0] as string | null | undefined) ?? null;
  const endDate = (params[1] as string | null | undefined) ?? null;

  if (sql.includes("vw_kpi_daily_attendance")) {
    return derivarAsistencia(state, startDate, endDate);
  }
  if (sql.includes("vw_kpi_daily_revenue")) {
    return derivarIngresos(state, startDate, endDate);
  }
  if (sql.includes("vw_kpi_category_performance") || sql.includes("FROM categoria_servicio cs")) {
    return derivarCategorias(state, startDate, endDate);
  }
  if (sql.includes("vw_kpi_services_sold_vs_used") || sql.includes("WITH ventas AS")) {
    return derivarServicios(state, startDate, endDate);
  }

  throw new Error(`MockPrisma: consulta analítica no soportada:\n${sql}`);
}
