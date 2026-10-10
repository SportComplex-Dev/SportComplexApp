// Mock en memoria de PrismaClient para pruebas unitarias de repositorios

import { randomUUID } from "node:crypto";

export interface MockCategoria {
  id: number;
  nombre: string;
  tipo: string;
}

export interface MockFranja {
  id: number;
  servicioId: number;
  diaSemana: number;
  horaInicio: Date;
  horaFin: Date;
}

export interface MockDisponibilidad {
  id: bigint;
  servicioId: number;
  franjaId: number;
  fecha: Date;
  cuposTotales: number;
  cuposOcupados: number;
  bloqueadaMantenimiento: boolean;
}

export interface MockServicio {
  id: number;
  categoriaId: number;
  nombre: string;
  capacidadMaxima: number;
  tarifa: number | string;
  modalidad: string;
  tipoPiscina: string | null;
  estado: string;
}

export interface MockReserva {
  id: string;
  disponibilidadId: bigint;
  estado: string;
  titularId?: string;
  cantidadCupos?: number;
  expiraEn?: Date | null;
  inhabilitacionId?: number | null;
  pagoId?: string | null;
  creadoEn?: Date;
  canal?: string;
  subtotal?: number | string;
  descuentoPct?: number | string;
  total?: number | string;
}

export interface MockPago {
  id: string;
  usuarioId: string;
  membresiaId?: number | null;
  tipo: string;
  stripePaymentIntentId: string;
  monto: string | number;
  estado: string;
  creadoEn?: Date;
}

export interface MockMembresia {
  id: number;
  usuarioId: string;
  estado: string;
}

export interface MockUsuario {
  id: string;
  nombre: string;
  correo?: string;
  estado?: string;
  deletedAt?: Date | null;
  rolId?: number;
  rolNombre?: string;
}

export interface MockTicketQr {
  id: string;
  reservaId: string;
  codigoUuid: string;
  usadoPor: string | null;
  estado: string;
  usadoEn: Date | null;
  /** Opcional: solo lo siembran las pruebas que leen el comprobante. */
  emitidoEn?: Date;
}

export interface MockLecturaAcceso {
  id: bigint;
  ticketId: string;
  empleadoId: string;
  asignacionId: number | null;
  modo: string;
  resultado: string;
  fechaHora: Date;
}

export interface MockAsignacionPuesto {
  id: number;
  empleadoId: string;
  servicioId: number;
  inicioTurno: Date;
  finTurno: Date;
}

function pickDisponibilidad(
  disp: { franja?: { horaInicio: Date; horaFin: Date } } | undefined,
  shape: Record<string, any>,
): Record<string, any> | undefined {
  if (!disp) return undefined;
  const picked: Record<string, any> = {};
  for (const key of Object.keys(shape)) {
    if (!shape[key]) continue;
    if (key === "franja") {
      const franjaShape = shape[key].select ?? shape[key].include;
      picked[key] = franjaShape
        ? Object.fromEntries(
            Object.keys(franjaShape)
              .filter((fk) => franjaShape[fk])
              .map((fk) => [fk, (disp.franja as any)?.[fk]]),
          )
        : disp.franja;
    } else {
      picked[key] = (disp as any)[key];
    }
  }
  return picked;
}

