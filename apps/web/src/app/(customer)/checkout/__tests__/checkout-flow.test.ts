import test from "node:test";
import assert from "node:assert/strict";
import {
  pollPaymentConfirmation,
  resolvePaymentOutcome,
  type VerificationState,
} from "@sportcomplex/features-booking";

test("pollPaymentConfirmation: retorna confirmed=false y bookingCode=null si reservationId es nulo", async () => {
  const result = await pollPaymentConfirmation({
    reservationId: null,
    userName: "Cliente Test",
    fetchReceipt: async () => null,
    fetchHistory: async () => [],
  });

  assert.equal(result.confirmed, false);
  assert.equal(result.bookingCode, null);
});

test("pollPaymentConfirmation: detecta confirmación mediante fetchReceipt y retorna código oficial", async () => {
  const result = await pollPaymentConfirmation({
    reservationId: "res-123",
    userName: "Cliente Test",
    maxAttempts: 2,
    pollIntervalMs: 0,
    fetchReceipt: async (id: string) => ({
      reserva: { id, estado: "CONFIRMADA" },
      ticket: { id: "ticket-123", estado: "EMITIDO" },
      qr: { payload: "SC1:res-123-uuid:signature123456" },
    }),
    fetchHistory: async () => [],
  });

  assert.equal(result.confirmed, true);
  assert.equal(result.bookingCode, "SC1:res-123-uuid");
});

test("pollPaymentConfirmation: sigue sondeando si el comprobante aún no tiene reserva confirmada ni tiquete", async () => {
  let receiptAttempts = 0;
  const result = await pollPaymentConfirmation({
    reservationId: "res-789",
    userName: "Cliente Test",
    maxAttempts: 3,
    pollIntervalMs: 0,
    fetchReceipt: async (id: string) => {
      receiptAttempts++;
      if (receiptAttempts < 3) {
        return { reserva: { id, estado: "PENDIENTE_PAGO" }, ticket: null, qr: null };
      }
      return {
        reserva: { id, estado: "CONFIRMADA" },
        ticket: { id: "ticket-789", estado: "EMITIDO" },
        qr: { payload: "SC1:ticket-789:signature" },
      };
    },
    fetchHistory: async () => [],
  });

  assert.equal(receiptAttempts, 3);
  assert.equal(result.confirmed, true);
  assert.equal(result.bookingCode, "SC1:ticket-789:s");
});

test("pollPaymentConfirmation: no confirma una reserva confirmada sin tiquete/QR emitido", async () => {
  const result = await pollPaymentConfirmation({
    reservationId: "res-no-ticket",
    userName: "Cliente Test",
    maxAttempts: 2,
    pollIntervalMs: 0,
    fetchReceipt: async (id: string) => ({
      reserva: { id, estado: "CONFIRMADA" },
      ticket: null,
      qr: null,
    }),
    fetchHistory: async () => [],
  });

  assert.equal(result.confirmed, false);
  assert.equal(result.bookingCode, null);
});

test("pollPaymentConfirmation: detecta confirmación mediante fetchHistory si receipt aún no está listo", async () => {
  const result = await pollPaymentConfirmation({
    reservationId: "res-456",
    userName: "Cliente Test",
    maxAttempts: 2,
    pollIntervalMs: 0,
    fetchReceipt: async () => null,
    fetchHistory: async () => [
      { id: "res-456", status: "Confirmada", code: "OFICIAL-789", ticketIssued: true },
    ],
  });

  assert.equal(result.confirmed, true);
  assert.equal(result.bookingCode, "OFICIAL-789");
});

test("pollPaymentConfirmation: no acepta un código alternativo del historial sin tiquete emitido", async () => {
  let historyAttempts = 0;
  const result = await pollPaymentConfirmation({
    reservationId: "res-history-ticket",
    userName: "Cliente Test",
    maxAttempts: 2,
    pollIntervalMs: 0,
    fetchReceipt: async () => null,
    fetchHistory: async () => {
      historyAttempts++;
      return [
        {
          id: "res-history-ticket",
          status: "Confirmada",
          code: "ALT-RES-HISTORY",
          ticketIssued: historyAttempts === 2,
        },
      ];
    },
  });

  assert.equal(historyAttempts, 2);
  assert.equal(result.confirmed, true);
  assert.equal(result.bookingCode, "ALT-RES-HISTORY");
});

test("pollPaymentConfirmation: cuando vence el sondeo sin confirmación, NO inventa ningún código ni comprobante", async () => {
  let attemptsCount = 0;
  const result = await pollPaymentConfirmation({
    reservationId: "res-unconfirmed",
    userName: "Cliente Test",
    maxAttempts: 3,
    pollIntervalMs: 1,
    fetchReceipt: async () => {
      attemptsCount++;
      return null;
    },
    fetchHistory: async () => [
      { id: "res-unconfirmed", status: "Pendiente", code: "PEND-001" },
    ],
  });

  assert.equal(attemptsCount, 3);
  assert.equal(result.confirmed, false);
  assert.equal(result.bookingCode, null);
});

test("resolvePaymentOutcome: llama onConfirmed únicamente cuando el backend confirmó y hay código oficial", () => {
  let confirmedCalled = false;
  let receivedCode: string | null = null;
  let pendingCalled = false;

  const verification: VerificationState = {
    confirmed: true,
    bookingCode: "QR-OFICIAL-001",
  };

  resolvePaymentOutcome({
    verification,
    onConfirmed: (code) => {
      confirmedCalled = true;
      receivedCode = code;
    },
    onPending: () => {
      pendingCalled = true;
    },
  });

  assert.equal(confirmedCalled, true);
  assert.equal(receivedCode, "QR-OFICIAL-001");
  assert.equal(pendingCalled, false);
});

test("resolvePaymentOutcome: llama onPending y NO onConfirmed si el sondeo venció sin confirmación del backend", () => {
  let confirmedCalled = false;
  let pendingCalled = false;

  const verification: VerificationState = {
    confirmed: false,
    bookingCode: null,
  };

  resolvePaymentOutcome({
    verification,
    onConfirmed: () => {
      confirmedCalled = true;
    },
    onPending: () => {
      pendingCalled = true;
    },
  });

  assert.equal(confirmedCalled, false);
  assert.equal(pendingCalled, true);
});
