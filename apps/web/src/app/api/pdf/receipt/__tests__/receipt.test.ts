/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const QR_SECRET = "secreto-qr-tsk-be-19-no-debe-salir";
const RESERVA_ID = "00000000-0000-4000-8000-0000000000aa";
const CODIGO_QR = "9f0d6f4e-0000-4000-8000-0000000000ff";
const CLIENTE = "00000000-0000-4000-8000-000000000001";
const VENDEDOR = "00000000-0000-4000-8000-000000000002";

const { createMockPrisma } = await import(
  "../../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

// Orquestador importado DESPUÉS de inyectar el mock de Prisma.
const { ReceiptError } = await import("@sportcomplex/db");
const { construirComprobante, leerMembrete, validarSolicitudComprobante } = await import(
  "../../../../../lib/receipt"
);
const { parseTicketQrPayload, verifyTicketSignature } = await import("@sportcomplex/core");

const NOW = new Date("2026-10-08T20:44:48.000Z");
// 2026-10-10 10:00–11:00 hora Bogotá = 15:00Z–16:00Z.
const FRANJA = {
  horaInicio: new Date("1899-12-31T10:00:00.000Z"),
  horaFin: new Date("1899-12-31T11:00:00.000Z"),
};

/** Inyectamos el generador de PNG: la firma es lo que se prueba, no `qrcode`. */
const generarQrDataUrl = async (payload: string) =>
  `data:image/png;base64,${Buffer.from(payload).toString("base64")}`;

function seed({ conTicket = true } = {}) {
  for (const key of [
    "usuarios",
    "servicios",
    "franjas",
    "disponibilidades",
    "reservas",
    "tickets",
  ] as const) {
    mock._state[key].length = 0;
  }
  mock._state.usuarios.push(
    { id: CLIENTE, nombre: "Cliente Uno", correo: "cliente@correo.test" },
    { id: VENDEDOR, nombre: "Vendedor Dos", correo: "vendedor@correo.test" },
  );
  mock._state.servicios.push({
    id: 1,
    categoriaId: 1,
    nombre: "Cancha 1",
    capacidadMaxima: 10,
    tarifa: 75000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  });
  mock._state.franjas.push({
    id: 1,
    servicioId: 1,
    diaSemana: 6,
    ...FRANJA,
  });
  mock._state.disponibilidades.push({
    id: 1n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date("2026-10-10T00:00:00.000Z"),
    cuposTotales: 10,
    cuposOcupados: 1,
    bloqueadaMantenimiento: false,
  });
  mock._state.reservas.push({
    id: RESERVA_ID,
    disponibilidadId: 1n,
    estado: "CONFIRMADA",
    titularId: CLIENTE,
    cantidadCupos: 1,
    canal: "ONLINE",
    subtotal: 75000,
    descuentoPct: 0,
    total: 75000,
    // `pagoId` existe en la fila pero NO debe aparecer en el comprobante.
    pagoId: "11111111-1111-4111-8111-111111111111",
    creadoEn: new Date("2026-10-08T15:00:00.000Z"),
  });
  if (conTicket) {
    mock._state.tickets.push({
      id: "ticket-1",
      reservaId: RESERVA_ID,
      codigoUuid: CODIGO_QR,
      usadoPor: null,
      estado: "EMITIDO",
      usadoEn: null,
      emitidoEn: new Date("2026-10-08T15:00:05.000Z"),
    });
  }
}

function comprobante(overrides: Record<string, unknown> = {}) {
  return construirComprobante(RESERVA_ID, {
    solicitante: {
      userId: CLIENTE,
      role: "Cliente",
      destinatario: "PORTAL",
    },
    qrSecret: QR_SECRET,
    now: NOW,
    db: mock,
    generarQrDataUrl,
    ...overrides,
  } as any);
}

test("TSK-BE-19: devuelve membrete, reserva, servicio, titular y QR del servidor", async () => {
  seed();
  const data = await comprobante();

  assert.equal(data.emision.documento, "COMPROBANTE_DE_RESERVA");
  assert.equal(data.emision.zonaHoraria, "America/Bogota");
  assert.equal(data.emision.moneda, "COP");
  assert.equal(data.emision.generadoEn, NOW.toISOString());
  assert.equal(data.emision.destinatario, "PORTAL");

  assert.equal(data.membrete.entidad, "SportComplex — Complejo Deportivo");
  assert.equal(data.membrete.nit, null);

  assert.equal(data.reserva.id, RESERVA_ID);
  assert.equal(data.reserva.estado, "CONFIRMADA");
  assert.equal(data.reserva.total, "75000.00");
  assert.equal(data.reserva.descuentoPct, "0.00");
  assert.equal(data.reserva.cantidadCupos, 1);

  assert.equal(data.servicio.nombre, "Cancha 1");
  assert.equal(data.servicio.fecha, "2026-10-10");
  assert.equal(data.servicio.horaInicio, "10:00:00");
  assert.equal(data.servicio.horaFin, "11:00:00");
  assert.equal(data.servicio.ventana.inicio, "2026-10-10T15:00:00.000Z");
  assert.equal(data.servicio.ventana.fin, "2026-10-10T16:00:00.000Z");

  assert.equal(data.titular.id, CLIENTE);
  assert.equal(data.titular.nombre, "Cliente Uno");
  assert.equal(data.titular.correo, "cliente@correo.test");

  assert.equal(data.ticket?.estado, "EMITIDO");
  assert.equal(data.ticket?.emitidoEn, "2026-10-08T15:00:05.000Z");
  assert.equal(data.ticket?.usadoEn, null);
  assert.equal(data.qr?.dataUrl.startsWith("data:image/png;base64,"), true);
});

test("TSK-BE-19 (RF-13): el QR firmado en servidor supera verifyTicketSignature", async () => {
  seed();
  const data = await comprobante();

  const separado = parseTicketQrPayload(data.qr!.payload);
  assert.equal(separado?.ticketId, CODIGO_QR);
  assert.equal(verifyTicketSignature(separado!.ticketId, separado!.signature, QR_SECRET), true);
  // La imagen del QR se genera desde el mismo payload (nada inventado en el cliente).
  assert.equal(
    Buffer.from(data.qr!.dataUrl.replace("data:image/png;base64,", ""), "base64").toString(),
    data.qr!.payload,
  );
});

test("TSK-BE-19 (CRITERIO): ninguna credencial de infraestructura llega al cliente", async () => {
  seed();
  process.env.STRIPE_SECRET_KEY = "sk_test_no-debe-viajar";
  process.env.DATABASE_URL = "postgresql://user:clave-secreta@host:5432/db";

  const data = await comprobante();
  const serializado = JSON.stringify(data);

  assert.equal(serializado.includes(QR_SECRET), false);
  assert.equal(serializado.includes("sk_test_no-debe-viajar"), false);
  assert.equal(serializado.includes("clave-secreta"), false);
  assert.equal(serializado.includes("stripe"), false);
  assert.equal(serializado.includes("pagoId"), false);
  assert.equal(serializado.includes("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(serializado.includes("DATABASE_URL"), false);
});

test("TSK-BE-19: un cliente no puede descargar el comprobante de una reserva ajena", async () => {
  seed();
  await assert.rejects(
    () => comprobante({ solicitante: { userId: VENDEDOR, role: "Cliente", destinatario: "PORTAL" } }),
    (err: unknown) =>
      err instanceof ReceiptError && err.code === "RECEIPT_FORBIDDEN" && err.status === 403,
  );
});

test("TSK-BE-19: el vendedor sí puede emitir el comprobante en taquilla (RF-17)", async () => {
  seed();
  const data = await comprobante({
    solicitante: { userId: VENDEDOR, role: "Empleado_Vendedor", destinatario: "POS" },
  });
  assert.equal(data.titular.nombre, "Cliente Uno");
  assert.equal(data.emision.destinatario, "POS");
  assert.equal(data.reserva.id, RESERVA_ID);
});

test("TSK-BE-19: un cliente no puede estampar su comprobante como POS", async () => {
  seed();
  await assert.rejects(
    () =>
      comprobante({
        solicitante: { userId: CLIENTE, role: "Cliente", destinatario: "POS" },
      }),
    (err: unknown) =>
      err instanceof ReceiptError && err.code === "RECEIPT_FORBIDDEN" && err.status === 403,
  );
});

test("TSK-BE-19: reserva inexistente → 404 y reserva sin boleto → comprobante sin QR", async () => {
  seed();
  await assert.rejects(
    () =>
      construirComprobante("00000000-0000-4000-8000-0000000000de", {
        solicitante: { userId: CLIENTE, role: "Cliente", destinatario: "PORTAL" },
        qrSecret: QR_SECRET,
        db: mock,
        generarQrDataUrl,
      } as any),
    (err: unknown) =>
      err instanceof ReceiptError && err.code === "RECEIPT_NOT_FOUND" && err.status === 404,
  );

  seed({ conTicket: false });
  const sinTicket = await comprobante();
  assert.equal(sinTicket.qr, null);
  assert.equal(sinTicket.ticket, null);
});

test("TSK-BE-19: sin QR_HMAC_SECRET se rechaza antes de leer la base de datos", async () => {
  seed();
  await assert.rejects(
    () => comprobante({ qrSecret: "   " }),
    (err: unknown) =>
      err instanceof ReceiptError && err.code === "QR_NOT_CONFIGURED" && err.status === 503,
  );
});

test("TSK-BE-19: la validación de entrada exige reservaId UUID y destinatario válido", () => {
  assert.deepEqual(validarSolicitudComprobante({ reservaId: RESERVA_ID, destinatario: "POS" }), {
    reservaId: RESERVA_ID,
    destinatario: "POS",
  });
  for (const entrada of [
    { reservaId: null, destinatario: "PORTAL" },
    { reservaId: "no-uuid", destinatario: "PORTAL" },
    { reservaId: RESERVA_ID, destinatario: null },
    { reservaId: RESERVA_ID, destinatario: "CORREO" },
  ]) {
    assert.throws(
      () => validarSolicitudComprobante(entrada as any),
      (err: unknown) => err instanceof ReceiptError && err.code === "VALIDATION_ERROR",
    );
  }
});

test("TSK-BE-19: el membrete se configura por entorno y oculta campos vacíos", () => {
  assert.deepEqual(
    leerMembrete({
      RECEIPT_ENTIDAD: "Complejo Deportivo S.A.S.",
      RECEIPT_NIT: "900.123.456-1",
      RECEIPT_DIRECCION: "   ",
    }),
    {
      entidad: "Complejo Deportivo S.A.S.",
      nit: "900.123.456-1",
      direccion: null,
      telefono: null,
      correo: null,
      pie: null,
    },
  );
});