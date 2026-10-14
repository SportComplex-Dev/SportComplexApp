import type { MockState, MockServicio, MockCategoria, MockFranja } from "../estado.js";

export function crearMockCategoria(state: MockState, overrides: Partial<MockCategoria> = {}): MockCategoria {
  const cat: MockCategoria = {
    id: overrides.id ?? state.seq.catIdSeq++,
    nombre: overrides.nombre ?? "Canchas",
    tipo: overrides.tipo ?? "CANCHA",
  };
  state.categorias.push(cat);
  return cat;
}

export function crearMockServicio(state: MockState, overrides: Partial<MockServicio> = {}): MockServicio {
  const serv: MockServicio = {
    id: overrides.id ?? state.seq.servIdSeq++,
    categoriaId: overrides.categoriaId ?? 1,
    nombre: overrides.nombre ?? "Cancha Sintética 1",
    capacidadMaxima: overrides.capacidadMaxima ?? 10,
    tarifa: overrides.tarifa ?? 50000,
    modalidad: overrides.modalidad ?? "EXCLUSIVA",
    tipoPiscina: overrides.tipoPiscina ?? null,
    estado: overrides.estado ?? "ACTIVO",
  };
  state.servicios.push(serv);
  return serv;
}

export function crearMockFranja(state: MockState, overrides: Partial<MockFranja> = {}): MockFranja {
  const franja: MockFranja = {
    id: overrides.id ?? state.seq.franjaIdSeq++,
    servicioId: overrides.servicioId ?? 1,
    diaSemana: overrides.diaSemana ?? 1,
    horaInicio: overrides.horaInicio ?? new Date("1970-01-01T08:00:00Z"),
    horaFin: overrides.horaFin ?? new Date("1970-01-01T09:00:00Z"),
  };
  state.franjas.push(franja);
  return franja;
}

export function crearServicioHandler(state: MockState) {
  return {
    categoriaServicio: {
      async findUnique({ where }: any) {
        if (where.id !== undefined) {
          return state.categorias.find((c) => c.id === where.id) || null;
        }
        if (where.nombre !== undefined) {
          return state.categorias.find((c) => c.nombre.toLowerCase() === where.nombre.toLowerCase()) || null;
        }
        return null;
      },
      async findMany({ include }: any = {}) {
        return state.categorias.map((cat) => ({
          ...cat,
          ...(include?._count
            ? {
                _count: {
                  servicios: state.servicios.filter((s) => s.categoriaId === cat.id).length,
                },
              }
            : {}),
        }));
      },
      async create({ data }: any) {
        const item: MockCategoria = {
          id: state.seq.catIdSeq++,
          nombre: data.nombre,
          tipo: data.tipo,
        };
        state.categorias.push(item);
        return item;
      },
      async update({ where, data }: any) {
        const cat = state.categorias.find((c) => c.id === where.id);
        if (!cat) throw new Error("Not found");
        if (data.nombre) cat.nombre = data.nombre;
        if (data.tipo) cat.tipo = data.tipo;
        return cat;
      },
      async delete({ where }: any) {
        const idx = state.categorias.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [deleted] = state.categorias.splice(idx, 1);
        return deleted;
      },
    },
    servicio: {
      async findUnique({ where, include }: any) {
        let serv: MockServicio | undefined;
        if (where.id !== undefined) {
          serv = state.servicios.find((s) => s.id === where.id);
        } else if (where.nombre !== undefined) {
          serv = state.servicios.find((s) => s.nombre.toLowerCase() === where.nombre.toLowerCase());
        }
        if (!serv) return null;

        const res: any = { ...serv };
        if (include?.categoria) {
          res.categoria = state.categorias.find((c) => c.id === serv!.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = state.franjas.filter((f) => f.servicioId === serv!.id);
        }
        if (include?.disponibilidades) {
          res.disponibilidades = state.disponibilidades.filter((d) => d.servicioId === serv!.id);
        }
        return res;
      },
      async findMany({ where, include }: any = {}) {
        let list = [...state.servicios];
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
            res.categoria = state.categorias.find((c) => c.id === serv.categoriaId);
          }
          if (include?.franjasHorarias) {
            res.franjasHorarias = state.franjas.filter((f) => f.servicioId === serv.id);
          }
          if (include?._count?.select?.disponibilidades) {
            res._count = {
              disponibilidades: state.disponibilidades.filter((d) => d.servicioId === serv.id).length,
            };
          }
          return res;
        });
      },
      async count({ where }: any = {}) {
        if (where?.categoriaId) {
          return state.servicios.filter((s) => s.categoriaId === where.categoriaId).length;
        }
        return state.servicios.length;
      },
      async create({ data, include }: any) {
        const item: MockServicio = {
          id: state.seq.servIdSeq++,
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          capacidadMaxima: data.capacidadMaxima,
          tarifa: data.tarifa,
          modalidad: data.modalidad,
          tipoPiscina: data.tipoPiscina ?? null,
          estado: data.estado ?? "ACTIVO",
        };
        state.servicios.push(item);

        const createdFranjas: MockFranja[] = [];
        if (data.franjasHorarias?.create) {
          for (const f of data.franjasHorarias.create) {
            const franjaItem: MockFranja = {
              id: state.seq.franjaIdSeq++,
              servicioId: item.id,
              diaSemana: f.diaSemana,
              horaInicio: f.horaInicio,
              horaFin: f.horaFin,
            };
            state.franjas.push(franjaItem);
            createdFranjas.push(franjaItem);
          }
        }

        const res: any = { ...item };
        if (include?.categoria) {
          res.categoria = state.categorias.find((c) => c.id === item.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = createdFranjas;
        }
        return res;
      },
      async update({ where, data, include }: any) {
        const serv = state.servicios.find((s) => s.id === where.id);
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
          res.categoria = state.categorias.find((c) => c.id === serv.categoriaId);
        }
        if (include?.franjasHorarias) {
          res.franjasHorarias = state.franjas.filter((f) => f.servicioId === serv.id);
        }
        return res;
      },
      async delete({ where }: any) {
        const idx = state.servicios.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [deleted] = state.servicios.splice(idx, 1);
        return deleted;
      },
    },
    franjaHoraria: {
      async findFirst({ where }: any) {
        if (!where) return state.franjas[0] ?? null;
        return state.franjas.find((f) => {
          if (where.servicioId !== undefined && f.servicioId !== where.servicioId) return false;
          return true;
        }) ?? null;
      },
      async create({ data }: any) {
        const item: MockFranja = {
          id: state.seq.franjaIdSeq++,
          servicioId: data.servicioId,
          diaSemana: data.diaSemana,
          horaInicio: data.horaInicio,
          horaFin: data.horaFin,
        };
        state.franjas.push(item);
        return item;
      },
      async deleteMany({ where }: any) {
        const initial = state.franjas.length;
        const remaining = state.franjas.filter((f) => {
          if (where?.servicioId !== undefined && f.servicioId === where.servicioId) return false;
          return true;
        });
        state.franjas.length = 0;
        state.franjas.push(...remaining);
        return { count: initial - remaining.length };
      },
      async createMany({ data }: any) {
        const items = Array.isArray(data) ? data : [data];
        for (const f of items) {
          state.franjas.push({
            id: state.seq.franjaIdSeq++,
            servicioId: f.servicioId,
            diaSemana: f.diaSemana,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
          });
        }
        return { count: items.length };
      },
    },
  };
}
