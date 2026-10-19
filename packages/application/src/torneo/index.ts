import type {
  EstadoInscripcionTorneo,
  EstadoTorneo,
} from "@sportcomplex/domain/torneo";

export class TorneoInvarianteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "TorneoInvarianteError";
  }
}

export interface ValidarInscripcionTorneoInput {
  torneo: {
    id: string;
    estado: EstadoTorneo | string;
    cuposTotales: number;
    cuposOcupados: number;
  };
  inscripcionExistente?: {
    id: string;
    estado: EstadoInscripcionTorneo | string;
  } | null | undefined;
  pagoId?: string | null | undefined;
  confirmado?: boolean | undefined;
}

/**
 * Valida de forma pura los invariantes para la inscripción a un torneo (TSK-BD-12 / HIGH-03).
 */
export function validarInscripcion(input: ValidarInscripcionTorneoInput): {
  valido: boolean;
  accion: "CREAR" | "CONFIRMAR_EXISTENTE" | "RETORNAR_EXISTENTE";
} {
  const { torneo, inscripcionExistente, confirmado } = input;

  if (torneo.estado !== "INSCRIPCIONES_ABIERTAS") {
    throw new TorneoInvarianteError(
      `Las inscripciones no están abiertas para este torneo (estado: ${torneo.estado}).`,
      "REGISTRATION_CLOSED",
      400,
    );
  }

  if (inscripcionExistente) {
    if (inscripcionExistente.estado === "CONFIRMADA") {
      throw new TorneoInvarianteError(
        "El usuario ya se encuentra inscrito en este torneo.",
        "ALREADY_REGISTERED",
        409,
      );
    }
    if (inscripcionExistente.estado === "PENDIENTE_PAGO" && !confirmado) {
      return { valido: true, accion: "RETORNAR_EXISTENTE" };
    }
    if (inscripcionExistente.estado === "PENDIENTE_PAGO" && confirmado) {
      return { valido: true, accion: "CONFIRMAR_EXISTENTE" };
    }
  }

  if (torneo.cuposOcupados >= torneo.cuposTotales) {
    throw new TorneoInvarianteError(
      "No hay cupos disponibles para este torneo.",
      "CAPACITY_EXCEEDED",
      409,
    );
  }

  return { valido: true, accion: "CREAR" };
}

/**
 * Lógica pura para inscribir un participante calculando el nuevo estado y conteo de cupos.
 */
export function inscribir(
  torneo: {
    id: string;
    estado: EstadoTorneo | string;
    cuposTotales: number;
    cuposOcupados: number;
  },
  _usuarioId: string,
  opciones: {
    nombrePareja?: string | null;
    inscripcionExistente?: { id: string; estado: EstadoInscripcionTorneo | string } | null | undefined;
    pagoId?: string | null | undefined;
    confirmado?: boolean | undefined;
    now?: Date;
  } = {},
): {
  nuevoCuposOcupados: number;
  estadoInscripcion: EstadoInscripcionTorneo;
  cuposDisponibles: number;
} {
  const validacion = validarInscripcion({
    torneo,
    inscripcionExistente: opciones.inscripcionExistente,
    pagoId: opciones.pagoId,
    confirmado: opciones.confirmado,
  });

  const nuevoEstado: EstadoInscripcionTorneo = opciones.confirmado
    ? "CONFIRMADA"
    : "PENDIENTE_PAGO";

  let nuevoCuposOcupados = torneo.cuposOcupados;
  if (validacion.accion === "CREAR" || (validacion.accion === "CONFIRMAR_EXISTENTE" && opciones.confirmado)) {
    // Si crea confirmado o pasa a confirmado suma 1 cupo
    nuevoCuposOcupados = Math.min(torneo.cuposTotales, torneo.cuposOcupados + 1);
  }

  return {
    nuevoCuposOcupados,
    estadoInscripcion: nuevoEstado,
    cuposDisponibles: Math.max(0, torneo.cuposTotales - nuevoCuposOcupados),
  };
}
