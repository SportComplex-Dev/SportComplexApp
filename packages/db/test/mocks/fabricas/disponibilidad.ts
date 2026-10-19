import type { MockState, MockDisponibilidad } from "../estado.js";

export function crearMockDisponibilidad(
  state: MockState,
  overrides: Partial<MockDisponibilidad> = {},
): MockDisponibilidad {
  const disp: MockDisponibilidad = {
    id: overrides.id ?? state.seq.dispIdSeq++,
    servicioId: overrides.servicioId ?? 1,
    franjaId: overrides.franjaId ?? 1,
    fecha: overrides.fecha ?? new Date(),
    cuposTotales: overrides.cuposTotales ?? 10,
    cuposOcupados: overrides.cuposOcupados ?? 0,
    bloqueadaMantenimiento: overrides.bloqueadaMantenimiento ?? false,
  };
  state.disponibilidades.push(disp);
  return disp;
}

export function crearDisponibilidadHandler(state: MockState) {
  return {
    async findMany({ where, include }: any = {}) {
      return state.disponibilidades
        .filter((d) => {
          if (Array.isArray(where?.id?.in) && !where.id.in.includes(d.id)) return false;
          if (where?.servicioId !== undefined && d.servicioId !== where.servicioId) return false;
          if (where?.servicio?.estado !== undefined) {
            const service = state.servicios.find((item) => item.id === d.servicioId);
            if (service?.estado !== where.servicio.estado) return false;
          }
          if (
            where?.fecha &&
            d.fecha.toISOString().slice(0, 10) !== where.fecha.toISOString().slice(0, 10)
          ) return false;
          return true;
        })
        .map((d) => {
          const result: Record<string, unknown> = {
            ...d,
            servicio: state.servicios.find((s) => s.id === d.servicioId),
            franja: state.franjas.find((f) => f.id === d.franjaId),
          };
          if (include?.reservas) {
            const relationWhere = include.reservas.where;
            result.reservas = state.reservas
              .filter((reservation) => {
                if (reservation.disponibilidadId !== d.id) return false;
                if (
                  relationWhere?.estado !== undefined &&
                  typeof relationWhere.estado === "string" &&
                  reservation.estado !== relationWhere.estado
                ) return false;
                if (
                  relationWhere?.estado !== undefined &&
                  Array.isArray(relationWhere.estado?.in) &&
                  !relationWhere.estado.in.includes(reservation.estado)
                ) return false;
                const expiresAt = relationWhere?.expiraEn?.lte;
                if (expiresAt && (!reservation.expiraEn || reservation.expiraEn > expiresAt)) {
                  return false;
                }
                return true;
              });
          }
          return result;
        });
    },
    async findUnique({ where, include }: any) {
      const disp = state.disponibilidades.find((d) => d.id === where.id);
      if (!disp) return null;
      return {
        ...disp,
        ...(include?.servicio ? { servicio: state.servicios.find((s) => s.id === disp.servicioId) } : {}),
        ...(include?.franja ? { franja: state.franjas.find((f) => f.id === disp.franjaId) } : {}),
      };
    },
    async update({ where, data }: any) {
      const disp = state.disponibilidades.find((d) => d.id === where.id);
      if (!disp) throw new Error("Not found");
      if (data.bloqueadaMantenimiento !== undefined) {
        disp.bloqueadaMantenimiento = data.bloqueadaMantenimiento;
      }
      if (data.cuposOcupados?.increment !== undefined) {
        disp.cuposOcupados += data.cuposOcupados.increment;
      }
      if (data.cuposOcupados?.decrement !== undefined) {
        disp.cuposOcupados -= data.cuposOcupados.decrement;
      }
      if (data.cuposTotales !== undefined) disp.cuposTotales = data.cuposTotales;
      if (disp.cuposOcupados < 0 || disp.cuposOcupados > disp.cuposTotales) {
        throw new Error("Disponibilidad cupo constraint failed");
      }
      return disp;
    },
    async findFirst({ where, include }: any) {
      if (!where) return state.disponibilidades[0] ?? null;
      const d = state.disponibilidades.find((disp) => {
        if (where.id !== undefined && disp.id !== where.id) return false;
        if (where.servicioId !== undefined && disp.servicioId !== where.servicioId) return false;
        if (where.cuposOcupados?.gt !== undefined && disp.cuposOcupados <= where.cuposOcupados.gt) return false;
        return true;
      }) ?? null;
      if (!d) return null;
      if (include?.franja) {
        const franja = state.franjas.find((f) => f.id === d.franjaId);
        return { ...d, franja };
      }
      return d;
    },
    async create({ data, include }: any) {
      const item: MockDisponibilidad = {
        id: state.seq.dispIdSeq++,
        servicioId: data.servicioId,
        franjaId: data.franjaId,
        fecha: data.fecha,
        cuposTotales: data.cuposTotales,
        cuposOcupados: data.cuposOcupados ?? 0,
        bloqueadaMantenimiento: data.bloqueadaMantenimiento ?? false,
      };
      state.disponibilidades.push(item);
      if (include?.franja) {
        const franja = state.franjas.find((f) => f.id === item.franjaId);
        return { ...item, franja };
      }
      return item;
    },
    async upsert({ where, create, update }: any) {
      const { servicioId, franjaId, fecha } = where.servicioId_franjaId_fecha;
      const dateStr = fecha.toISOString().split("T")[0];
      let existing = state.disponibilidades.find(
        (d) =>
          d.servicioId === servicioId &&
          d.franjaId === franjaId &&
          d.fecha.toISOString().split("T")[0] === dateStr,
      );
      if (!existing) {
        existing = {
          id: state.seq.dispIdSeq++,
          servicioId: create.servicioId,
          franjaId: create.franjaId,
          fecha: create.fecha,
          cuposTotales: create.cuposTotales,
          cuposOcupados: create.cuposOcupados ?? 0,
          bloqueadaMantenimiento: create.bloqueadaMantenimiento ?? false,
        };
        state.disponibilidades.push(existing);
      } else {
        Object.assign(existing, update);
      }
      return existing;
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const disponibilidad of state.disponibilidades) {
        if (where.servicioId !== undefined && disponibilidad.servicioId !== where.servicioId) continue;
        if (where.id?.in !== undefined && !where.id.in.includes(disponibilidad.id)) continue;
        Object.assign(disponibilidad, data);
        count++;
      }
      return { count };
    },
    async deleteMany({ where }: any) {
      const initial = state.disponibilidades.length;
      const remaining = state.disponibilidades.filter((d) => d.servicioId !== where.servicioId);
      state.disponibilidades.length = 0;
      state.disponibilidades.push(...remaining);
      return { count: initial - remaining.length };
    },
  };
}
