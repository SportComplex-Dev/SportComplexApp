// Mock en memoria de PrismaClient para pruebas unitarias de repositorios

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
}

export function createMockPrisma() {
  const categorias: MockCategoria[] = [];
  const servicios: MockServicio[] = [];
  const franjas: MockFranja[] = [];
  const disponibilidades: MockDisponibilidad[] = [];
  const reservas: MockReserva[] = [];

  let catIdSeq = 1;
  let servIdSeq = 1;
  let franjaIdSeq = 1;
  let dispIdSeq = 1n;

  return {
    _state: {
      categorias,
      servicios,
      franjas,
      disponibilidades,
      reservas,
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
      async upsert({ where, create }: any) {
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
        }
        return existing;
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
  };
}
