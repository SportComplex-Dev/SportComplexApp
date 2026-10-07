import { prisma } from "../client";
import type {
  CategoriaServicio,
  TipoCategoriaServicio,
  ModalidadServicio,
  TipoPiscina,
  EstadoServicio,
} from "@prisma/client";

export interface CreateCategoriaData {
  nombre: string;
  tipo: TipoCategoriaServicio;
}

export interface UpdateCategoriaData {
  nombre?: string;
  tipo?: TipoCategoriaServicio;
}

export interface FranjaInput {
  diaSemana: number;
  horaInicio: string; // Formato "HH:mm" o "HH:mm:ss"
  horaFin: string;    // Formato "HH:mm" o "HH:mm:ss"
}

export interface CreateServicioData {
  nombre: string;
  categoriaId: number;
  capacidadMaxima: number;
  tarifa: number | string;
  modalidad: ModalidadServicio;
  tipoPiscina?: TipoPiscina | null;
  estado?: EstadoServicio;
  franjasHorarias?: FranjaInput[];
}

export interface UpdateServicioData {
  nombre?: string;
  categoriaId?: number;
  capacidadMaxima?: number;
  tarifa?: number | string;
  modalidad?: ModalidadServicio;
  tipoPiscina?: TipoPiscina | null;
  estado?: EstadoServicio;
  franjasHorarias?: FranjaInput[];
}

export interface ServiceFilterOptions {
  categoriaId?: number;
  estado?: EstadoServicio;
  search?: string;
}

/**
 * Convierte una cadena de hora "HH:mm" a un objeto Date (base 1970-01-01 UTC)
 * compatible con el tipo @db.Time de PostgreSQL.
 */
export function parseTimeToDate(timeStr: string): Date {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
}

/**
 * Convierte un objeto Date devuelto por Prisma para un campo @db.Time a cadena "HH:mm".
 */
export function formatTimeToString(date: Date): string {
  try {
    const iso = date.toISOString();
    const timePart = iso.split("T")[1]?.slice(0, 5);
    if (timePart) return timePart;
  } catch {
    // fallback
  }
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

// ==========================================
// OPERACIONES SOBRE CATEGORIA_SERVICIO
// ==========================================

export async function createCategoria(data: CreateCategoriaData): Promise<CategoriaServicio> {
  const trimmed = data.nombre.trim();
  const existing = await prisma.categoriaServicio.findUnique({
    where: { nombre: trimmed },
  });

  if (existing) {
    const error = new Error(`Ya existe una categoría con el nombre "${trimmed}"`);
    error.name = "DuplicateError";
    throw error;
  }

  return prisma.categoriaServicio.create({
    data: {
      nombre: trimmed,
      tipo: data.tipo,
    },
  });
}

export async function getCategorias() {
  return prisma.categoriaServicio.findMany({
    include: {
      _count: {
        select: { servicios: true },
      },
    },
    orderBy: { id: "asc" },
  });
}

export async function getCategoriaById(id: number) {
  return prisma.categoriaServicio.findUnique({
    where: { id },
    include: {
      servicios: true,
    },
  });
}

export async function getCategoriaByNombre(nombre: string) {
  return prisma.categoriaServicio.findUnique({
    where: { nombre: nombre.trim() },
    include: {
      servicios: true,
    },
  });
}

export async function updateCategoria(id: number, data: UpdateCategoriaData) {
  const current = await prisma.categoriaServicio.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Categoría no encontrada");
    error.name = "NotFoundError";
    throw error;
  }

  if (data.nombre) {
    const trimmed = data.nombre.trim();
    const existing = await prisma.categoriaServicio.findUnique({
      where: { nombre: trimmed },
    });
    if (existing && existing.id !== id) {
      const error = new Error(`Ya existe otra categoría con el nombre "${trimmed}"`);
      error.name = "DuplicateError";
      throw error;
    }
  }

  return prisma.categoriaServicio.update({
    where: { id },
    data: {
      ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
      ...(data.tipo ? { tipo: data.tipo } : {}),
    },
  });
}

