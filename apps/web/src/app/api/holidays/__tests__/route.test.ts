import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../route";

// TSK-FE-07: Pruebas del endpoint de festivos nacionales con Cache-Aside (SCRUM-105)

test("API: GET /api/holidays sin parametro year devuelve festivos del ano actual con cabecera de cache", async () => {
  const req = new Request("http://localhost:3000/api/holidays");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const cacheControl = res.headers.get("Cache-Control");
  assert.ok(cacheControl?.includes("max-age=86400"), "Debe tener cabecera Cache-Control con max-age=86400");

  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(typeof body.year === "number");
  assert.ok(Array.isArray(body.holidays));
  assert.ok(body.holidays.length > 10, "Colombia tiene al menos 18 festivos al año");
});

test("API: GET /api/holidays?year=2026 devuelve los festivos oficiales colombianos de 2026", async () => {
  const req = new Request("http://localhost:3000/api/holidays?year=2026");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.equal(body.year, 2026);
  assert.ok(Array.isArray(body.holidays));

  // Verificar inclusión de festivos clave en Colombia para 2026 (ej. Año Nuevo: 2026-01-01)
  const fechas = body.holidays.map((h: { date: string }) => h.date);
  assert.ok(fechas.includes("2026-01-01"), "Debe incluir Año Nuevo (2026-01-01)");
});

test("API: GET /api/holidays rechaza anos invalidos o fuera de rango (400)", async () => {
  const invalidReq1 = new Request("http://localhost:3000/api/holidays?year=invalido");
  const res1 = await GET(invalidReq1);
  assert.equal(res1.status, 400);
  const body1 = await res1.json();
  assert.equal(body1.success, false);
  assert.equal(body1.error, "Año inválido");

  const invalidReq2 = new Request("http://localhost:3000/api/holidays?year=2015");
  const res2 = await GET(invalidReq2);
  assert.equal(res2.status, 400);

  const invalidReq3 = new Request("http://localhost:3000/api/holidays?year=2050");
  const res3 = await GET(invalidReq3);
  assert.equal(res3.status, 400);
});
