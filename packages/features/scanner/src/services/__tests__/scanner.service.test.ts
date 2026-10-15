import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTicketQr,
  ScannerServiceError,
  scannerService,
  validateTicket,
} from "../scannerService";
import { ACCESS_WINDOW_EXPIRED_MESSAGE } from "@sportcomplex/core";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const signature = "a".repeat(64);

test("parseTicketQr separa el identificador y la firma", () => {
  assert.deepEqual(parseTicketQr("ticket-uuid.hmac-signature"), {
    ticketId: "ticket-uuid",
    signature: "hmac-signature",
  });
});

test("parseTicketQr acepta el payload QR canónico", () => {
  assert.deepEqual(parseTicketQr(`SC1:${ticketId}:${signature}`), {
    ticketId,
    signature,
  });
});

test("parseTicketQr rechaza un QR sin firma", () => {
  assert.throws(
    () => parseTicketQr("ticket-uuid"),
    (error: unknown) =>
      error instanceof ScannerServiceError &&
      error.message === "El código QR no contiene un ticket y una firma válidos.",
  );
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

function withFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
) {
  return async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = handler;
    try {
      await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("parsea payloads QR firmados y rechaza formatos inválidos", () => {
  assert.deepEqual(
    scannerService.parseTicket(`SC1:${ticketId}:${signature}`),
    { ticketId, signature },
  );

  for (const qr of [
    "",
    `SC2:${ticketId}:${signature}`,
    `SC1:${ticketId}:firma-corta`,
    `SC1:not-a-uuid:${signature}`,
    `SC1:${ticketId}:${signature}:extra`,
  ]) {
    assert.equal(scannerService.parseTicket(qr), null);
  }
});

test("consume y transforma los servicios de acceso disponibles", withFetch(
  async (input) => {
    assert.equal(String(input), "/api/access/services");
    return jsonResponse({
      success: true,
      data: [{ id: 7, nombre: "Cancha de tenis" }],
    });
  },
  async () => {
    assert.deepEqual(await scannerService.getShiftOptions(), [{
      id: "7",
      postServiceId: 7,
      label: "Puesto 7",
      courtName: "Cancha de tenis",
    }]);
  },
));

test("mapea respuestas de acceso concedido y denegaciones del backend", async (t) => {
  const cases = [
    {
      name: "GRANTED / CONCEDIDO",
      status: 200,
      payload: { success: true, data: { access: "GRANTED", resultado: "CONCEDIDO" } },
      expected: { access: "GRANTED", resultado: "CONCEDIDO" },
    },
    {
      name: "ALREADY_USED",
      status: 200,
      payload: {
        success: true,
        data: { access: "DENIED", code: "ALREADY_USED", resultado: "DENEGADO_USADO" },
      },
      expected: { access: "DENIED", code: "ALREADY_USED", resultado: "DENEGADO_USADO" },
    },
    {
      name: "SERVICE_MISMATCH",
      status: 403,
      payload: {
        success: false,
        error: { code: "SERVICE_MISMATCH", message: "El ticket pertenece a otro servicio." },
      },
      expected: {
        access: "DENIED",
        code: "SERVICE_MISMATCH",
        resultado: "DENEGADO_SERVICIO",
        message: "El ticket pertenece a otro servicio.",
      },
    },
    {
      name: "WINDOW_EXPIRED",
      status: 200,
      payload: {
        success: true,
        data: { access: "DENIED", code: "WINDOW_EXPIRED", resultado: "DENEGADO_HORARIO" },
      },
      expected: { access: "DENIED", code: "WINDOW_EXPIRED", resultado: "DENEGADO_HORARIO" },
    },
  ] as const;

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      await withFetch(
        async (input, init) => {
          assert.equal(String(input), "/api/access/redeem");
          assert.equal(init?.method, "POST");
          assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
          assert.equal(typeof init?.body, "string");
          if (typeof init?.body !== "string") {
            throw new Error("El request no incluye un cuerpo JSON.");
          }
          const requestBody: unknown = JSON.parse(init.body);
          assert.deepEqual(requestBody, { ticketId, signature, postServiceId: 7 });
          return jsonResponse(testCase.payload, testCase.status);
        },
        async () => {
          const response = await scannerService.redeemTicket({ ticketId, signature }, 7);
          assert.deepEqual(response, testCase.expected);
        },
      )();
    });
  }
});
