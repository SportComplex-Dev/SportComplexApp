import test from "node:test";
import assert from "node:assert/strict";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.INTERNAL_API_KEY = "test-internal-key";

const { createFestivosPostHandler } = await import("@/app/api/internal/festivos/route");

const validBody = {
  festivos: [
    { fecha: "2026-01-01", nombre: "Año Nuevo", anio: 2026 },
    { fecha: "2026-05-01", nombre: "Día del Trabajo", anio: 2026 },
  ],
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/internal/festivos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

await test("rechaza sin INTERNAL_API_KEY configurada (fail-closed)", async () => {
  delete process.env.INTERNAL_API_KEY;
  const POST = createFestivosPostHandler({ saveFestivos: async () => {} });
  const res = await POST(post(validBody, { "x-internal-key": "x" }));
  assert.equal(res.status, 503);
  process.env.INTERNAL_API_KEY = "test-internal-key";
});

await test("rechaza key incorrecta con 401 y no guarda", async () => {
  let saved = 0;
  const POST = createFestivosPostHandler({
    saveFestivos: async () => {
      saved += 1;
    },
  });
  const res = await POST(post(validBody, { "x-internal-key": "otra" }));
  assert.equal(res.status, 401);
  assert.equal(saved, 0);
});

await test("rechaza payload inválido con 400", async () => {
  const POST = createFestivosPostHandler({ saveFestivos: async () => {} });
  const res = await POST(
    post({ festivos: [{ fecha: "no-fecha", nombre: "", anio: 99 }] }, { "x-internal-key": "test-internal-key" }),
  );
  assert.equal(res.status, 400);
});

await test("acepta Bearer alternativo y guarda el lote", async () => {
  const received: unknown[] = [];
  const POST = createFestivosPostHandler({
    saveFestivos: async (items) => {
      received.push(...items);
    },
  });
  const res = await POST(
    post(validBody, { authorization: "Bearer test-internal-key" }),
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.saved, 2);
  assert.equal(received.length, 2);
});

await test("acepta x-internal-key y guarda el lote", async () => {
  let count = 0;
  const POST = createFestivosPostHandler({
    saveFestivos: async (items) => {
      count = items.length;
    },
  });
  const res = await POST(post(validBody, { "x-internal-key": "test-internal-key" }));
  assert.equal(res.status, 200);
  assert.equal(count, 2);
});
