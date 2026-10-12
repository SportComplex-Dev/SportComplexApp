/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../client";
import {
  findFestivosByYear,
  findFestivoByDate,
  upsertFestivo,
  upsertManyFestivos,
  getAllFestivos,
} from "./festivos";

describe("Festivos Repository (packages/db - Tabla FESTIVO)", () => {
  it("findFestivosByYear consulta registros filtrando por anio ordenados por fecha asc", async () => {
    const originalFindMany = prisma.festivo.findMany;
    let capturedArgs: any = null;

    prisma.festivo.findMany = (async (args: any) => {
      capturedArgs = args;
      return [
        {
          fecha: new Date("2026-01-01T00:00:00.000Z"),
          nombre: "Año Nuevo",
          anio: 2026,
        },
        {
          fecha: new Date("2026-10-12T00:00:00.000Z"),
          nombre: "Día de la Raza",
          anio: 2026,
        },
      ];
    }) as any;

    try {
      const results = await findFestivosByYear(2026);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(capturedArgs.where.anio, 2026);
      assert.deepStrictEqual(capturedArgs.orderBy, { fecha: "asc" });
    } finally {
      prisma.festivo.findMany = originalFindMany;
    }
  });

  it("findFestivoByDate busca por fecha normalizada a Date", async () => {
    const originalFindUnique = prisma.festivo.findUnique;
    let capturedArgs: any = null;

    prisma.festivo.findUnique = (async (args: any) => {
      capturedArgs = args;
      return {
        fecha: new Date("2026-10-12T00:00:00.000Z"),
        nombre: "Día de la Raza",
        anio: 2026,
      };
    }) as any;

    try {
      const res = await findFestivoByDate("2026-10-12");
      assert.ok(res);
      assert.strictEqual(res?.nombre, "Día de la Raza");
      assert.ok(capturedArgs.where.fecha instanceof Date);
    } finally {
      prisma.festivo.findUnique = originalFindUnique;
    }
  });

  it("upsertFestivo inserta o actualiza según la fecha primaria", async () => {
    const originalUpsert = prisma.festivo.upsert;
    let capturedArgs: any = null;

    prisma.festivo.upsert = (async (args: any) => {
      capturedArgs = args;
      return {
        fecha: args.where.fecha,
        nombre: args.create.nombre,
        anio: args.create.anio,
      };
    }) as any;

    try {
      const res = await upsertFestivo({
        fecha: "2026-10-12",
        nombre: "Día de la Raza",
        anio: 2026,
      });

      assert.strictEqual(res.nombre, "Día de la Raza");
      assert.strictEqual(capturedArgs.update.nombre, "Día de la Raza");
      assert.strictEqual(capturedArgs.update.anio, 2026);
      assert.strictEqual(capturedArgs.create.anio, 2026);
    } finally {
      prisma.festivo.upsert = originalUpsert;
    }
  });

  it("upsertManyFestivos procesa un lote de festivos secuencialmente", async () => {
    const originalUpsert = prisma.festivo.upsert;
    const calls: any[] = [];

    prisma.festivo.upsert = (async (args: any) => {
      calls.push(args);
      return {
        fecha: args.where.fecha,
        nombre: args.create.nombre,
        anio: args.create.anio,
      };
    }) as any;

    try {
      await upsertManyFestivos([
        { fecha: "2026-01-01", nombre: "Año Nuevo" },
        { fecha: "2026-05-01", nombre: "Día del Trabajo", anio: 2026 },
      ]);

      assert.strictEqual(calls.length, 2);
      assert.strictEqual(calls[0].create.nombre, "Año Nuevo");
      assert.strictEqual(calls[0].create.anio, 2026); // Infiere año de fecha
      assert.strictEqual(calls[1].create.nombre, "Día del Trabajo");
    } finally {
      prisma.festivo.upsert = originalUpsert;
    }
  });

  it("getAllFestivos retorna todos los festivos ordenados por fecha", async () => {
    const originalFindMany = prisma.festivo.findMany;
    let capturedArgs: any = null;

    prisma.festivo.findMany = (async (args: any) => {
      capturedArgs = args;
      return [];
    }) as any;

    try {
      const results = await getAllFestivos();
      assert.deepStrictEqual(results, []);
      assert.deepStrictEqual(capturedArgs.orderBy, { fecha: "asc" });
    } finally {
      prisma.festivo.findMany = originalFindMany;
    }
  });
});
