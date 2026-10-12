import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTicketQr,
  ScannerServiceError,
  validateTicket,
} from "../scanner.service";
import { ACCESS_WINDOW_EXPIRED_MESSAGE } from "@sportcomplex/core";

test("parseTicketQr separa el identificador y la firma", () => {
  assert.deepEqual(parseTicketQr("ticket-uuid.hmac-signature"), {
    ticketId: "ticket-uuid",
    signature: "hmac-signature",
  });
});

test("parseTicketQr rechaza un QR sin firma", () => {
  assert.throws(() => parseTicketQr("ticket-uuid"), ScannerServiceError);
});

test("validateTicket normaliza WINDOW_EXPIRED al contrato de la pantalla", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          access: "DENIED",
          code: "WINDOW_EXPIRED",
          resultado: "DENEGADO_HORARIO",
          ticket: {
            reservaId: "reserva-1",
            estado: "EMITIDO",
            servicioNombre: "Cancha 1",
            fecha: "2026-10-10",
            horaInicio: "10:00:00",
            horaFin: "11:00:00",
            titularNombre: "Cliente Uno",
          },
          message: ACCESS_WINDOW_EXPIRED_MESSAGE,
        },
        timestamp: "2026-10-10T16:28:00.000Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await validateTicket("ticket-uuid", "signature", 3);
    assert.equal(result.status, "EXPIRED");
    assert.equal(result.isValid, false);
    assert.equal(result.userName, "Cliente Uno");
    assert.equal(result.reservationId, "reserva-1");
    assert.equal(result.targetCourtName, "Cancha 1");
    assert.equal(result.message, ACCESS_WINDOW_EXPIRED_MESSAGE);
    assert.deepEqual(result.expiredDetails, {
      slotStart: "10:00",
      slotEnd: "11:00",
      scannedAt: "2026-10-10T16:28:00.000Z",
      windowPosition: "AFTER",
      ticketStatus: "EMITIDO",
      minutesFromBoundary: 28,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
