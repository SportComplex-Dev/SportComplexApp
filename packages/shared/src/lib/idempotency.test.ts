import test from "node:test";
import assert from "node:assert/strict";
import { IdempotencyCache } from "./idempotency";

test("IdempotencyCache: sin clave ejecuta fn siempre sin almacenar en caché", async () => {
  const cache = new IdempotencyCache(10_000);
  let callCount = 0;

  const run = () =>
    cache.execute(null, async () => {
      callCount++;
      return Response.json({ count: callCount }, { status: 200 });
    });

  const res1 = await run();
  const res2 = await run();

  assert.equal(callCount, 2);
  const data1 = await res1.json();
  const data2 = await res2.json();
  assert.equal(data1.count, 1);
  assert.equal(data2.count, 2);
  assert.equal(cache.size(), 0);
});

test("IdempotencyCache: clave repetida dentro de TTL devuelve respuesta cacheada sin re-ejecutar fn", async () => {
  const cache = new IdempotencyCache(10_000);
  let callCount = 0;

  const run = (key: string) =>
    cache.execute(key, async () => {
      callCount++;
      return Response.json({ count: callCount, ok: true }, { status: 201 });
    });

  const res1 = await run("idem-key-1");
  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  assert.equal(data1.count, 1);
  assert.equal(res1.headers.get("x-idempotent-replayed"), null);

  const res2 = await run("idem-key-1");
  assert.equal(res2.status, 201);
  const data2 = await res2.json();
  assert.equal(data2.count, 1);
  assert.equal(res2.headers.get("x-idempotent-replayed"), "true");

  assert.equal(callCount, 1);
});

test("IdempotencyCache: peticiones concurrentes con la misma clave ejecutan fn solo una vez", async () => {
  const cache = new IdempotencyCache(10_000);
  let callCount = 0;

  const run = (key: string) =>
    cache.execute(key, async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ count: callCount, ts: Date.now() }, { status: 200 });
    });

  const [res1, res2] = await Promise.all([run("concurrent-key"), run("concurrent-key")]);

  assert.equal(callCount, 1);
  const data1 = await res1.json();
  const data2 = await res2.json();
  assert.equal(data1.count, 1);
  assert.equal(data2.count, 1);
});

test("IdempotencyCache: clave expirada (> TTL) vuelve a ejecutar fn", async () => {
  const cache = new IdempotencyCache(50);
  let callCount = 0;

  const run = (key: string) =>
    cache.execute(key, async () => {
      callCount++;
      return Response.json({ count: callCount }, { status: 200 });
    });

  const res1 = await run("expire-key");
  const data1 = await res1.json();
  assert.equal(data1.count, 1);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const res2 = await run("expire-key");
  const data2 = await res2.json();
  assert.equal(data2.count, 2);
  assert.equal(callCount, 2);
});

test("IdempotencyCache: error 5xx no se almacena en caché y permite reintentos", async () => {
  const cache = new IdempotencyCache(10_000);
  let callCount = 0;

  const run = (key: string) =>
    cache.execute(key, async () => {
      callCount++;
      if (callCount === 1) {
        return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
      }
      return Response.json({ success: true }, { status: 200 });
    });

  const res1 = await run("err-key");
  assert.equal(res1.status, 500);

  const res2 = await run("err-key");
  assert.equal(res2.status, 200);
  assert.equal(callCount, 2);
});

test("IdempotencyCache: excepción en fn limpia la clave in-flight y permite reintentos", async () => {
  const cache = new IdempotencyCache(10_000);
  let callCount = 0;

  const run = (key: string) =>
    cache.execute(key, async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Crash");
      }
      return Response.json({ success: true }, { status: 200 });
    });

  await assert.rejects(() => run("crash-key"), /Crash/);
  const res2 = await run("crash-key");
  assert.equal(res2.status, 200);
  assert.equal(callCount, 2);
});
