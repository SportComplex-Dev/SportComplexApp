import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchColombiaHolidays,
  getColombiaHolidays,
  isDateHoliday,
  STRICT_TIMEOUT_MS,
  type NagerHoliday,
  type HolidayCacheStore,
} from "./nager-date";

describe("Nager.Date Integration - Cache-Aside & Resiliencia (SCRUM-103 / TSK-BE-07)", () => {
  const mockHolidays2026: NagerHoliday[] = [
    { date: "2026-01-01", localName: "Año Nuevo", name: "New Year's Day" },
    { date: "2026-05-01", localName: "Día del Trabajo", name: "Labour Day" },
    { date: "2026-07-20", localName: "Día de la Independencia", name: "Independence Day" },
    { date: "2026-10-12", localName: "Día de la Raza", name: "Columbus Day" },
  ];

  class InMemoryCacheStore implements HolidayCacheStore {
    public storage: Map<number, NagerHoliday[]> = new Map();
    public saveCalls: Array<{ year: number; count: number }> = [];
    public getCalls: number[] = [];

    async getByYear(year: number): Promise<NagerHoliday[]> {
      this.getCalls.push(year);
      return this.storage.get(year) ?? [];
    }

    async saveHolidays(holidays: NagerHoliday[], year: number): Promise<void> {
      this.saveCalls.push({ year, count: holidays.length });
      this.storage.set(year, [...holidays]);
    }
  }

  describe("Timeout estricto de 2.5s", () => {
    it("STRICT_TIMEOUT_MS está configurado exactamente en 2500 ms", () => {
      assert.strictEqual(STRICT_TIMEOUT_MS, 2500);
    });

    it("fetchColombiaHolidays aborta con TimeoutError si la API no responde dentro del límite", async () => {
      await assert.rejects(
        async () => {
          // Timeout mínimo de 50ms para verificar la expiración estricta
          await fetchColombiaHolidays(2026, {
            baseUrl: "http://10.255.255.1",
            timeoutMs: 50,
          });
        },
        (err: Error) => err.name === "TimeoutError",
      );
    });
  });

  describe("Patrón Cache-Aside", () => {
    it("Cache Miss: consulta a la API, persiste en caché (tabla FESTIVO) y retorna festivos", async () => {
      const cache = new InMemoryCacheStore();
      let apiCalled = false;

      const fetcher = async (year: number) => {
        apiCalled = true;
        assert.strictEqual(year, 2026);
        return mockHolidays2026;
      };

      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher,
        preferCache: true,
      });

      assert.strictEqual(apiCalled, true);
      assert.strictEqual(result.length, mockHolidays2026.length);
      assert.strictEqual(result[0].date, "2026-01-01");

      // Verificamos que se haya persistido en el store (Cache-Aside write)
      assert.strictEqual(cache.saveCalls.length, 1);
      assert.strictEqual(cache.saveCalls[0].year, 2026);
      assert.strictEqual(cache.saveCalls[0].count, mockHolidays2026.length);

      // Verificamos que ahora el caché contiene los datos
      const inCache = await cache.getByYear(2026);
      assert.strictEqual(inCache.length, mockHolidays2026.length);
    });

    it("Cache Hit: responde desde la caché local sin invocar a la API externa", async () => {
      const cache = new InMemoryCacheStore();
      // Pre-poblamos la caché
      await cache.saveHolidays(mockHolidays2026, 2026);

      let apiCalled = false;
      const fetcher = async () => {
        apiCalled = true;
        return [];
      };

      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher,
        preferCache: true,
      });

      // NO debe haber llamado a la API
      assert.strictEqual(apiCalled, false);
      assert.strictEqual(result.length, mockHolidays2026.length);
      assert.strictEqual(result[3].date, "2026-10-12");
    });
  });

  describe("Resiliencia: API caída o lenta responde desde caché sin fallar (Criterio C)", () => {
    it("cuando la API está caída (error HTTP/red), responde desde la caché sin lanzar error", async () => {
      const cache = new InMemoryCacheStore();
      await cache.saveHolidays(mockHolidays2026, 2026);

      // Simulamos API caída arrojando un error
      const failingFetcher = async () => {
        throw new Error("500 Internal Server Error: Nager.Date API unavailable");
      };

      // No debe lanzar excepción
      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher: failingFetcher,
        preferCache: false, // Forzamos intento de API para probar el fallback
      });

      assert.strictEqual(result.length, mockHolidays2026.length);
      assert.strictEqual(result[0].date, "2026-01-01");
      assert.strictEqual(result[3].date, "2026-10-12");
    });

    it("cuando la API es lenta (>2.5s timeout), cancela la petición y responde desde la caché local", async () => {
      const cache = new InMemoryCacheStore();
      await cache.saveHolidays(mockHolidays2026, 2026);

      // Simulamos latencia excesiva que agota el timeout
      const slowFetcher = async () => {
        // Simular error de timeout de Ky (TimeoutError)
        const timeoutErr = new Error("Request timed out");
        timeoutErr.name = "TimeoutError";
        throw timeoutErr;
      };

      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher: slowFetcher,
        preferCache: false,
      });

      assert.strictEqual(result.length, mockHolidays2026.length);
      assert.strictEqual(result[3].localName, "Día de la Raza");
    });

    it("cuando la API cae y la caché está vacía, retorna lista vacía sin romper disponibilidad", async () => {
      const cache = new InMemoryCacheStore();

      const failingFetcher = async () => {
        throw new Error("Network unreachable");
      };

      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher: failingFetcher,
        preferCache: false,
      });

      assert.deepStrictEqual(result, []);
    });

    it("forceRefresh: true intenta refrescar la API y en caso de fallo preserva los datos de caché", async () => {
      const cache = new InMemoryCacheStore();
      await cache.saveHolidays(mockHolidays2026, 2026);

      const failingFetcher = async () => {
        throw new Error("Service Unavailable");
      };

      const result = await getColombiaHolidays(2026, {
        cacheStore: cache,
        fetcher: failingFetcher,
        forceRefresh: true,
      });

      assert.strictEqual(result.length, mockHolidays2026.length);
    });
  });

  describe("isDateHoliday", () => {
    it("reconoce correctamente si una fecha es festivo", () => {
      assert.strictEqual(isDateHoliday("2026-10-12", mockHolidays2026), true);
      assert.strictEqual(isDateHoliday("2026-10-05", mockHolidays2026), false);
    });

    it("funciona con objetos de la base de datos", () => {
      const dbRecords = [
        { fecha: new Date("2026-10-12T00:00:00.000Z"), nombre: "Día de la Raza" },
      ];
      assert.strictEqual(isDateHoliday("2026-10-12", dbRecords), true);
      assert.strictEqual(isDateHoliday("2026-10-13", dbRecords), false);
    });
  });
});
