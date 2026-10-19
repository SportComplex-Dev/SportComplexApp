import { randomUUID } from "node:crypto";
import { crearEstadoInicial } from "./estado.js";
import { consultarVistasAnalitica } from "./analitica.js";
import { crearUsuarioHandler } from "./fabricas/usuario.js";
import { crearServicioHandler } from "./fabricas/servicio.js";
import { crearDisponibilidadHandler } from "./fabricas/disponibilidad.js";
import { crearReservaHandler } from "./fabricas/reserva.js";
import { crearPagoHandler } from "./fabricas/pago.js";
import { crearTicketHandler } from "./fabricas/ticket.js";
import { crearMembresiaHandler } from "./fabricas/membresia.js";

export * from "./estado.js";
export * from "./analitica.js";
export * from "./utilidades.js";
export * from "./fabricas/usuario.js";
export * from "./fabricas/servicio.js";
export * from "./fabricas/disponibilidad.js";
export * from "./fabricas/reserva.js";
export * from "./fabricas/pago.js";
export * from "./fabricas/ticket.js";
export * from "./fabricas/membresia.js";
export * from "./escenarios/flujo-reserva.js";
export * from "./escenarios/cobro-pos.js";
export * from "./escenarios/inscripcion-torneo.js";

export function createMockPrisma() {
  const state = crearEstadoInicial();
  let transactionQueue = Promise.resolve();

  const usuarioHandler = crearUsuarioHandler(state);
  const servicioHandlers = crearServicioHandler(state);
  const disponibilidadHandler = crearDisponibilidadHandler(state);
  const reservaHandler = crearReservaHandler(state);
  const pagoHandler = crearPagoHandler(state);
  const ticketHandlers = crearTicketHandler(state);
  const membresiaHandlers = crearMembresiaHandler(state);

  const mock: any = {
    _state: state,
    $transaction: async (arg: any) => {
      if (typeof arg === "function") {
        let releaseTransaction!: () => void;
        const previousTransaction = transactionQueue;
        transactionQueue = new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
        await previousTransaction;

        const snapCategorias = [...state.categorias];
        const snapServicios = [...state.servicios];
        const snapFranjas = [...state.franjas];
        const snapDisponibilidades = [...state.disponibilidades];
        const snapReservas = [...state.reservas];
        const snapPagos = [...state.pagos];
        const snapMembresias = [...state.membresias];
        const snapPlanesMembresia = [...state.planesMembresia];
        const snapUsuarios = [...state.usuarios];
        const snapTickets = [...state.tickets];
        const snapLecturas = [...state.lecturas];
        const snapAsignaciones = [...state.asignaciones];
        const snapInhabilitaciones = [...state.inhabilitaciones];
        const snapTorneos = [...state.torneos];
        const snapBloqueosTorneo = [...state.bloqueosTorneo];
        const snapInscripcionesTorneo = [...state.inscripcionesTorneo];

        try {
          return await arg(mock);
        } catch (err) {
          state.categorias.length = 0;
          state.categorias.push(...snapCategorias);
          state.servicios.length = 0;
          state.servicios.push(...snapServicios);
          state.franjas.length = 0;
          state.franjas.push(...snapFranjas);
          state.disponibilidades.length = 0;
          state.disponibilidades.push(...snapDisponibilidades);
          state.reservas.length = 0;
          state.reservas.push(...snapReservas);
          state.pagos.length = 0;
          state.pagos.push(...snapPagos);
          state.membresias.length = 0;
          state.membresias.push(...snapMembresias);
          state.planesMembresia.length = 0;
          state.planesMembresia.push(...snapPlanesMembresia);
          state.usuarios.length = 0;
          state.usuarios.push(...snapUsuarios);
          state.tickets.length = 0;
          state.tickets.push(...snapTickets);
          state.lecturas.length = 0;
          state.lecturas.push(...snapLecturas);
          state.asignaciones.length = 0;
          state.asignaciones.push(...snapAsignaciones);
          state.inhabilitaciones.length = 0;
          state.inhabilitaciones.push(...snapInhabilitaciones);
          state.torneos.length = 0;
          state.torneos.push(...snapTorneos);
          state.bloqueosTorneo.length = 0;
          state.bloqueosTorneo.push(...snapBloqueosTorneo);
          state.inscripcionesTorneo.length = 0;
          state.inscripcionesTorneo.push(...snapInscripcionesTorneo);
          throw err;
        } finally {
          releaseTransaction();
        }
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    },
    async $queryRaw() {
      return [];
    },
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      return consultarVistasAnalitica(state, sql, params);
    },
    categoriaServicio: servicioHandlers.categoriaServicio,
    servicio: servicioHandlers.servicio,
    franjaHoraria: servicioHandlers.franjaHoraria,
    disponibilidad: disponibilidadHandler,
    reserva: reservaHandler,
    pago: pagoHandler,
    usuario: usuarioHandler,
    rol: {
      async findFirst({ where, select }: any = {}) {
        const roles = state.roles;
        let found: { id: number; nombre: string } | null = null;
        if (where?.nombre) {
          if (typeof where.nombre === "string") {
            found = roles.find((r) => r.nombre === where.nombre) ?? null;
          } else if (Array.isArray(where.nombre.in)) {
            found = roles.find((r) => where.nombre.in.includes(r.nombre)) ?? null;
          }
        } else if (where?.OR) {
          const names = where.OR.map((o: any) => o.nombre);
          found = roles.find((r) => names.includes(r.nombre)) ?? null;
        } else {
          found = roles[0] ?? null;
        }
        if (!found) return null;
        if (!select) return found;
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          picked[key] = (found as any)[key];
        }
        return picked;
      },
      async create({ data, select }: any) {
        const created = {
          id: Math.max(0, ...state.roles.map((r) => r.id)) + 1,
          nombre: data.nombre,
        };
        state.roles.push(created);
        if (!select) return created;
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          picked[key] = (created as any)[key];
        }
        return picked;
      },
    },
    ticketQr: ticketHandlers.ticketQr,
    lecturaAcceso: ticketHandlers.lecturaAcceso,
    asignacionPuesto: ticketHandlers.asignacionPuesto,
    inhabilitacionServicio: {
      async findFirst({ where }: any = {}) {
        return (
          state.inhabilitaciones.find((item: any) => {
            if (where?.servicioId !== undefined && item.servicioId !== where.servicioId) return false;
            if (where?.fechaInicio?.lte !== undefined && new Date(item.fechaInicio) > new Date(where.fechaInicio.lte)) return false;
            if (where?.fechaFin?.gte !== undefined) {
              if (!item.fechaFin) return true;
              if (new Date(item.fechaFin) < new Date(where.fechaFin.gte)) return false;
            }
            return true;
          }) ?? null
        );
      },
      async create({ data }: any) {
        const entry = { id: state.inhabilitaciones.length + 1, ...data };
        state.inhabilitaciones.push(entry);
        return entry;
      },
      async update({ where, data }: any) {
        const entry = state.inhabilitaciones.find((item) => item.id === where.id);
        if (!entry) throw new Error("Not found");
        Object.assign(entry, data);
        return entry;
      },
    },
    torneo: {
      async create({ data, include }: any) {
        const item: any = {
          id: data.id ?? randomUUID(),
          adminId: data.adminId,
          categoriaId: data.categoriaId,
          titulo: data.titulo,
          descripcion: data.descripcion ?? null,
          nivel: data.nivel,
          fechaInicio: new Date(data.fechaInicio),
          fechaFin: new Date(data.fechaFin),
          cuposTotales: data.cuposTotales,
          cuposOcupados: data.cuposOcupados ?? 0,
          precioInscripcion: data.precioInscripcion ?? 0,
          estado: data.estado ?? "BORRADOR",
          creadoEn: new Date(),
          actualizadoEn: new Date(),
          eliminadoEn: data.eliminadoEn ?? null,
        };
        state.torneos.push(item);

        if (data.bloqueos?.create) {
          for (const b of data.bloqueos.create) {
            state.bloqueosTorneo.push({
              id: state.bloqueosTorneo.length + 1,
              torneoId: item.id,
              servicioId: b.servicioId,
              horaInicio: new Date(b.horaInicio),
              horaFin: new Date(b.horaFin),
            });
          }
        }

        const res: any = { ...item };
        if (include?.categoria) {
          res.categoria = state.categorias.find((c) => c.id === item.categoriaId) ?? null;
        }
        if (include?.bloqueos) {
          res.bloqueos = state.bloqueosTorneo
            .filter((b) => b.torneoId === item.id)
            .map((b) => ({
              ...b,
              servicio: include.bloqueos.include?.servicio
                ? state.servicios.find((s) => s.id === b.servicioId) ?? null
                : undefined,
            }));
        }
        return res;
      },
      async findUnique({ where, include }: any) {
        const item = state.torneos.find((t) => t.id === where.id);
        if (!item) return null;
        const res: any = { ...item };
        if (include?.categoria) {
          res.categoria = state.categorias.find((c) => c.id === item.categoriaId) ?? null;
        }
        if (include?.bloqueos) {
          res.bloqueos = state.bloqueosTorneo
            .filter((b) => b.torneoId === item.id)
            .map((b) => ({
              ...b,
              servicio: include.bloqueos.include?.servicio
                ? state.servicios.find((s) => s.id === b.servicioId) ?? null
                : undefined,
            }));
        }
        if (include?.inscripciones) {
          res.inscripciones = state.inscripcionesTorneo
            .filter((i) => i.torneoId === item.id)
            .map((i) => ({
              ...i,
              usuario: state.usuarios.find((u) => u.id === i.usuarioId) ?? null,
            }));
        }
        return res;
      },
      async findMany({ where, include, skip, take }: any = {}) {
        let list = [...state.torneos];
        if (where?.eliminadoEn === null) {
          list = list.filter((t) => t.eliminadoEn === null || t.eliminadoEn === undefined);
        } else if (where?.eliminadoEn !== undefined) {
          list = list.filter((t) => t.eliminadoEn !== null && t.eliminadoEn !== undefined);
        }
        if (where?.estado) {
          if (typeof where.estado === "object" && Array.isArray(where.estado.in)) {
            list = list.filter((t) => where.estado.in.includes(t.estado));
          } else {
            list = list.filter((t) => t.estado === where.estado);
          }
        }
        if (where?.categoriaId) {
          list = list.filter((t) => t.categoriaId === where.categoriaId);
        }
        if (where?.titulo?.contains) {
          const s = where.titulo.contains.toLowerCase();
          list = list.filter((t) => t.titulo.toLowerCase().includes(s));
        }
        if (typeof skip === "number") list = list.slice(skip);
        if (typeof take === "number") list = list.slice(0, take);
        return list.map((item) => {
          const res: any = { ...item };
          if (include?.categoria) {
            res.categoria = state.categorias.find((c) => c.id === item.categoriaId) ?? null;
          }
          if (include?.bloqueos) {
            res.bloqueos = state.bloqueosTorneo
              .filter((b) => b.torneoId === item.id)
              .map((b) => ({
                ...b,
                servicio: state.servicios.find((s) => s.id === b.servicioId) ?? null,
              }));
          }
          if (include?._count?.select?.inscripciones) {
            res._count = {
              inscripciones: state.inscripcionesTorneo.filter((i) => i.torneoId === item.id).length,
            };
          }
          return res;
        });
      },
      async update({ where, data, include }: any) {
        const item = state.torneos.find((t) => t.id === where.id);
        if (!item) throw new Error("Torneo no encontrado");
        if (data.titulo !== undefined) item.titulo = data.titulo;
        if (data.descripcion !== undefined) item.descripcion = data.descripcion;
        if (data.categoriaId !== undefined) item.categoriaId = data.categoriaId;
        if (data.nivel !== undefined) item.nivel = data.nivel;
        if (data.fechaInicio !== undefined) item.fechaInicio = new Date(data.fechaInicio);
        if (data.fechaFin !== undefined) item.fechaFin = new Date(data.fechaFin);
        if (data.cuposTotales !== undefined) item.cuposTotales = data.cuposTotales;
        if (data.precioInscripcion !== undefined) item.precioInscripcion = data.precioInscripcion;
        if (data.estado !== undefined) item.estado = data.estado;
        if (data.eliminadoEn !== undefined) item.eliminadoEn = data.eliminadoEn;
        if (data.cuposOcupados?.increment !== undefined) {
          item.cuposOcupados = (item.cuposOcupados ?? 0) + data.cuposOcupados.increment;
        } else if (data.cuposOcupados !== undefined) {
          item.cuposOcupados = data.cuposOcupados;
        }
        item.actualizadoEn = new Date();
        const res: any = { ...item };
        if (include?.categoria) {
          res.categoria = state.categorias.find((c) => c.id === item.categoriaId) ?? null;
        }
        if (include?.bloqueos) {
          res.bloqueos = state.bloqueosTorneo
            .filter((b) => b.torneoId === item.id)
            .map((b) => ({
              ...b,
              servicio: state.servicios.find((s) => s.id === b.servicioId) ?? null,
            }));
        }
        return res;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const t of state.torneos) {
          if (where?.id !== undefined && t.id !== where.id) continue;
          if (
            where?.cuposOcupados?.lt !== undefined &&
            (t.cuposOcupados ?? 0) >= where.cuposOcupados.lt
          ) {
            continue;
          }
          if (data.cuposOcupados?.increment !== undefined) {
            t.cuposOcupados = (t.cuposOcupados ?? 0) + data.cuposOcupados.increment;
          } else if (data.cuposOcupados !== undefined) {
            t.cuposOcupados = data.cuposOcupados;
          }
          if (data.estado !== undefined) {
            t.estado = data.estado;
          }
          t.actualizadoEn = new Date();
          count++;
        }
        return { count };
      },
      async delete({ where }: any) {
        const idx = state.torneos.findIndex((t) => t.id === where.id);
        if (idx === -1) throw new Error("Torneo no encontrado");
        const [deleted] = state.torneos.splice(idx, 1);
        return deleted;
      },
    },
    torneoBloqueo: {
      async findMany({ where }: any = {}) {
        return state.bloqueosTorneo.filter((b) => {
          if (where?.torneoId && b.torneoId !== where.torneoId) return false;
          if (where?.servicioId && b.servicioId !== where.servicioId) return false;
          return true;
        });
      },
      async create({ data }: any) {
        const item = {
          id: state.bloqueosTorneo.length + 1,
          torneoId: data.torneoId,
          servicioId: data.servicioId,
          horaInicio: new Date(data.horaInicio),
          horaFin: new Date(data.horaFin),
        };
        state.bloqueosTorneo.push(item);
        return item;
      },
      async createMany({ data }: any) {
        const items = Array.isArray(data) ? data : [data];
        for (const d of items) {
          state.bloqueosTorneo.push({
            id: state.bloqueosTorneo.length + 1,
            torneoId: d.torneoId,
            servicioId: d.servicioId,
            horaInicio: new Date(d.horaInicio),
            horaFin: new Date(d.horaFin),
          });
        }
        return { count: items.length };
      },
      async deleteMany({ where }: any = {}) {
        let removed = 0;
        for (let i = state.bloqueosTorneo.length - 1; i >= 0; i--) {
          const b = state.bloqueosTorneo[i];
          if (!where?.torneoId || b.torneoId === where.torneoId) {
            state.bloqueosTorneo.splice(i, 1);
            removed++;
          }
        }
        return { count: removed };
      },
    },
    inscripcionTorneo: {
      async create({ data, include }: any) {
        if (
          state.inscripcionesTorneo.some(
            (i) => i.torneoId === data.torneoId && i.usuarioId === data.usuarioId,
          )
        ) {
          const err = new Error(
            "Unique constraint failed on the fields: (`torneo_id`,`usuario_id`)",
          ) as Error & { code: string };
          err.code = "P2002";
          throw err;
        }
        const item: any = {
          id: data.id ?? `inscripcion-${state.inscripcionesTorneo.length + 1}`,
          torneoId: data.torneoId,
          usuarioId: data.usuarioId,
          nombrePareja: data.nombrePareja ?? null,
          pagoId: data.pagoId ?? null,
          estado: data.estado ?? "PENDIENTE_PAGO",
          ticketCodigoUuid: data.ticketCodigoUuid ?? randomUUID(),
          ticketEstado: data.ticketEstado ?? "EMITIDO",
          ticketUsadoEn: null,
          ticketUsadoPor: null,
          creadoEn: new Date(),
        };
        state.inscripcionesTorneo.push(item);
        const res: any = { ...item };
        if (include?.torneo) {
          res.torneo = state.torneos.find((t) => t.id === item.torneoId) ?? null;
        }
        if (include?.usuario) {
          res.usuario = state.usuarios.find((u) => u.id === item.usuarioId) ?? null;
        }
        return res;
      },
      async findUnique({ where, include }: any) {
        let item: any;
        if (where?.id) {
          item = state.inscripcionesTorneo.find((i) => i.id === where.id);
        } else if (where?.ticketCodigoUuid) {
          item = state.inscripcionesTorneo.find((i) => i.ticketCodigoUuid === where.ticketCodigoUuid);
        } else if (where?.torneoId_usuarioId) {
          item = state.inscripcionesTorneo.find(
            (i) => i.torneoId === where.torneoId_usuarioId.torneoId &&
                   i.usuarioId === where.torneoId_usuarioId.usuarioId,
          );
        }
        if (!item) return null;
        const res: any = { ...item };
        if (include?.torneo) {
          const t = state.torneos.find((tor) => tor.id === item.torneoId);
          res.torneo = t
            ? {
                ...t,
                categoria: include.torneo.include?.categoria
                  ? state.categorias.find((c) => c.id === t.categoriaId) ?? null
                  : undefined,
              }
            : null;
        }
        if (include?.usuario) {
          res.usuario = state.usuarios.find((u) => u.id === item.usuarioId) ?? null;
        }
        return res;
      },
      async findFirst({ where, include }: any = {}) {
        const list = await this.findMany({ where });
        if (!list || list.length === 0) return null;
        return this.findUnique({ where: { id: list[0].id }, include });
      },
      async findMany({ where }: any = {}) {
        return state.inscripcionesTorneo.filter((i) => {
          if (where?.id) {
            if (typeof where.id === "object" && where.id.not !== undefined) {
              if (i.id === where.id.not) return false;
            } else if (i.id !== where.id) {
              return false;
            }
          }
          if (where?.torneoId) {
            if (typeof where.torneoId === "object" && Array.isArray(where.torneoId.in)) {
              if (!where.torneoId.in.includes(i.torneoId)) return false;
            } else if (i.torneoId !== where.torneoId) {
              return false;
            }
          }
          if (where?.usuarioId && i.usuarioId !== where.usuarioId) return false;
          if (where?.pagoId && i.pagoId !== where.pagoId) return false;
          if (where?.estado) {
            if (typeof where.estado === "object" && Array.isArray(where.estado.in)) {
              if (!where.estado.in.includes(i.estado)) return false;
            } else if (i.estado !== where.estado) {
              return false;
            }
          }
          return true;
        });
      },
      async update({ where, data, include }: any) {
        const item = state.inscripcionesTorneo.find((i) => i.id === where.id);
        if (!item) throw new Error("Inscripción no encontrada");
        Object.assign(item, data);
        const res: any = { ...item };
        if (include?.torneo) {
          res.torneo = state.torneos.find((t) => t.id === item.torneoId) ?? null;
        }
        if (include?.usuario) {
          res.usuario = state.usuarios.find((u) => u.id === item.usuarioId) ?? null;
        }
        return res;
      },
    },
    membresia: membresiaHandlers.membresia,
    planMembresia: membresiaHandlers.planMembresia,
  };

  return mock;
}
