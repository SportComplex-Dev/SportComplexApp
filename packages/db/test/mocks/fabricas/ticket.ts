import { randomUUID } from "node:crypto";
import type { MockState, MockTicketQr, MockLecturaAcceso, MockAsignacionPuesto } from "../estado.js";

export function crearMockTicketQr(state: MockState, overrides: Partial<MockTicketQr> = {}): MockTicketQr {
  const ticket: MockTicketQr = {
    id: overrides.id ?? `ticket-${state.tickets.length + 1}`,
    reservaId: overrides.reservaId ?? "res-1",
    codigoUuid: overrides.codigoUuid ?? randomUUID(),
    usadoPor: overrides.usadoPor ?? null,
    estado: overrides.estado ?? "EMITIDO",
    usadoEn: overrides.usadoEn ?? null,
    emitidoEn: overrides.emitidoEn ?? new Date(),
  };
  state.tickets.push(ticket);
  return ticket;
}

export function crearTicketHandler(state: MockState) {
  return {
    ticketQr: {
      async create({ data }: any) {
        if (state.tickets.some((t) => t.reservaId === data.reservaId)) {
          const err = new Error(
            "Unique constraint failed on the fields: (`reserva_id`)",
          ) as Error & { code: string };
          err.code = "P2002";
          throw err;
        }
        const item: MockTicketQr = {
          id: `ticket-${state.tickets.length + 1}`,
          reservaId: data.reservaId,
          codigoUuid: data.codigoUuid ?? randomUUID(),
          usadoPor: null,
          estado: data.estado ?? "EMITIDO",
          usadoEn: null,
          emitidoEn: new Date(),
        };
        state.tickets.push(item);
        return item;
      },
      async findUnique({ where, include, select }: any) {
        let ticket: MockTicketQr | undefined;
        if (where.id !== undefined) ticket = state.tickets.find((t) => t.id === where.id);
        else if (where.codigoUuid !== undefined) {
          ticket = state.tickets.find((t) => t.codigoUuid === where.codigoUuid);
        }
        if (!ticket) return null;
        if (select) {
          const picked: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            if (select[key]) picked[key] = (ticket as any)[key];
          }
          return picked;
        }
        const res: any = { ...ticket };
        if (include?.reserva) {
          const reserva = state.reservas.find((r) => r.id === ticket!.reservaId);
          const disp = reserva
            ? state.disponibilidades.find((d) => d.id === reserva.disponibilidadId)
            : undefined;
          res.reserva = {
            ...reserva,
            titular: reserva ? state.usuarios.find((u) => u.id === (reserva as any).titularId) : undefined,
            disponibilidad: disp
              ? {
                  ...disp,
                  servicio: state.servicios.find((s) => s.id === disp.servicioId),
                  franja: state.franjas.find((f) => f.id === disp.franjaId),
                }
              : undefined,
          };
        }
        return res;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const ticket of state.tickets) {
          if (where?.id !== undefined && ticket.id !== where.id) continue;
          if (where?.estado !== undefined && ticket.estado !== where.estado) continue;
          if (where?.codigoUuid !== undefined && ticket.codigoUuid !== where.codigoUuid) continue;
          Object.assign(ticket, data);
          count++;
        }
        return { count };
      },
    },
    lecturaAcceso: {
      async create({ data }: any) {
        const item: MockLecturaAcceso = {
          id: state.seq.lecturaIdSeq++,
          ticketId: data.ticketId,
          empleadoId: data.empleadoId,
          asignacionId: data.asignacionId ?? null,
          modo: data.modo,
          resultado: data.resultado,
          fechaHora: data.fechaHora ?? new Date(),
        };
        state.lecturas.push(item);
        return item;
      },
      async findMany({ where }: any = {}) {
        return state.lecturas.filter((lectura) => {
          if (where?.ticketId !== undefined && lectura.ticketId !== where.ticketId) return false;
          if (where?.empleadoId !== undefined && lectura.empleadoId !== where.empleadoId) return false;
          if (where?.modo !== undefined && lectura.modo !== where.modo) return false;
          if (where?.resultado !== undefined && lectura.resultado !== where.resultado) return false;
          return true;
        });
      },
    },
    asignacionPuesto: {
      async create({ data }: any) {
        const item: MockAsignacionPuesto = {
          id: state.seq.asignacionIdSeq++,
          empleadoId: data.empleadoId,
          servicioId: data.servicioId,
          inicioTurno: data.inicioTurno,
          finTurno: data.finTurno,
        };
        state.asignaciones.push(item);
        return item;
      },
      async findFirst({ where }: any = {}) {
        const candidatas = state.asignaciones
          .filter((a) => {
            if (where?.empleadoId !== undefined && a.empleadoId !== where.empleadoId) return false;
            if (where?.servicioId !== undefined && a.servicioId !== where.servicioId) return false;
            if (where?.inicioTurno?.lte !== undefined && a.inicioTurno > where.inicioTurno.lte) {
              return false;
            }
            if (where?.finTurno?.gte !== undefined && a.finTurno < where.finTurno.gte) return false;
            return true;
          })
          .sort((a, b) => b.inicioTurno.getTime() - a.inicioTurno.getTime());
        return candidatas[0] ?? null;
      },
    },
  };
}
