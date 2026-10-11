/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const { createMockPrisma } = await import(
  "../../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;
Reflect.set(process.env, "NODE_ENV", "test");
const adminId = "00000000-0000-4000-8000-000000000021";
mock._state.usuarios.push({
  id: adminId,
  nombre: "Admin",
  estado: "ACTIVO",
  deletedAt: null,
  rolId: 1,
  rolNombre: "ADMINISTRADOR",
});
(globalThis as any).__scAuthSession = { user: { id: adminId } };

// Import route handler after mocking prisma
const analyticsRoute = await import("../route");

test("API: GET /api/admin/analytics rechaza rol sin permiso y cuentas inactivas", async () => {
  const admin = mock._state.usuarios.find((user: { id: string }) => user.id === adminId)!;
  admin.rolNombre = "LECTOR";
  const forbidden = await analyticsRoute.GET(
    new Request("http://localhost:3000/api/admin/analytics"),
  );
  assert.equal(forbidden.status, 403);

  admin.rolNombre = "ADMINISTRADOR";
  admin.estado = "INACTIVO";
  const inactive = await analyticsRoute.GET(
    new Request("http://localhost:3000/api/admin/analytics"),
  );
  assert.equal(inactive.status, 403);
  admin.estado = "ACTIVO";
});

test("API: GET /api/admin/analytics rechaza fechas con formato inválido con 400", async () => {
  const req = new Request("http://localhost:3000/api/admin/analytics?startDate=2026/10/01");
  const res = await analyticsRoute.GET(req);
  assert.equal(res.status, 400);

  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error.code, "VALIDATION_ERROR");
});

test("API: GET /api/admin/analytics rechaza startDate posterior a endDate con 400", async () => {
  const req = new Request("http://localhost:3000/api/admin/analytics?startDate=2026-10-10&endDate=2026-10-05");
  const res = await analyticsRoute.GET(req);
  assert.equal(res.status, 400);

  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error.code, "VALIDATION_ERROR");
  assert.ok(json.error.message.includes("no puede ser posterior"));
});

test("API: GET /api/admin/analytics entrega estructura completa consolidada", async () => {
  // Seed mock state
  mock._state.categorias.push(
    { id: 1, nombre: "Canchas", tipo: "CANCHA" },
    { id: 2, nombre: "Piscinas", tipo: "PISCINA" }
  );

  mock._state.servicios.push(
    { id: 1, categoriaId: 1, nombre: "Cancha Fútbol 5", modalidad: "EXCLUSIVA", capacidadMaxima: 10, tarifa: 50000, estado: "ACTIVO" },
    { id: 2, categoriaId: 2, nombre: "Piscina Climatizada", modalidad: "AFORO", capacidadMaxima: 20, tarifa: 25000, estado: "ACTIVO" }
  );

  mock._state.disponibilidades.push(
    { id: 1n, servicioId: 1, franjaId: 1, fecha: new Date("2026-10-05T00:00:00Z"), cuposTotales: 10, cuposOcupados: 2, bloqueadaMantenimiento: false },
    { id: 2n, servicioId: 2, franjaId: 2, fecha: new Date("2026-10-05T00:00:00Z"), cuposTotales: 20, cuposOcupados: 1, bloqueadaMantenimiento: false }
  );

  mock._state.reservas.push(
    { id: "r1", disponibilidadId: 1n, titularId: "u1", estado: "CONFIRMADA", cantidadCupos: 2, total: 100000, creadoEn: new Date("2026-10-05T15:00:00Z") },
    { id: "r2", disponibilidadId: 2n, titularId: "u2", estado: "CONFIRMADA", cantidadCupos: 1, total: 25000, creadoEn: new Date("2026-10-05T16:00:00Z") }
  );

  mock._state.pagos.push(
    { id: "p1", usuarioId: "u1", monto: 100000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_1", creadoEn: new Date("2026-10-05T15:00:00Z") },
    { id: "p2", usuarioId: "u2", monto: 25000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_2", creadoEn: new Date("2026-10-05T16:00:00Z") }
  );

  mock._state.tickets.push(
    { id: "t1", reservaId: "r1", codigoUuid: "uuid-1", estado: "USADO", usadoEn: new Date("2026-10-05T17:00:00Z") }
  );

  const req = new Request("http://localhost:3000/api/admin/analytics");
  const res = await analyticsRoute.GET(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data);

  // Validar Summary
  assert.equal(json.data.summary.totalAttendance, 1);
  assert.equal(json.data.summary.totalTransactions, 2);
  assert.equal(json.data.summary.totalRevenue, 125000);
  assert.equal(json.data.summary.totalBookings, 2);
  assert.equal(json.data.summary.totalSpotsSold, 3);

  // Validar Categorías
  assert.equal(json.data.categoryPerformance.length, 2);
  assert.equal(json.data.categoryPerformance[0].categoryName, "Canchas");
  assert.equal(json.data.categoryPerformance[0].revenuePercentage, 80);

  // Validar Servicios
  assert.equal(json.data.servicesComparison.length, 2);

  // Validar Filtros y Desglose
  assert.equal(json.data.filters.period, "daily");
  assert.equal(json.data.filters.timezone, "America/Bogota");
  assert.equal(json.data.periodBreakdown.period, "daily");
  assert.ok(Array.isArray(json.data.periodBreakdown.items));
});

test("API: GET /api/admin/analytics soporta alias en español y period=weekly", async () => {
  const req = new Request(
    "http://localhost:3000/api/admin/analytics?fechaInicio=2026-10-01&fechaFin=2026-10-10&periodo=semanal"
  );
  const res = await analyticsRoute.GET(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.filters.startDate, "2026-10-01");
  assert.equal(json.data.filters.endDate, "2026-10-10");
  assert.equal(json.data.filters.period, "weekly");
  assert.equal(json.data.periodBreakdown.period, "weekly");
});
