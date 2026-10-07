import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPoolMaintenanceDay,
  getBogotaDateParts,
  checkPoolMaintenanceWithCache,
} from "./pool-policy";
import type { NagerHoliday, HolidayCacheStore } from "../integrations/nager-date";

describe("Pool Policy - isPoolMaintenanceDay (RN-02 / RF-06 / SCRUM-103)", () => {
  // Festivo de prueba: Día de la Raza (Lunes 12 de Octubre de 2026 en Colombia)
  const holidays2026: NagerHoliday[] = [
    { date: "2026-01-01", localName: "Año Nuevo", name: "New Year's Day" },
    { date: "2026-05-01", localName: "Día del Trabajo", name: "Labour Day" },
    { date: "2026-07-20", localName: "Día de la Independencia", name: "Independence Day" },
    { date: "2026-08-07", localName: "Batalla de Boyacá", name: "Battle of Boyacá" },
    { date: "2026-10-12", localName: "Día de la Raza", name: "Columbus Day" },
    { date: "2026-11-02", localName: "Todos los Santos", name: "All Saints' Day" },
  ];

  describe("Caso 1: Lunes ordinario", () => {
    it("bloquea todas las franjas de la piscina un lunes no festivo", () => {
      // 5 de octubre de 2026 es un lunes ordinario (no es festivo)
      const mondayOrdinary = "2026-10-05";
      const result = isPoolMaintenanceDay(mondayOrdinary, holidays2026);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason, "MANTENIMIENTO_LUNES");
    });

    it("bloquea un lunes ordinario usando objeto Date", () => {
      const mondayOrdinaryDate = new Date("2026-10-05T10:00:00-05:00");
      const result = isPoolMaintenanceDay(mondayOrdinaryDate, holidays2026);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason, "MANTENIMIENTO_LUNES");
    });

    it("bloquea un lunes cuando la lista de festivos está vacía", () => {
      const result = isPoolMaintenanceDay("2026-10-05", []);
      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason, "MANTENIMIENTO_LUNES");
    });
  });

  describe("Caso 2: Lunes festivo (abre lunes y traslada a martes)", () => {
    it("mantiene abierta la piscina el lunes festivo oficial en Colombia", () => {
      // 12 de octubre de 2026 es lunes festivo (Día de la Raza)
      const holidayMonday = "2026-10-12";
      const result = isPoolMaintenanceDay(holidayMonday, holidays2026);

      assert.strictEqual(result.blocked, false);
      assert.strictEqual(result.reason, undefined);
    });

    it("bloquea automáticamente el martes inmediatamente posterior a un lunes festivo", () => {
      // 13 de octubre de 2026 es martes tras lunes festivo del 12 de octubre
      const tuesdayAfterHoliday = "2026-10-13";
      const result = isPoolMaintenanceDay(tuesdayAfterHoliday, holidays2026);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });

    it("funciona con martes posterior a lunes festivo usando Date en zona horaria Colombia", () => {
      const tuesdayDate = new Date("2026-10-13T14:30:00-05:00");
      const result = isPoolMaintenanceDay(tuesdayDate, holidays2026);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });
  });

  describe("Caso 3: Martes ordinario (sin traslado)", () => {
    it("mantiene abierta la piscina un martes precedido por un lunes ordinario", () => {
      // 6 de octubre de 2026 es martes tras el lunes ordinario del 5 de octubre
      const ordinaryTuesday = "2026-10-06";
      const result = isPoolMaintenanceDay(ordinaryTuesday, holidays2026);

      assert.strictEqual(result.blocked, false);
      assert.strictEqual(result.reason, undefined);
    });
  });

  describe("Caso 4: Días restantes de la semana (miércoles a domingo)", () => {
    it("no bloquea miércoles, jueves, viernes, sábado ni domingo", () => {
      const days = [
        "2026-10-07", // Miércoles
        "2026-10-08", // Jueves
        "2026-10-09", // Viernes
        "2026-10-10", // Sábado
        "2026-10-11", // Domingo
      ];

      for (const day of days) {
        const res = isPoolMaintenanceDay(day, holidays2026);
        assert.strictEqual(res.blocked, false, `El día ${day} no debería estar bloqueado por mantenimiento`);
      }
    });
  });

  describe("Compatibilidad de tipos de entrada para holidays", () => {
    it("acepta formato de tabla FESTIVO de la base de datos (con fecha como Date)", () => {
      const dbFestivos = [
        { fecha: new Date("2026-10-12T00:00:00.000Z"), nombre: "Día de la Raza", anio: 2026 },
      ];
      // Lunes festivo debe abrir
      const lun = isPoolMaintenanceDay("2026-10-12", dbFestivos);
      assert.strictEqual(lun.blocked, false);

      // Martes posterior debe bloquear
      const mar = isPoolMaintenanceDay("2026-10-13", dbFestivos);
      assert.strictEqual(mar.blocked, true);
      assert.strictEqual(mar.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });

    it("acepta array de strings YYYY-MM-DD", () => {
      const stringHolidays = ["2026-10-12"];
      const mar = isPoolMaintenanceDay("2026-10-13", stringHolidays);
      assert.strictEqual(mar.blocked, true);
    });

    it("acepta Set de strings", () => {
      const setHolidays = new Set(["2026-10-12"]);
      const mar = isPoolMaintenanceDay("2026-10-13", setHolidays);
      assert.strictEqual(mar.blocked, true);
    });

    it("mantiene compatibilidad con firma legacy booleana (isMondayHoliday)", () => {
      const lunOrd = isPoolMaintenanceDay(new Date("2026-10-05T12:00:00-05:00"), false);
      assert.strictEqual(lunOrd.blocked, true);
      assert.strictEqual(lunOrd.reason, "MANTENIMIENTO_LUNES");

      const lunFest = isPoolMaintenanceDay(new Date("2026-10-12T12:00:00-05:00"), true);
      assert.strictEqual(lunFest.blocked, false);

      const marTras = isPoolMaintenanceDay(new Date("2026-10-13T12:00:00-05:00"), true);
      assert.strictEqual(marTras.blocked, true);
      assert.strictEqual(marTras.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });
  });

  describe("getBogotaDateParts", () => {
    it("extrae la fecha e info de día en zona horaria America/Bogota", () => {
      // 2026-10-12T02:00:00Z corresponde a 2026-10-11 a las 21:00 en Bogotá (Domingo)
      const utcEarly = new Date("2026-10-12T02:00:00Z");
      const info = getBogotaDateParts(utcEarly);

      assert.strictEqual(info.dateISO, "2026-10-11");
      assert.strictEqual(info.dayOfWeek, 0); // Domingo
      assert.strictEqual(info.prevDayDateISO, "2026-10-10");
      assert.strictEqual(info.year, 2026);
    });
  });

  describe("checkPoolMaintenanceWithCache (Orquestación con Caché)", () => {
    it("resuelve el mantenimiento consultando desde el almacén de caché", async () => {
      const mockCache: HolidayCacheStore = {
        async getByYear() {
          return [{ date: "2026-10-12", localName: "Día de la Raza", name: "Columbus Day" }];
        },
        async saveHolidays() {},
      };

      // Lunes festivo debe estar abierto
      const resMon = await checkPoolMaintenanceWithCache("2026-10-12", {
        cacheStore: mockCache,
        preferCache: true,
      });
      assert.strictEqual(resMon.blocked, false);

      // Martes posterior debe estar bloqueado
      const resTue = await checkPoolMaintenanceWithCache("2026-10-13", {
        cacheStore: mockCache,
        preferCache: true,
      });
      assert.strictEqual(resTue.blocked, true);
      assert.strictEqual(resTue.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });
  });
});
