/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env.local") });
dotenv.config();

const { getAnalytics } = await import("./analytics");
const { createMockPrisma } = await import("../../test/mock-prisma");
const { prisma } = await import("../client");

test("TSK-BE-24 Mock: getAnalytics calcula métricas consolidadas en memoria", async () => {
  const mock = createMockPrisma();

  // Seed categorías
  mock._state.categorias.push(
    { id: 1, nombre: "Canchas", tipo: "CANCHA" },
    { id: 2, nombre: "Piscinas", tipo: "PISCINA" }
  );

  // Seed servicios
  mock._state.servicios.push(
    { id: 1, categoriaId: 1, nombre: "Cancha Fútbol 5", modalidad: "EXCLUSIVA", capacidadMaxima: 10, tarifa: 50000, estado: "ACTIVO" },
    { id: 2, categoriaId: 2, nombre: "Piscina Climatizada", modalidad: "AFORO", capacidadMaxima: 20, tarifa: 25000, estado: "ACTIVO" }
  );

  // Seed disponibilidades
  mock._state.disponibilidades.push(
    { id: 101n, servicioId: 1, franjaId: 1, fecha: new Date("2026-10-05T00:00:00Z"), cuposTotales: 10, cuposOcupados: 2, bloqueadaMantenimiento: false },
    { id: 102n, servicioId: 2, franjaId: 2, fecha: new Date("2026-10-05T00:00:00Z"), cuposTotales: 20, cuposOcupados: 1, bloqueadaMantenimiento: false }
  );

  // Seed reservas confirmadas
  mock._state.reservas.push(
    { id: "r1", disponibilidadId: 101n, titularId: "u1", estado: "CONFIRMADA", cantidadCupos: 2, total: 100000, creadoEn: new Date("2026-10-05T15:00:00Z") },
    { id: "r2", disponibilidadId: 102n, titularId: "u2", estado: "CONFIRMADA", cantidadCupos: 1, total: 25000, creadoEn: new Date("2026-10-05T16:00:00Z") },
    { id: "r3", disponibilidadId: 101n, titularId: "u3", estado: "EXPIRADA", cantidadCupos: 1, total: 50000, creadoEn: new Date("2026-10-05T14:00:00Z") }
  );

  // Seed pagos aprobados
  mock._state.pagos.push(
    { id: "p1", usuarioId: "u1", monto: 100000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_1", creadoEn: new Date("2026-10-05T15:00:00Z") },
    { id: "p2", usuarioId: "u2", monto: 25000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_2", creadoEn: new Date("2026-10-05T16:00:00Z") }
  );

  // Seed tickets usados
  mock._state.tickets.push(
    { id: "t1", reservaId: "r1", codigoUuid: "uuid-1", estado: "USADO", usadoEn: new Date("2026-10-05T17:00:00Z") },
    { id: "t2", reservaId: "r2", codigoUuid: "uuid-2", estado: "EMITIDO", usadoEn: null }
  );

  const res = await getAnalytics({ db: mock });

  assert.equal(res.summary.totalAttendance, 1);
  assert.equal(res.summary.totalTransactions, 2);
  assert.equal(res.summary.totalRevenue, 125000);
  assert.equal(res.summary.uniqueAttendees, 1);
  assert.equal(res.summary.totalBookings, 2);
  assert.equal(res.summary.totalSpotsSold, 3);

  // Categorías
  assert.equal(res.categoryPerformance.length, 2);
  assert.equal(res.categoryPerformance[0].categoryName, "Canchas");
  assert.equal(res.categoryPerformance[0].totalRevenue, 100000);
  assert.equal(res.categoryPerformance[0].revenuePercentage, 80);
  assert.equal(res.categoryPerformance[1].categoryName, "Piscinas");
  assert.equal(res.categoryPerformance[1].totalRevenue, 25000);
  assert.equal(res.categoryPerformance[1].revenuePercentage, 20);

  // Servicios
  assert.equal(res.servicesComparison.length, 2);
  const canchaSrv = res.servicesComparison.find((s) => s.serviceName === "Cancha Fútbol 5");
  assert.ok(canchaSrv);
  assert.equal(canchaSrv.totalSold, 2);
  assert.equal(canchaSrv.totalUsed, 1);
  assert.equal(canchaSrv.totalRevenue, 100000);
});

test("TSK-BE-24 Mock: filtro de fecha y agrupación semanal", async () => {
  const mock = createMockPrisma();
  mock._state.categorias.push({ id: 1, nombre: "Canchas", tipo: "CANCHA" });
  mock._state.servicios.push({ id: 1, categoriaId: 1, nombre: "Cancha 1", modalidad: "EXCLUSIVA", capacidadMaxima: 10, tarifa: 50000, estado: "ACTIVO" });
  mock._state.disponibilidades.push({ id: 1n, servicioId: 1, franjaId: 1, fecha: new Date("2026-10-01T00:00:00Z"), cuposTotales: 10, cuposOcupados: 1, bloqueadaMantenimiento: false });

  // 2 reservas en diferentes fechas
  mock._state.reservas.push(
    { id: "r1", disponibilidadId: 1n, titularId: "u1", estado: "CONFIRMADA", cantidadCupos: 1, total: 50000, creadoEn: new Date("2026-10-01T15:00:00Z") },
    { id: "r2", disponibilidadId: 1n, titularId: "u1", estado: "CONFIRMADA", cantidadCupos: 1, total: 50000, creadoEn: new Date("2026-10-08T15:00:00Z") }
  );
  mock._state.pagos.push(
    { id: "p1", usuarioId: "u1", monto: 50000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_1", creadoEn: new Date("2026-10-01T15:00:00Z") },
    { id: "p2", usuarioId: "u1", monto: 50000, estado: "APROBADO", tipo: "RESERVA", stripePaymentIntentId: "pi_2", creadoEn: new Date("2026-10-08T15:00:00Z") }
  );

  const res = await getAnalytics({
    startDate: "2026-10-05",
    endDate: "2026-10-10",
    period: "weekly",
    db: mock,
  });

  // Solo r2/p2 entran en el rango
  assert.equal(res.summary.totalTransactions, 1);
  assert.equal(res.summary.totalRevenue, 50000);
  assert.equal(res.summary.totalBookings, 1);
  assert.equal(res.periodBreakdown.period, "weekly");
  assert.equal(res.filters.period, "weekly");
});

test("TSK-BE-24 Criterio de Aceptación Clave (BD Real): responde en < 2 s y cuadra contra COUNT directo transaccional", async (t) => {
  const connectionUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionUrl) {
    t.skip("No hay DATABASE_URL configurada para test de integración con BD real.");
    return;
  }

  const start = performance.now();
  const analytics = await getAnalytics({ period: "daily", db: prisma });
  const durationMs = performance.now() - start;

  // Criterio 1: responde en < 2 s (< 2000 ms)
  assert.ok(
    durationMs < 2000,
    `El endpoint debe responder en < 2 s. Tardó: ${durationMs.toFixed(2)} ms`
  );

  // Criterio 2: Las cifras cuadran contra un COUNT directo sobre las tablas transaccionales
  const directCounts = (await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM ticket_qr WHERE estado = 'USADO' AND usado_en IS NOT NULL) AS direct_tickets_usados,
      (SELECT COUNT(*) FROM pago WHERE estado = 'APROBADO') AS direct_pagos_aprobados,
      (SELECT COALESCE(SUM(monto), 0) FROM pago WHERE estado = 'APROBADO') AS direct_ingresos_aprobados,
      (SELECT COUNT(*) FROM reserva WHERE estado = 'CONFIRMADA') AS direct_reservas_confirmadas,
      (SELECT COALESCE(SUM(cantidad_cupos), 0) FROM reserva WHERE estado = 'CONFIRMADA') AS direct_cupos_vendidos;
  `)) as any[];

  assert.ok(directCounts.length > 0);
  const direct = directCounts[0];

  assert.equal(
    analytics.summary.totalAttendance,
    Number(direct.direct_tickets_usados),
    "La afluencia total calculada debe cuadrar contra el COUNT(*) directo de tickets en estado USADO"
  );

  assert.equal(
    analytics.summary.totalTransactions,
    Number(direct.direct_pagos_aprobados),
    "El total de transacciones debe cuadrar contra el COUNT(*) directo de pagos APROBADOS"
  );

  assert.equal(
    analytics.summary.totalRevenue,
    Number(Number(direct.direct_ingresos_aprobados).toFixed(2)),
    "Los ingresos totales deben cuadrar contra el SUM(monto) directo de pagos APROBADOS"
  );

  assert.equal(
    analytics.summary.totalBookings,
    Number(direct.direct_reservas_confirmadas),
    "El total de reservas debe cuadrar contra el COUNT(*) directo de reservas CONFIRMADAS"
  );

  assert.equal(
    analytics.summary.totalSpotsSold,
    Number(direct.direct_cupos_vendidos),
    "El total de cupos vendidos debe cuadrar contra el SUM(cantidad_cupos) directo de reservas CONFIRMADAS"
  );
});
