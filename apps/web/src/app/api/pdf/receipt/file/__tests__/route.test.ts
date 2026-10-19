/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const QR_SECRET = "secreto-qr-pdf-58mm";
const RESERVA_ID = "00000000-0000-4000-8000-0000000000aa";
const CLIENTE = "00000000-0000-4000-8000-000000000001";
const OTRO_CLIENTE = "00000000-0000-4000-8000-000000000003";
const VENDEDOR = "00000000-0000-4000-8000-000000000002";

process.env.QR_HMAC_SECRET = QR_SECRET;
const { createMockPrisma } = await import("@db-test/mock-prisma");
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { GET } = await import("@/app/api/pdf/receipt/file/route");

function usuario(id: string, rolNombre: string) {
  return { id, nombre: `Usuario ${id.slice(-1)}`, correo: `${id}@correo.test`, estado: "ACTIVO", deletedAt: null, rolId: 1, rolNombre };
}

function seed() {
  for (const key of ["usuarios", "servicios", "franjas", "disponibilidades", "reservas", "tickets"] as const) {
    mock._state[key].length = 0;
  }
  mock._state.usuarios.push(usuario(CLIENTE, "CLIENTE"), usuario(OTRO_CLIENTE, "CLIENTE"), usuario(VENDEDOR, "VENDEDOR"));
  mock._state.servicios.push({ id: 1, categoriaId: 1, nombre: "Cancha 1", capacidadMaxima: 10, tarifa: 75000, modalidad: "EXCLUSIVA", tipoPiscina: null, estado: "ACTIVO" });
  mock._state.franjas.push({ id: 1, servicioId: 1, diaSemana: 6, horaInicio: new Date("1899-12-31T10:00:00.000Z"), horaFin: new Date("1899-12-31T11:00:00.000Z") });
  mock._state.disponibilidades.push({ id: 1n, servicioId: 1, franjaId: 1, fecha: new Date("2026-10-10T00:00:00.000Z"), cuposTotales: 10, cuposOcupados: 1, bloqueadaMantenimiento: false });
  mock._state.reservas.push({
    id: RESERVA_ID, disponibilidadId: 1n, estado: "CONFIRMADA", titularId: CLIENTE, cantidadCupos: 1, canal: "ONLINE",
    subtotal: 75000, descuentoPct: 0, total: 75000, creadoEn: new Date("2026-10-08T15:00:00.000Z"),
  });
  mock._state.tickets.push({
    id: "ticket-1", reservaId: RESERVA_ID, codigoUuid: "9f0d6f4e-0000-4000-8000-0000000000ff", usadoPor: null,
    estado: "EMITIDO", usadoEn: null, emitidoEn: new Date("2026-10-08T15:00:05.000Z"),
  });
}

function pedir(userId: string, destinatario: string) {
  (globalThis as any).__scAuthSession = { user: { id: userId } };
  return GET(new Request(`http://localhost/api/pdf/receipt/file?reservaId=${RESERVA_ID}&destinatario=${destinatario}`));
}

test("PDF 58 mm: el titular descarga su comprobante como archivo PDF", async () => {
  seed();
  const res = await pedir(CLIENTE, "PORTAL");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.equal(res.headers.get("content-disposition"), 'attachment; filename="ticket-00000000.pdf"');
  const pdf = Buffer.from(await res.arrayBuffer()).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(!pdf.includes(QR_SECRET), "El secreto del QR nunca viaja en el PDF");
});

test("PDF 58 mm: un cliente no descarga el comprobante de una reserva ajena", async () => {
  seed();
  const res = await pedir(OTRO_CLIENTE, "PORTAL");
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "RECEIPT_FORBIDDEN");
});

test("PDF 58 mm: el cliente no puede pedir el comprobante de taquilla (POS)", async () => {
  seed();
  const res = await pedir(CLIENTE, "POS");
  assert.equal(res.status, 403);
});

test("PDF 58 mm: el vendedor sí descarga el de taquilla", async () => {
  seed();
  const res = await pedir(VENDEDOR, "POS");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
});

test("PDF 58 mm: valida reservaId y destinatario", async () => {
  seed();
  (globalThis as any).__scAuthSession = { user: { id: CLIENTE } };
  const res = await GET(new Request("http://localhost/api/pdf/receipt/file?reservaId=no-uuid&destinatario=PORTAL"));
  assert.equal(res.status, 400);
});
