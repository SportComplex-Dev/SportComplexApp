import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBogotaTodayISO,
  getBookingCalendarDays,
  isWithinBookingWindow,
  validateServiceCapacity,
} from "./availability";
import { isPoolMaintenanceDay } from "./pool-policy";

describe("TSK-FE-06: Ventana máxima de 15 días en calendario de reserva (HU-06 / RF-05 / RN-01)", () => {
  it("getBogotaTodayISO retorna la fecha actual en formato YYYY-MM-DD", () => {
    const today = getBogotaTodayISO();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("días dentro de la ventana (0 a 15) están habilitados y fuera (> 15) deshabilitados", () => {
    // Generar 20 días a partir de hoy
    const days = getBookingCalendarDays(15, 20);

    assert.equal(days.length, 20, "Debe generar 20 días en la secuencia");

    // Días 0..15 deben estar dentro de la ventana
    for (let i = 0; i <= 15; i++) {
      const day = days[i];
      assert.equal(day.daysAhead, i);
      assert.equal(day.isWithinWindow, true, `Día +${i} debe estar dentro de la ventana`);
      assert.equal(day.isBeyondWindow, false, `Día +${i} no debe exceder la ventana`);
    }

    // Días 16..19 deben exceder la ventana (deshabilitados y no clickeables)
    for (let i = 16; i < 20; i++) {
      const day = days[i];
      assert.equal(day.daysAhead, i);
      assert.equal(day.isWithinWindow, false, `Día +${i} debe estar fuera de la ventana`);
      assert.equal(day.isBeyondWindow, true, `Día +${i} debe marcar isBeyondWindow=true`);
    }
  });

  it("isWithinBookingWindow rechaza fechas en el pasado y mayores a 15 días", () => {
    const now = new Date("2026-10-07T12:00:00-05:00");
    const past = new Date(now.getTime() - 1000 * 60 * 60);
    const day5 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const day15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const day16 = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);

    assert.equal(isWithinBookingWindow(now, past), false, "Fecha pasada debe ser rechazada (RN-11)");
    assert.equal(isWithinBookingWindow(now, day5), true, "Día 5 debe ser aceptado");
    assert.equal(isWithinBookingWindow(now, day15), true, "Día 15 exacto debe ser aceptado");
    assert.equal(isWithinBookingWindow(now, day16), false, "Día 16 debe ser rechazado (RN-01)");
  });
});

describe("TSK-FE-07: Señalización de mantenimiento de piscinas (HU-07 / RF-06 / RN-02)", () => {
  it("lunes ordinario bloquea piscina por MANTENIMIENTO_LUNES", () => {
    // 2026-10-12 es lunes ordinario si no está en festivos
    const result = isPoolMaintenanceDay("2026-10-12", []);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, "MANTENIMIENTO_LUNES");
  });

  it("lunes festivo abre piscina y traslada mantenimiento a martes posterior", () => {
    // 2026-11-02 es lunes festivo en Colombia
    const holidays = ["2026-11-02"];

    const mondayResult = isPoolMaintenanceDay("2026-11-02", holidays);
    assert.equal(mondayResult.blocked, false, "Lunes festivo debe estar abierto");

    const tuesdayResult = isPoolMaintenanceDay("2026-11-03", holidays);
    assert.equal(tuesdayResult.blocked, true, "Martes posterior debe estar bloqueado");
    assert.equal(tuesdayResult.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
  });

  it("otros días de la semana permanecen abiertos sin bloqueo", () => {
    const holidays = ["2026-11-02"];
    const wednesdayResult = isPoolMaintenanceDay("2026-11-04", holidays);
    assert.equal(wednesdayResult.blocked, false);
  });
});

describe("TSK-FE-08: Configuración de modalidad y capacidad (HU-08 / RF-07 / RN-03)", () => {
  it("valida que la capacidad sea estrictamente mayor a 0", () => {
    assert.equal(validateServiceCapacity(1).valid, true);
    assert.equal(validateServiceCapacity(25).valid, true);
    assert.equal(validateServiceCapacity(0).valid, false);
    assert.equal(validateServiceCapacity(-5).valid, false);
    assert.equal(validateServiceCapacity(2.5).valid, false);
  });
});
