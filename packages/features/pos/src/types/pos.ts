import type {
  createPosPaymentIntent,
  createStripeCheckoutSession,
} from "@sportcomplex/core";

export interface PosCheckoutBooking {
  id: string;
  code: string;
  client: string;
  document: string;
  email: string;
  service: string;
  date: string;
  time: string;
  attendees: number;
  amount: number;
  subtotal: number;
  iva: number;
  discount: number;
  status: string;
  canal: string;
  vendedorId: string;
  paymentMode: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  alternativePaymentUrl?: string;
}

export interface PosCheckoutPaymentIntentData {
  id: string;
  clientSecret: string | null;
  client_secret: string | null;
  amount: number;
  currency: string;
  status: string;
}

export interface PosCheckoutResult {
  success: true;
  booking: PosCheckoutBooking;
  paymentIntent?: PosCheckoutPaymentIntentData;
  stripeCheckoutSessionId?: string;
  alternativePaymentUrl?: string;
  receiptUrl?: string;
}

export type TxResult =
  | { ok: false; response: Response }
  | {
      ok: true;
      servicio: { id: number; nombre: string; tarifa: unknown; capacidadMaxima: number | null };
      reserva: { id: string; total: unknown; subtotal: unknown };
      subtotal: number;
      iva: number;
      totalFinal: number;
      descuentoMonto: number;
    };

export type PosAuthorizationResult =
  | { authorized: true; actor: { id: string; role?: string } }
  | { authorized: false; response: Response };

export type PosAuthorizeFn = (
  allowedRoles: readonly any[],
  dependencies?: any,
) => Promise<PosAuthorizationResult>;

export interface PosDisponibilidadRecord {
  id: bigint | number | string;
  servicioId: number;
  franjaId?: number;
  fecha: Date;
  cuposTotales: number | null;
  cuposOcupados: number | null;
  bloqueadaMantenimiento: boolean | null;
  franja?: {
    horaInicio: Date;
    horaFin: Date;
  } | null;
}

export interface PosTransactionClient {
  servicio: {
    findUnique(args: {
      where: { id: number };
      include?: { categoria?: boolean };
    }): Promise<{
      id: number;
      nombre: string;
      tarifa: unknown;
      capacidadMaxima: number | null;
      estado: string;
      modalidad?: string | null;
      [key: string]: unknown;
    } | null>;
  };
  disponibilidad: {
    findUnique(args: {
      where: { id: bigint | number | string };
      include?: { franja?: boolean };
    }): Promise<PosDisponibilidadRecord | null>;
    findMany(args: {
      where: {
        servicioId: number;
        fecha: Date;
      };
      include?: { franja?: boolean };
    }): Promise<PosDisponibilidadRecord[]>;
    create(args: {
      data: {
        servicioId: number;
        franjaId: number;
        fecha: Date;
        cuposTotales: number;
        cuposOcupados: number;
        bloqueadaMantenimiento: boolean;
      };
      include?: { franja?: boolean };
    }): Promise<PosDisponibilidadRecord>;
    update(args: {
      where: { id: bigint | number | string };
      data: { cuposOcupados: { increment: number } };
    }): Promise<unknown>;
  };
  franjaHoraria: {
    findFirst(args: {
      where: { servicioId: number; diaSemana: number };
    }): Promise<{ id: number; [key: string]: unknown } | null>;
    create(args: {
      data: {
        servicioId: number;
        diaSemana: number;
        horaInicio: Date;
        horaFin: Date;
      };
    }): Promise<{ id: number; [key: string]: unknown }>;
  };
  reserva: {
    create(args: {
      data: {
        disponibilidadId: bigint | number | string;
        titularId: string;
        vendedorId: string;
        cantidadCupos: number;
        canal: string;
        estado: string;
        subtotal: number;
        descuentoPct: number;
        total: number;
        expiraEn: Date;
        membresiaId: number | string | null;
      };
    }): Promise<{
      id: string;
      total: unknown;
      subtotal: unknown;
      [key: string]: unknown;
    }>;
  };
}

export interface PosDatabaseClient {
  usuario: {
    findFirst(args: {
      where: { correo: string };
    }): Promise<{ id: string; [key: string]: unknown } | null>;
    findUnique(args: {
      where: { id: string } | { correo: string };
      select?: {
        id?: boolean;
        estado?: boolean;
        deletedAt?: boolean;
        rol?: { select?: { nombre?: boolean } };
      };
    }): Promise<{
      id: string;
      estado: string;
      deletedAt: Date | null;
      rol: { nombre: string } | null;
      [key: string]: unknown;
    } | null>;
    create(args: {
      data: {
        correo: string;
        nombre: string;
        passwordHash: string;
        estado: string;
        rolId: number;
      };
    }): Promise<{ id: string; [key: string]: unknown }>;
  };
  rol: {
    findFirst(args: {
      where: { nombre: { in: string[] } };
    }): Promise<{ id: number; [key: string]: unknown } | null>;
  };
  membresia: {
    findFirst(args: {
      where: {
        usuarioId: string;
        estado: string;
      };
    }): Promise<{ id: number | string; [key: string]: unknown } | null>;
  };
  $transaction<T>(fn: (tx: PosTransactionClient) => Promise<T>): Promise<T>;
}

export interface PosCheckoutHandlerDependencies {
  authorize?: PosAuthorizeFn;
  createPaymentIntent?: typeof createPosPaymentIntent;
  createCheckoutSession?: typeof createStripeCheckoutSession;
  db?: PosDatabaseClient | unknown;
  ok?: (data: unknown, status?: number) => Response;
  fail?: (code: string, message: string, status?: number, details?: unknown) => Response;
}
