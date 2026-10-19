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

export interface ResolvePaymentResultInput {
  verification: VerificationState;
  onConfirmed: (officialCode: string) => void;
  onPending: () => void;
}
