export interface VerificationState {
  confirmed: boolean;
  bookingCode: string | null;
}

export interface PollingOptions {
  reservationId: string | null;
  userName: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  fetchReceipt: (id: string) => Promise<{
    reserva?: { id: string; estado?: string };
    ticket?: { id?: string; estado?: string } | null;
    qr?: { payload: string } | null;
  } | null>;
  fetchHistory: (userName: string, limit: number) => Promise<Array<{
    id: string;
    status: string;
    code: string;
    ticketIssued?: boolean;
  }>>;
}

/**
 * Sondea la confirmación del backend tras el pago en pasarela.
 * Si el servidor confirma la reserva, retorna confirmed = true y el código oficial emitido.
 * Si vence el sondeo sin confirmación, retorna confirmed = false y NO inventa ningún código.
 */
export async function pollPaymentConfirmation({
  reservationId,
  userName,
  maxAttempts = 12,
  pollIntervalMs = 1500,
  fetchReceipt,
  fetchHistory,
}: PollingOptions): Promise<VerificationState> {
  if (!reservationId) {
    return { confirmed: false, bookingCode: null };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await fetchReceipt(reservationId);
      if (
        receipt?.reserva?.id === reservationId &&
        receipt.reserva.estado === "CONFIRMADA" &&
        receipt.ticket &&
        receipt.qr?.payload
      ) {
        return {
          confirmed: true,
          bookingCode: receipt.qr.payload.slice(0, 16),
        };
      }
    } catch {
      // continuar sondeo
    }

    try {
      const history = await fetchHistory(userName, 5);
      const match = history.find(
        (h) => h.id === reservationId && h.status === "Confirmada" && h.ticketIssued,
      );
      if (match) {
        return {
          confirmed: true,
          bookingCode: match.code,
        };
      }
    } catch {
      // continuar sondeo
    }

    if (attempt < maxAttempts - 1 && pollIntervalMs > 0) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  return { confirmed: false, bookingCode: null };
}

export interface ResolvePaymentResultInput {
  verification: VerificationState;
  onConfirmed: (officialCode: string) => void;
  onPending: () => void;
}

/**
 * Resuelve el flujo posterior al pago según el resultado de verificación del backend.
 * Nunca genera reservas locales ni comprobantes apócrifos cuando el estado es pendiente.
 */
export function resolvePaymentOutcome({
  verification,
  onConfirmed,
  onPending,
}: ResolvePaymentResultInput): void {
  if (verification.confirmed && verification.bookingCode) {
    onConfirmed(verification.bookingCode);
  } else {
    onPending();
  }
}
