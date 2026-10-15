import type { ItemSemillaCatalogo } from "../catalogo/datos.js";

export interface RegistroServicioDb {
  id: number;
  nombre: string;
  categoriaId: number;
  capacidadMaxima: number;
  tarifa: number;
  modalidad: 'EXCLUSIVA' | 'AFORO';
  tipoPiscina: 'PUBLICA' | 'PRIVADA' | null;
  estado: 'ACTIVO' | 'INHABILITADO';
}

export function traducirSemillaARegistroDb(item: ItemSemillaCatalogo, categoriaId: number): RegistroServicioDb {
  const isPiscina = item.category === 'piscinas';
  const tipoPiscina = isPiscina
    ? item.slug === 'piscina-carril-entrenamiento'
      ? 'PRIVADA'
      : 'PUBLICA'
    : null;

  const modalidad = item.isShared ? 'AFORO' : 'EXCLUSIVA';

  return {
    id: item.idBd,
    nombre: item.name,
    categoriaId,
    capacidadMaxima: item.capacity,
    tarifa: item.price,
    modalidad,
    tipoPiscina,
    estado: 'ACTIVO',
  };
}