export function createMockPrisma() {
  const categorias: MockCategoria[] = [];
  const servicios: MockServicio[] = [];
  const franjas: MockFranja[] = [];
  const disponibilidades: MockDisponibilidad[] = [];
  const reservas: MockReserva[] = [];
  const pagos: MockPago[] = [];
  const membresias: MockMembresia[] = [];
  const usuarios: MockUsuario[] = [];
  const tickets: MockTicketQr[] = [];
  const lecturas: MockLecturaAcceso[] = [];
  const asignaciones: MockAsignacionPuesto[] = [];
  const inhabilitaciones: Array<Record<string, unknown>> = [];

  let catIdSeq = 1;
  let servIdSeq = 1;
  let franjaIdSeq = 1;
  let dispIdSeq = 1n;
  let reservaIdSeq = 1;
  let pagoIdSeq = 1;
  let lecturaIdSeq = 1n;
  let asignacionIdSeq = 1;
  let transactionQueue = Promise.resolve();

  /**
   * Proyecta una reserva con sus relaciones (TSK-BE-19): disponibilidad +
   * franja + servicio, titular y boleto emitido. Alimenta
   * `reserva.findUnique` simulando `include`/`select` anidado SIN restrictor
   * de campos, para que un repositorio que se pase de selects quede expuesto
   * en las pruebas.
   */
  function reservaEnriquecida(reserva: MockReserva): Record<string, unknown> {
    const disponibilidad = disponibilidades.find((d) => d.id === reserva.disponibilidadId);
    return {
      ...reserva,
      disponibilidad: disponibilidad
        ? {
            ...disponibilidad,
            franja: franjas.find((f) => f.id === disponibilidad.franjaId),
            servicio: servicios.find((s) => s.id === disponibilidad.servicioId),
          }
        : null,
      titular: usuarios.find((u) => u.id === reserva.titularId) ?? null,
      ticketQr: tickets.find((t) => t.reservaId === reserva.id) ?? null,
    };
  }

  const mock: any = {
    _state: {
      categorias,
      servicios,
      franjas,
      disponibilidades,
      reservas,
      pagos,
      membresias,
      usuarios,
      tickets,
      lecturas,
      asignaciones,
      inhabilitaciones,
    },
    $transaction: async (arg: any) => {
      if (typeof arg === "function") {
        let releaseTransaction!: () => void;
        const previousTransaction = transactionQueue;
        transactionQueue = new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
        await previousTransaction;
        const snapCategorias = [...categorias];
        const snapServicios = [...servicios];
        const snapFranjas = [...franjas];
        const snapDisponibilidades = [...disponibilidades];
        const snapReservas = [...reservas];
        const snapPagos = [...pagos];
        const snapMembresias = [...membresias];
        const snapUsuarios = [...usuarios];
        const snapTickets = [...tickets];
        const snapLecturas = [...lecturas];
        const snapAsignaciones = [...asignaciones];
        const snapInhabilitaciones = [...inhabilitaciones];
        try {
          return await arg(mock);
        } catch (err) {
          categorias.length = 0;
          categorias.push(...snapCategorias);
          servicios.length = 0;
          servicios.push(...snapServicios);
          franjas.length = 0;
          franjas.push(...snapFranjas);
          disponibilidades.length = 0;
          disponibilidades.push(...snapDisponibilidades);
          reservas.length = 0;
          reservas.push(...snapReservas);
          pagos.length = 0;
          pagos.push(...snapPagos);
          membresias.length = 0;
          membresias.push(...snapMembresias);
          usuarios.length = 0;
          usuarios.push(...snapUsuarios);
          tickets.length = 0;
          tickets.push(...snapTickets);
          lecturas.length = 0;
          lecturas.push(...snapLecturas);
          asignaciones.length = 0;
          asignaciones.push(...snapAsignaciones);
          inhabilitaciones.length = 0;
          inhabilitaciones.push(...snapInhabilitaciones);
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
    categoriaServicio: {
      async findUnique({ where }: any) {
        if (where.id !== undefined) {
          return categorias.find((c) => c.id === where.id) || null;
        }
        if (where.nombre !== undefined) {
          return categorias.find((c) => c.nombre.toLowerCase() === where.nombre.toLowerCase()) || null;
        }
        return null;
      },
      async findMany({ include, _orderBy }: any = {}) {
        return categorias.map((cat) => ({
          ...cat,
          ...(include?._count
            ? {
                _count: {
                  servicios: servicios.filter((s) => s.categoriaId === cat.id).length,
                },
              }
            : {}),
        }));
      },
      async create({ data }: any) {
        const item: MockCategoria = {
          id: catIdSeq++,
          nombre: data.nombre,
          tipo: data.tipo,
        };
        categorias.push(item);
        return item;
      },
      async update({ where, data }: any) {
        const cat = categorias.find((c) => c.id === where.id);
        if (!cat) throw new Error("Not found");
        if (data.nombre) cat.nombre = data.nombre;
        if (data.tipo) cat.tipo = data.tipo;
        return cat;
      },
      async delete({ where }: any) {
        const idx = categorias.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [deleted] = categorias.splice(idx, 1);
        return deleted;
      },
    },
    servicio: {
      async findUnique({ where, include }: any) {
        let serv: MockServicio | undefined;
        if (where.id !== undefined) {
          serv = servicios.find((s) => s.id === where.id);
        } else if (where.nombre !== undefined) {
          serv = servicios.find((s) => s.nombre.toLowerCase() === where.nombre.toLowerCase());
        }
        if (!serv) return null;

        const res: any = { ...serv };
        if (include?.categoria) {
          res.categoria = categorias.find((c) => c.id === serv!.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = franjas.filter((f) => f.servicioId === serv!.id);
        }
        if (include?.disponibilidades) {
          res.disponibilidades = disponibilidades.filter((d) => d.servicioId === serv!.id);
        }
        return res;
      },
      async findMany({ where, include }: any = {}) {
        let list = [...servicios];
        if (where?.categoriaId) {
          list = list.filter((s) => s.categoriaId === where.categoriaId);
        }
        if (where?.estado) {
          list = list.filter((s) => s.estado === where.estado);
        }
        if (where?.nombre?.contains) {
          const term = where.nombre.contains.toLowerCase();
          list = list.filter((s) => s.nombre.toLowerCase().includes(term));
        }

        return list.map((serv) => {
          const res: any = { ...serv };
          if (include?.categoria) {
            res.categoria = categorias.find((c) => c.id === serv.categoriaId);
          }
          if (include?.franjasHorarias) {
            res.franjasHorarias = franjas.filter((f) => f.servicioId === serv.id);
          }
          if (include?._count?.select?.disponibilidades) {
            res._count = {
              disponibilidades: disponibilidades.filter((d) => d.servicioId === serv.id).length,
            };
          }
          return res;
        });
      },
      async count({ where }: any = {}) {
        if (where?.categoriaId) {
          return servicios.filter((s) => s.categoriaId === where.categoriaId).length;
        }
        return servicios.length;
      },
      async create({ data, include }: any) {
        const item: MockServicio = {
          id: servIdSeq++,
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          capacidadMaxima: data.capacidadMaxima,
          tarifa: data.tarifa,
          modalidad: data.modalidad,
          tipoPiscina: data.tipoPiscina ?? null,
          estado: data.estado ?? "ACTIVO",
        };
        servicios.push(item);

        const createdFranjas: MockFranja[] = [];
        if (data.franjasHorarias?.create) {
          for (const f of data.franjasHorarias.create) {
            const franjaItem: MockFranja = {
              id: franjaIdSeq++,
              servicioId: item.id,
              diaSemana: f.diaSemana,
              horaInicio: f.horaInicio,
              horaFin: f.horaFin,
            };
            franjas.push(franjaItem);
            createdFranjas.push(franjaItem);
          }
        }

        const res: any = { ...item };
        if (include?.categoria) {
          res.categoria = categorias.find((c) => c.id === item.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = createdFranjas;
        }
        return res;
      },
      async update({ where, data, include }: any) {
        const serv = servicios.find((s) => s.id === where.id);
        if (!serv) throw new Error("Not found");
        if (data.nombre) serv.nombre = data.nombre;
        if (data.categoriaId) serv.categoriaId = data.categoriaId;
        if (data.capacidadMaxima) serv.capacidadMaxima = data.capacidadMaxima;
        if (data.tarifa !== undefined) serv.tarifa = data.tarifa;
        if (data.modalidad) serv.modalidad = data.modalidad;
        if (data.tipoPiscina !== undefined) serv.tipoPiscina = data.tipoPiscina;
        if (data.estado) serv.estado = data.estado;

        const res: any = { ...serv };
        if (include?.categoria) {
          res.categoria = categorias.find((c) => c.id === serv.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = franjas.filter((f) => f.servicioId === serv.id);
        }
        return res;
      },
      async delete({ where }: any) {
        const idx = servicios.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [deleted] = servicios.splice(idx, 1);
        return deleted;
      },
    },
    franjaHoraria: {
      async deleteMany({ where }: any) {
        const initial = franjas.length;
        const remaining = franjas.filter((f) => f.servicioId !== where.servicioId);
        franjas.length = 0;
        franjas.push(...remaining);
        return { count: initial - remaining.length };
      },
      async createMany({ data }: any) {
        for (const f of data) {
          franjas.push({
            id: franjaIdSeq++,
            servicioId: f.servicioId,
            diaSemana: f.diaSemana,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
          });
        }
        return { count: data.length };
      },
    },
    disponibilidad: {
      async findMany({ where, include }: any = {}) {
        return disponibilidades
          .filter((d) => {
            if (where?.servicioId !== undefined && d.servicioId !== where.servicioId) return false;
            if (where?.servicio?.estado !== undefined) {
              const service = servicios.find((item) => item.id === d.servicioId);
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
              servicio: servicios.find((s) => s.id === d.servicioId),
              franja: franjas.find((f) => f.id === d.franjaId),
            };
            if (include?.reservas) {
              const relationWhere = include.reservas.where;
              result.reservas = reservas
                .filter((reservation) => {
                  if (reservation.disponibilidadId !== d.id) return false;
                  if (
                    relationWhere?.estado !== undefined &&
                    reservation.estado !== relationWhere.estado
                  ) return false;
                  const expiresAt = relationWhere?.expiraEn?.lte;
                  if (expiresAt && (!reservation.expiraEn || reservation.expiraEn > expiresAt)) {
                    return false;
                  }
                  return true;
                })
                .map(({ cantidadCupos }) => ({ cantidadCupos }));
            }
            return result;
          });
      },
      async findUnique({ where, include }: any) {
        const disp = disponibilidades.find((d) => d.id === where.id);
        if (!disp) return null;
        return {
          ...disp,
          ...(include?.servicio ? { servicio: servicios.find((s) => s.id === disp.servicioId) } : {}),
          ...(include?.franja ? { franja: franjas.find((f) => f.id === disp.franjaId) } : {}),
        };
      },
      async update({ where, data }: any) {
        const disp = disponibilidades.find((d) => d.id === where.id);
        if (!disp) throw new Error("Not found");
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
      async findFirst({ where }: any) {
        return disponibilidades.find(
          (d) =>
            d.servicioId === where.servicioId &&
            d.cuposOcupados > where.cuposOcupados.gt,
        ) ?? null;
      },
      async upsert({ where, create, update }: any) {
        const { servicioId, franjaId, fecha } = where.servicioId_franjaId_fecha;
        const dateStr = fecha.toISOString().split("T")[0];
        let existing = disponibilidades.find(
          (d) =>
            d.servicioId === servicioId &&
            d.franjaId === franjaId &&
            d.fecha.toISOString().split("T")[0] === dateStr,
        );
        if (!existing) {
          existing = {
            id: dispIdSeq++,
            servicioId: create.servicioId,
            franjaId: create.franjaId,
            fecha: create.fecha,
            cuposTotales: create.cuposTotales,
            cuposOcupados: create.cuposOcupados ?? 0,
            bloqueadaMantenimiento: create.bloqueadaMantenimiento ?? false,
          };
          disponibilidades.push(existing);
        } else {
          Object.assign(existing, update);
        }
        return existing;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const disponibilidad of disponibilidades) {
          if (disponibilidad.servicioId === where.servicioId) {
            Object.assign(disponibilidad, data);
            count++;
          }
        }
        return { count };
      },
      async deleteMany({ where }: any) {
        const initial = disponibilidades.length;
        const remaining = disponibilidades.filter((d) => d.servicioId !== where.servicioId);
        disponibilidades.length = 0;
        disponibilidades.push(...remaining);
        return { count: initial - remaining.length };
      },
    },
    reserva: {
      async findUnique({ where, select }: any) {
        if (where.id === undefined) return null;
        const base = reservas.find((reservation) => reservation.id === where.id) ?? null;
        if (!base) return null;
        // TSK-BE-19: se enriquece con las relaciones del comprobante. El mock
        // devuelve MÁS campos de los que pide `select` en las relaciones
        // (pagoId incluido): el repositorio debe descartar lo que no pide.
        const full = reservaEnriquecida(base);
        if (!select) return full;
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          if (key in full) picked[key] = (full as any)[key];
        }
        return picked;
      },
      async findMany({ where, orderBy, take, include, select }: any = {}) {
        let list = reservas.filter((reservation) => {
          if (
            typeof where?.id === "string" &&
            reservation.id !== where.id
          ) return false;
          if (
            where?.disponibilidadId !== undefined &&
            typeof where.disponibilidadId !== "object" &&
            reservation.disponibilidadId !== where.disponibilidadId
          ) return false;
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
            const disp = disponibilidades.find((d) => d.id === reservation.disponibilidadId);
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
          if (
            where?.expiraEn?.lte &&
            (!reservation.expiraEn || reservation.expiraEn > where.expiraEn.lte)
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
          const disp = disponibilidades.find((d) => d.id === reservation.disponibilidadId);
          const fullDisponibilidad = disp
            ? {
                ...disp,
                servicio: servicios.find((s) => s.id === disp.servicioId),
                franja: franjas.find((f) => f.id === disp.franjaId),
              }
            : undefined;

          // `select` estricto (como Prisma): solo los campos escalares pedidos.
          if (select) {
            const picked: Record<string, any> = {};
            for (const key of Object.keys(select)) {
              if (!select[key]) continue;
              if (key === "disponibilidad") {
                const nested = select[key].select ?? select[key].include;
                picked[key] = nested ? pickDisponibilidad(fullDisponibilidad, nested) : fullDisponibilidad;
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
              res[key] = nested ? pickDisponibilidad(fullDisponibilidad, nested) : fullDisponibilidad;
            } else if (key === "ticketQr") {
              res[key] = tickets.find((t) => t.reservaId === reservation.id);
            } else if (key === "titular") {
              res[key] = usuarios.find((u) => u.id === reservation.titularId);
            }
          }
          return res;
        };
        return list.map(withRelations);
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const reservation of reservas) {
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
          id: `reservation-${reservaIdSeq++}`,
          ...data,
        };
        reservas.push(reservation);
        if (include?.disponibilidad) {
          return {
            ...reservation,
            disponibilidad: {
              ...disponibilidades.find((d) => d.id === data.disponibilidadId),
              servicio: servicios.find(
                (s) => s.id === disponibilidades.find((d) => d.id === data.disponibilidadId)?.servicioId,
              ),
              franja: franjas.find(
                (f) => f.id === disponibilidades.find((d) => d.id === data.disponibilidadId)?.franjaId,
              ),
            },
          };
        }
        return reservation;
      },
      async count({ where }: any) {
        let list = [...reservas];
        if (where?.disponibilidad?.servicioId) {
          const servId = where.disponibilidad.servicioId;
          const dispIds = disponibilidades.filter((d) => d.servicioId === servId).map((d) => d.id);
          list = list.filter((r) => dispIds.includes(r.disponibilidadId));
        }
        if (where?.estado?.in) {
          list = list.filter((r) => where.estado.in.includes(r.estado));
        }
        return list.length;
      },
    },
    pago: {
      async findUnique({ where }: any) {
        if (where.id !== undefined) {
          return pagos.find((p) => p.id === where.id) ?? null;
        }
        if (where.stripePaymentIntentId !== undefined) {
          return (
            pagos.find((p) => p.stripePaymentIntentId === where.stripePaymentIntentId) ?? null
          );
        }
        return null;
      },
      async create({ data }: any) {
        // Respeta el UNIQUE "pago_stripe_payment_intent_id_key" (TSK-BD-06).
        if (
          pagos.some((p) => p.stripePaymentIntentId === data.stripePaymentIntentId)
        ) {
          const err = new Error(
            "Unique constraint failed on the fields: (`stripe_payment_intent_id`)",
          ) as Error & { code: string };
          err.code = "P2002";
          throw err;
        }
        const item: MockPago = {
          id: `payment-${pagoIdSeq++}`,
          usuarioId: data.usuarioId,
          membresiaId: data.membresiaId ?? null,
          tipo: data.tipo,
          stripePaymentIntentId: data.stripePaymentIntentId,
          monto: data.monto,
          estado: data.estado,
          creadoEn: new Date(),
        };
        pagos.push(item);
        return item;
      },
      async update({ where, data }: any) {
        const pago = pagos.find((p) => p.id === where.id);
        if (!pago) throw new Error("Not found");
        if (data.estado !== undefined) pago.estado = data.estado;
        if (data.monto !== undefined) pago.monto = data.monto;
        return pago;
      },
    },
    membresia: {
      async findUnique({ where }: any) {
        return membresias.find((m) => m.id === where.id) ?? null;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const membresia of membresias) {
          if (where?.id !== undefined && membresia.id !== where.id) continue;
          if (where?.estado?.not !== undefined && membresia.estado === where.estado.not) {
            continue;
          }
          if (where?.estado !== undefined && typeof where.estado === "string") {
            if (membresia.estado !== where.estado) continue;
          }
          if (data.estado !== undefined) membresia.estado = data.estado;
          count++;
        }
        return { count };
      },
    },
    usuario: {
      async findUnique({ where, select }: any) {
        const usuario = where.id !== undefined
          ? usuarios.find((u) => u.id === where.id)
          : where.correo !== undefined
            ? usuarios.find((u) => u.correo === where.correo)
            : undefined;
        if (!usuario) return null;
        if (!select) return usuario;

        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          if (!select[key]) continue;
          if (key === "rol") {
            picked.rol = { nombre: usuario.rolNombre };
          } else {
            picked[key] = (usuario as any)[key];
          }
        }
        return picked;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const usuario of usuarios) {
          if (where.id !== undefined && usuario.id !== where.id) continue;
          if (where.rolId !== undefined && usuario.rolId !== where.rolId) continue;
          if (where.estado !== undefined && usuario.estado !== where.estado) continue;
          if (
            where.deletedAt !== undefined &&
            usuario.deletedAt?.getTime() !== where.deletedAt?.getTime()
          ) continue;
          Object.assign(usuario, data);
          count++;
        }
        return { count };
      },
    },
    ticketQr: {
      async create({ data }: any) {
        // Respeta el UNIQUE "ticket_qr_reserva_id_key" (TSK-BE-10).
        if (tickets.some((t) => t.reservaId === data.reservaId)) {
          const err = new Error(
            "Unique constraint failed on the fields: (`reserva_id`)",
          ) as Error & { code: string };
          err.code = "P2002";
          throw err;
        }
        const item: MockTicketQr = {
          id: `ticket-${tickets.length + 1}`,
          reservaId: data.reservaId,
          codigoUuid: data.codigoUuid ?? randomUUID(),
          usadoPor: null,
          estado: data.estado ?? "EMITIDO",
          usadoEn: null,
          emitidoEn: new Date(),
        };
        tickets.push(item);
        return item;
      },
      async findUnique({ where, include, select }: any) {
        let ticket: MockTicketQr | undefined;
        if (where.id !== undefined) ticket = tickets.find((t) => t.id === where.id);
        else if (where.codigoUuid !== undefined) {
          ticket = tickets.find((t) => t.codigoUuid === where.codigoUuid);
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
          const reserva = reservas.find((r) => r.id === ticket!.reservaId);
          const disp = reserva
            ? disponibilidades.find((d) => d.id === reserva.disponibilidadId)
            : undefined;
          res.reserva = {
            ...reserva,
            titular: reserva ? usuarios.find((u) => u.id === (reserva as any).titularId) : undefined,
            disponibilidad: disp
              ? {
                  ...disp,
                  servicio: servicios.find((s) => s.id === disp.servicioId),
                  franja: franjas.find((f) => f.id === disp.franjaId),
                }
              : undefined,
          };
        }
        return res;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const ticket of tickets) {
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
          id: lecturaIdSeq++,
          ticketId: data.ticketId,
          empleadoId: data.empleadoId,
          asignacionId: data.asignacionId ?? null,
          modo: data.modo,
          resultado: data.resultado,
          fechaHora: data.fechaHora ?? new Date(),
        };
        lecturas.push(item);
        return item;
      },
      async findMany({ where }: any = {}) {
        return lecturas.filter((lectura) => {
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
          id: asignacionIdSeq++,
          empleadoId: data.empleadoId,
          servicioId: data.servicioId,
          inicioTurno: data.inicioTurno,
          finTurno: data.finTurno,
        };
        asignaciones.push(item);
        return item;
      },
      async findFirst({ where }: any = {}) {
        const candidatas = asignaciones
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
    inhabilitacionServicio: {
      async create({ data }: any) {
        const entry = { id: inhabilitaciones.length + 1, ...data };
        inhabilitaciones.push(entry);
        return entry;
      },
      async update({ where, data }: any) {
        const entry = inhabilitaciones.find((item) => item.id === where.id);
        if (!entry) throw new Error("Not found");
        Object.assign(entry, data);
        return entry;
      },
    },
  };
  return mock;
}
