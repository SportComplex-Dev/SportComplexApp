import type { MockState, MockReserva } from "../estado.js";
import { pickDisponibilidad, reservaEnriquecida } from "../utilidades.js";

export function crearMockReserva(state: MockState, overrides: Partial<MockReserva> = {}): MockReserva {
  const reserva: MockReserva = {
    id: overrides.id ?? `res-${state.seq.reservaIdSeq++}`,
    disponibilidadId: overrides.disponibilidadId ?? 1n,
    estado: overrides.estado ?? "CONFIRMADA",
    titularId: overrides.titularId ?? "user-1",
    cantidadCupos: overrides.cantidadCupos ?? 1,
    creadoEn: overrides.creadoEn ?? new Date(),
    subtotal: overrides.subtotal ?? 50000,
    total: overrides.total ?? 50000,
  };
  state.reservas.push(reserva);
  return reserva;
}

export function crearReservaHandler(state: MockState) {
  return {
    async findUnique({ where, select }: any) {
      if (where.id === undefined) return null;
      const base = state.reservas.find((reservation) => reservation.id === where.id) ?? null;
      if (!base) return null;
      // TSK-BE-19: se enriquece con las relaciones del comprobante. El mock
      // devuelve MÁS campos de los que pide `select` en las relaciones
      // (pagoId incluido): el repositorio debe descartar lo que no pide.
      const full = reservaEnriquecida(state, base);
      if (!select) return full;
      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(select)) {
        if (key in full) picked[key] = (full as any)[key];
      }
      return picked;
    },
    async findFirst({ where, include, select }: any = {}) {
      const results = await (this as any).findMany({ where, include, select, take: 1 });
      return results[0] ?? null;
    },
    async findMany({ where, orderBy, take, include, select }: any = {}) {
      let list = state.reservas.filter((reservation) => {
        if (
          typeof where?.id === "string" &&
          reservation.id !== where.id
        ) return false;
        if (
          Array.isArray(where?.id?.in) &&
          !where.id.in.includes(reservation.id)
        ) return false;
        if (
          where?.disponibilidadId !== undefined &&
          typeof where.disponibilidadId !== "object" &&
          reservation.disponibilidadId !== where.disponibilidadId
        ) return false;
        if (where?.pagoId !== undefined && reservation.pagoId !== where.pagoId) return false;
        if (typeof where?.estado === "string" && reservation.estado !== where.estado) return false;
        if (Array.isArray(where?.estado?.in) && !where.estado.in.includes(reservation.estado)) {
          return false;
        }
        if (
          where?.disponibilidadId?.in &&
          !where.disponibilidadId.in.includes(reservation.disponibilidadId)
        ) return false;
        if (where?.titularId && reservation.titularId !== where.titularId) return false;
        if (where?.disponibilidad) {
          const disp = state.disponibilidades.find((d) => d.id === reservation.disponibilidadId);
          if (!disp) return false;
          if (
            where.disponibilidad.servicioId !== undefined &&
            disp.servicioId !== where.disponibilidad.servicioId
          ) {
            return false;
          }
          if (
            where.disponibilidad.fecha &&
            disp.fecha.toISOString().slice(0, 10) !==
              where.disponibilidad.fecha.toISOString().slice(0, 10)
          ) {
            return false;
          }
        }
        if (typeof where?.canal === "string" && reservation.canal !== where.canal) return false;
        if (
          where?.expiraEn?.lte &&
          (!reservation.expiraEn || reservation.expiraEn > where.expiraEn.lte)
        ) return false;
        if (
          where?.expiraEn?.gt &&
          (!reservation.expiraEn || reservation.expiraEn <= where.expiraEn.gt)
        ) return false;
        if (where?.OR) {
          const createdAt = reservation.creadoEn;
          if (!createdAt) return false;
          const matchesCursor = where.OR.some((condition: any) => {
            if (condition.creadoEn?.lt) return createdAt < condition.creadoEn.lt;
            return (
              condition.creadoEn instanceof Date &&
              createdAt.getTime() === condition.creadoEn.getTime() &&
              reservation.id < condition.id.lt
            );
          });
          if (!matchesCursor) return false;
        }
        return true;
      });
      if (orderBy) {
        const createdDirection = Array.isArray(orderBy)
          ? orderBy[0]?.creadoEn
          : orderBy.creadoEn;
        const idDirection = Array.isArray(orderBy)
          ? orderBy[1]?.id
          : orderBy.id;
        const createdMultiplier = createdDirection === "asc" ? 1 : -1;
        const idMultiplier = idDirection === "asc" ? 1 : -1;
        list = [...list].sort((a, b) => {
          const createdAtDifference =
            ((a.creadoEn?.getTime() ?? 0) - (b.creadoEn?.getTime() ?? 0)) *
            createdMultiplier;
          return createdAtDifference || a.id.localeCompare(b.id) * idMultiplier;
        });
      }
      if (typeof take === "number") list = list.slice(0, take);
      const withRelations = (reservation: any) => {
        const disp = state.disponibilidades.find((d) => d.id === reservation.disponibilidadId);
        const fullDisponibilidad = disp
          ? {
              ...disp,
              servicio: state.servicios.find((s) => s.id === disp.servicioId),
              franja: state.franjas.find((f) => f.id === disp.franjaId),
            }
          : undefined;

        // `select` estricto (como Prisma): solo los campos escalares pedidos.
        if (select) {
          const picked: Record<string, any> = {};
          for (const key of Object.keys(select)) {
            if (!select[key]) continue;
            if (key === "disponibilidad") {
              const nested = select[key].select ?? select[key].include;
              picked[key] = nested ? pickDisponibilidad(fullDisponibilidad as any, nested) : fullDisponibilidad;
            } else {
              picked[key] = reservation[key];
            }
          }
          return picked;
        }

        // Sin `select`: se conservan todos los escalares y se agregan las
        // relaciones pedidas por `include`.
        const res: any = { ...reservation };
        for (const key of Object.keys(include ?? {})) {
          if (!include[key]) continue;
          if (key === "disponibilidad") {
            const nested = include[key].select ?? include[key].include;
            res[key] = nested ? pickDisponibilidad(fullDisponibilidad as any, nested) : fullDisponibilidad;
          } else if (key === "ticketQr") {
            res[key] = state.tickets.find((t) => t.reservaId === reservation.id);
          } else if (key === "titular") {
            res[key] = state.usuarios.find((u) => u.id === reservation.titularId);
          } else if (key === "pago") {
            res[key] = reservation.pagoId ? state.pagos.find((p) => p.id === reservation.pagoId) : null;
          }
        }
        return res;
      };
      return list.map(withRelations);
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const reservation of state.reservas) {
        if (typeof where?.id === "string" && reservation.id !== where.id) continue;
        if (where?.id?.in && !where.id.in.includes(reservation.id)) continue;
        if (
          where?.disponibilidadId !== undefined &&
          typeof where.disponibilidadId !== "object" &&
          reservation.disponibilidadId !== where.disponibilidadId
        ) continue;
        if (typeof where?.estado === "string" && reservation.estado !== where.estado) continue;
        if (where?.estado?.in && !where.estado.in.includes(reservation.estado)) continue;
        if (where?.expiraEn?.lte && (!reservation.expiraEn || reservation.expiraEn > where.expiraEn.lte)) {
          continue;
        }
        if (data.estado !== undefined) reservation.estado = data.estado;
        if (data.pagoId !== undefined) reservation.pagoId = data.pagoId;
        if (data.vendedorId !== undefined) reservation.vendedorId = data.vendedorId;
        if (data.canal !== undefined) reservation.canal = data.canal;
        if (data.expiraEn !== undefined) reservation.expiraEn = data.expiraEn;
        if (data.inhabilitacionId !== undefined) {
          reservation.inhabilitacionId = data.inhabilitacionId;
        }
        count++;
      }
      return { count };
    },
    async create({ data, include }: any) {
      const reservation = {
        id: `reservation-${state.seq.reservaIdSeq++}`,
        ...data,
      };
      state.reservas.push(reservation);
      if (include?.disponibilidad) {
        return {
          ...reservation,
          disponibilidad: {
            ...state.disponibilidades.find((d) => d.id === data.disponibilidadId),
            servicio: state.servicios.find(
              (s) => s.id === state.disponibilidades.find((d) => d.id === data.disponibilidadId)?.servicioId,
            ),
            franja: state.franjas.find(
              (f) => f.id === state.disponibilidades.find((d) => d.id === data.disponibilidadId)?.franjaId,
            ),
          },
        };
      }
      return reservation;
    },
    async update({ where, data }: any) {
      const r = state.reservas.find((res) => res.id === where.id);
      if (!r) throw new Error("Not found");
      if (data.pagoId !== undefined) r.pagoId = data.pagoId;
      if (data.estado !== undefined) r.estado = data.estado;
      return r;
    },
    async count({ where }: any) {
      let list = [...state.reservas];
      if (where?.disponibilidad?.servicioId) {
        const servId = where.disponibilidad.servicioId;
        const dispIds = state.disponibilidades.filter((d) => d.servicioId === servId).map((d) => d.id);
        list = list.filter((r) => dispIds.includes(r.disponibilidadId));
      }
      if (where?.estado?.in) {
        list = list.filter((r) => where.estado.in.includes(r.estado));
      }
      return list.length;
    },
  };
}
