import { prisma } from "../client";
import type { Festivo } from "@prisma/client";

/**
 * Normaliza una fecha (Date o string YYYY-MM-DD) a Date UTC para compatibilidad con @db.Date de Prisma.
 */
function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  // Si viene "YYYY-MM-DD", aseguramos formato UTC
  const iso = input.includes("T") ? input : `${input}T00:00:00.000Z`;
  return new Date(iso);
}

/**
 * Obtiene todos los festivos registrados para un año específico.
 * @param {number} anio - Año de consulta (ej. 2026)
 * @returns {Promise<Festivo[]>} Lista de festivos ordenados por fecha ascendente
 */
export async function findFestivosByYear(anio: number): Promise<Festivo[]> {
  return prisma.festivo.findMany({
    where: { anio },
    orderBy: { fecha: "asc" },
  });
}

/**
 * Busca si una fecha específica está registrada como festivo en la base de datos.
 * @param {Date | string} fecha - Fecha a consultar
 * @returns {Promise<Festivo | null>} Festivo encontrado o null si no existe
 */
export async function findFestivoByDate(fecha: Date | string): Promise<Festivo | null> {
  const dateObj = toDate(fecha);
  return prisma.festivo.findUnique({
    where: { fecha: dateObj },
  });
}

/**
 * Inserta o actualiza un festivo en la tabla `festivo`.
 * Si la fecha ya existe, actualiza el nombre y el año (PT-01 / TSK-AU-02).
 * @param {Object} data - Datos del festivo
 * @returns {Promise<Festivo>} Registro insertado o actualizado
 */
export async function upsertFestivo(data: {
  fecha: Date | string;
  nombre: string;
  anio?: number;
}): Promise<Festivo> {
  const dateObj = toDate(data.fecha);
  const anio = data.anio ?? dateObj.getUTCFullYear();

  return prisma.festivo.upsert({
    where: { fecha: dateObj },
    create: {
      fecha: dateObj,
      nombre: data.nombre,
      anio,
    },
    update: {
      nombre: data.nombre,
      anio,
    },
  });
}

/**
 * Inserta o actualiza un lote de festivos en la base de datos.
 * @param {Array<{ fecha: Date | string; nombre: string; anio?: number }>} festivos - Lote de festivos
 * @returns {Promise<void>}
 */
export async function upsertManyFestivos(
  festivos: Array<{ fecha: Date | string; nombre: string; anio?: number }>,
): Promise<void> {
  for (const item of festivos) {
    await upsertFestivo(item);
  }
}

/**
 * Retorna todos los festivos almacenados en la tabla `festivo`.
 * @returns {Promise<Festivo[]>}
 */
export async function getAllFestivos(): Promise<Festivo[]> {
  return prisma.festivo.findMany({
    orderBy: { fecha: "asc" },
  });
}