export async function deleteCategoria(id: number) {
  const current = await prisma.categoriaServicio.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Categoría no encontrada");
    error.name = "NotFoundError";
    throw error;
  }

  const count = await prisma.servicio.count({
    where: { categoriaId: id },
  });

  if (count > 0) {
    const error = new Error(
      `No se puede eliminar la categoría porque tiene ${count} servicio(s) asociado(s).`,
    );
    error.name = "ForeignKeyConflictError";
    throw error;
  }

  return prisma.categoriaServicio.delete({
    where: { id },
  });
}

// ==========================================
// OPERACIONES SOBRE SERVICIO (INSTANCIAS INDEPENDIENTES)
// ==========================================

export async function generateDisponibilidadesForServicio(
  servicioId: number,
  windowDays = 15,
) {
  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
    include: { franjasHorarias: true },
  });

  if (!servicio || servicio.franjasHorarias.length === 0) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cuposTotales =
    servicio.modalidad === "EXCLUSIVA" ? 1 : servicio.capacidadMaxima;

  for (let offset = 0; offset <= windowDays; offset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);

    // ISO: 1 (Lunes) a 7 (Domingo)
    const diaSemana = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

    const franjasDelDia = servicio.franjasHorarias.filter(
      (f) => f.diaSemana === diaSemana,
    );

    for (const franja of franjasDelDia) {
      await prisma.disponibilidad.upsert({
        where: {
          servicioId_franjaId_fecha: {
            servicioId: servicio.id,
            franjaId: franja.id,
            fecha: targetDate,
          },
        },
        update: {},
        create: {
          servicioId: servicio.id,
          franjaId: franja.id,
          fecha: targetDate,
          cuposTotales,
          cuposOcupados: 0,
          bloqueadaMantenimiento: false,
        },
      });
    }
  }
}

/**
 * Da de alta un nuevo servicio verificando la unicidad de su nombre en el complejo deportivo
 * y aprovisionando su calendario autónomo.
 */
export async function createServicio(data: CreateServicioData) {
  const trimmedName = data.nombre.trim();

  // Validación de unicidad de nombre de instancia por complejo (RF-03, TSK-BE-04)
  const existing = await prisma.servicio.findUnique({
    where: { nombre: trimmedName },
  });

  if (existing) {
    const error = new Error(
      `Ya existe un servicio con el nombre "${trimmedName}" en el complejo.`,
    );
    error.name = "DuplicateNameError";
    throw error;
  }

  // Verificar que la categoría exista
  const categoria = await prisma.categoriaServicio.findUnique({
    where: { id: data.categoriaId },
  });

  if (!categoria) {
    const error = new Error(
      `La categoría con id ${data.categoriaId} no existe.`,
    );
    error.name = "NotFoundError";
    throw error;
  }

  const franjas = data.franjasHorarias ?? [];

  const nuevoServicio = await prisma.servicio.create({
    data: {
      nombre: trimmedName,
      categoriaId: data.categoriaId,
      capacidadMaxima: data.capacidadMaxima,
      tarifa: data.tarifa,
      modalidad: data.modalidad,
      tipoPiscina: data.tipoPiscina ?? null,
      estado: data.estado ?? "ACTIVO",
      franjasHorarias:
        franjas.length > 0
          ? {
              create: franjas.map((f) => ({
                diaSemana: f.diaSemana,
                horaInicio: parseTimeToDate(f.horaInicio),
                horaFin: parseTimeToDate(f.horaFin),
              })),
            }
          : undefined,
    },
    include: {
      categoria: true,
      franjasHorarias: true,
    },
  });

  // Generar disponibilidad inicial para su calendario propio
  if (franjas.length > 0) {
    await generateDisponibilidadesForServicio(nuevoServicio.id);
  }

  return nuevoServicio;
}

export async function getServicios(options?: ServiceFilterOptions) {
  return prisma.servicio.findMany({
    where: {
      ...(options?.categoriaId ? { categoriaId: options.categoriaId } : {}),
      ...(options?.estado ? { estado: options.estado } : {}),
      ...(options?.search
        ? { nombre: { contains: options.search, mode: "insensitive" } }
        : {}),
    },
    include: {
      categoria: true,
      franjasHorarias: true,
      _count: {
        select: {
          disponibilidades: true,
        },
      },
    },
    orderBy: [{ categoriaId: "asc" }, { nombre: "asc" }],
  });
}

export async function getServicioById(id: number) {
  return prisma.servicio.findUnique({
    where: { id },
    include: {
      categoria: true,
      franjasHorarias: true,
      disponibilidades: {
        take: 30,
        orderBy: { fecha: "asc" },
      },
    },
  });
}

export async function getServicioByNombre(nombre: string) {
  return prisma.servicio.findUnique({
    where: { nombre: nombre.trim() },
    include: {
      categoria: true,
      franjasHorarias: true,
    },
  });
}

export async function updateServicio(id: number, data: UpdateServicioData) {
  const current = await prisma.servicio.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Servicio no encontrado");
    error.name = "NotFoundError";
    throw error;
  }

  if (data.nombre) {
    const trimmedName = data.nombre.trim();
    const existing = await prisma.servicio.findUnique({
      where: { nombre: trimmedName },
    });
    if (existing && existing.id !== id) {
      const error = new Error(
        `Ya existe otro servicio con el nombre "${trimmedName}" en el complejo.`,
      );
      error.name = "DuplicateNameError";
      throw error;
    }
  }

  if (data.categoriaId) {
    const categoria = await prisma.categoriaServicio.findUnique({
      where: { id: data.categoriaId },
    });
    if (!categoria) {
      const error = new Error("La categoría indicada no existe");
      error.name = "NotFoundError";
      throw error;
    }
  }

  // Si se modifican las franjas horarias, actualizarlas
  if (data.franjasHorarias !== undefined) {
    await prisma.disponibilidad.deleteMany({
      where: {
        servicioId: id,
        reservas: { none: {} }, // Proteger disponibilidades con reservas asociadas
      },
    });
    await prisma.franjaHoraria.deleteMany({ where: { servicioId: id } });

    if (data.franjasHorarias.length > 0) {
      await prisma.franjaHoraria.createMany({
        data: data.franjasHorarias.map((f) => ({
          servicioId: id,
          diaSemana: f.diaSemana,
          horaInicio: parseTimeToDate(f.horaInicio),
          horaFin: parseTimeToDate(f.horaFin),
        })),
      });
      await generateDisponibilidadesForServicio(id);
    }
  }

  return prisma.servicio.update({
    where: { id },
    data: {
      ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
      ...(data.categoriaId ? { categoriaId: data.categoriaId } : {}),
      ...(data.capacidadMaxima ? { capacidadMaxima: data.capacidadMaxima } : {}),
      ...(data.tarifa !== undefined ? { tarifa: data.tarifa } : {}),
      ...(data.modalidad ? { modalidad: data.modalidad } : {}),
      ...(data.tipoPiscina !== undefined ? { tipoPiscina: data.tipoPiscina } : {}),
      ...(data.estado ? { estado: data.estado } : {}),
    },
    include: {
      categoria: true,
      franjasHorarias: true,
    },
  });
}

/**
 * Elimina un servicio verificando que no existan reservas activas.
 * Si existen reservas activas o se solicita inactivación, pasa a estado INHABILITADO.
 */
export async function deleteServicio(id: number, forceInactivate = false) {
  const current = await prisma.servicio.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Servicio no encontrado");
    error.name = "NotFoundError";
    throw error;
  }

  // Verificar reservas existentes asociadas al servicio
  const activeReservasCount = await prisma.reserva.count({
    where: {
      disponibilidad: { servicioId: id },
      estado: { in: ["CONFIRMADA", "PENDIENTE_PAGO"] },
    },
  });

  if (activeReservasCount > 0) {
    if (forceInactivate) {
      return prisma.servicio.update({
        where: { id },
        data: { estado: "INHABILITADO" },
      });
    }
    const error = new Error(
      `El servicio tiene ${activeReservasCount} reserva(s) activa(s). No se puede eliminar para no romper reservas existentes; inactívelo en su lugar.`,
    );
    error.name = "ServiceHasReservationsError";
    throw error;
  }

  // Sin reservas activas: limpiar disponibilidades sin reservas y franjas
  await prisma.disponibilidad.deleteMany({
    where: { servicioId: id },
  });
  await prisma.franjaHoraria.deleteMany({
    where: { servicioId: id },
  });

  return prisma.servicio.delete({
    where: { id },
  });
}
