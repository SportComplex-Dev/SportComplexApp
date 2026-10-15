import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarDescuentoMembresia,
  applyMembershipDiscount,
  calcularPrecioConDescuento,
  calculatePricingWithDiscount,
  calcularPrecioReserva,
  formatearDinero,
  iniciales,
  formatearFecha,
} from "../dist/precio/index.js";
import {
  bogotaDateString,
  maxBookingDateString,
  isWithinBookingWindow,
  validarVentanaReserva,
  validateBookingWindow,
  generarFranjasOperativas,
  verificarAforo,
  getBookingCalendarDays,
  checkoutExpiresAt,
  BookingWindowError,
  BOOKING_WINDOW_EXCEEDED_MESSAGE,
  BOOKING_IN_PAST_MESSAGE,
} from "../dist/disponibilidad/index.js";
import {
  decidirAcceso,
  decideAccess,
  validarAcceso,
  isWithinAccessWindow,
  getTicketAccessWindow,
  hasServiceMismatch,
  validateBotTicket,
  puertaAuth,
  ACCESS_WINDOW_EXPIRED_MESSAGE,
  ACCESS_SERVICE_MISMATCH_MESSAGE,
  ACCESS_ALREADY_USED_MESSAGE,
} from "../dist/control-acceso/index.js";
import {
  isPoolMaintenanceDay,
  esDiaMantenimientoPiscina,
  getBogotaDateParts,
  normalizeHolidaysToSet,
  checkPoolMaintenanceWithCache,
} from "../dist/politica-piscina/index.js";
import {
  bloquearReserva,
  bloquearCarrito,
  cancelarReserva,
} from "../dist/reserva/index.js";
import {
  validarMembresia,
  aplicarDescuento,
} from "../dist/membresia/index.js";
import {
  validarInscripcion,
  inscribir,
} from "../dist/torneo/index.js";

describe("@sportcomplex/application test suite", () => {
  // 1. Pricing discounts test
  describe("1. Pricing & Membership Discount", () => {
    it("RN-08: aplica 30% de descuento con membresía activa", () => {
      const result = aplicarDescuentoMembresia(10000, true);
      assert.equal(result, 7000);
      assert.equal(applyMembershipDiscount(10000, true), 7000);
    });

    it("RN-08: sin membresía activa no modifica el monto", () => {
      const result = aplicarDescuentoMembresia(10000, false);
      assert.equal(result, 10000);
    });

    it("Criterio Clave: calcularPrecioConDescuento calcula desglose exacto (30%)", () => {
      const pricing = calcularPrecioConDescuento(50000, true);
      assert.equal(pricing.subtotal, 50000);
      assert.equal(pricing.discountPct, 30);
      assert.equal(pricing.discountAmount, 15000);
      assert.equal(pricing.total, 35000);

      const pricingSinMembresia = calcularPrecioConDescuento(50000, false);
      assert.equal(pricingSinMembresia.discountPct, 0);
      assert.equal(pricingSinMembresia.total, 50000);
    });

    it("formatearDinero, iniciales y formatearFecha funcionan correctamente", () => {
      assert.equal(formatearDinero(50000), "$50.000");
      assert.equal(iniciales("Carlos Santana"), "CS");
      assert.ok(formatearFecha("2026-10-14").length > 0);
    });
  });

  // 2. Availability window test
  describe("2. Availability Window (15 days & past dates)", () => {
    const fixedNow = new Date("2026-10-14T10:00:00-05:00");

    it("valida fecha futura dentro de la ventana de 15 días", () => {
      const withinWindow = new Date("2026-10-20T10:00:00-05:00");
      assert.equal(isWithinBookingWindow(fixedNow, withinWindow), true);
      assert.doesNotThrow(() => validarVentanaReserva(withinWindow, fixedNow));
    });

    it("rechaza fechas en el pasado con mensaje contractual (RN-11)", () => {
      const past = new Date("2026-10-10T10:00:00-05:00");
      assert.equal(isWithinBookingWindow(fixedNow, past), false);
      assert.throws(
        () => validarVentanaReserva(past, fixedNow),
        (err: any) => err instanceof BookingWindowError && err.message === BOOKING_IN_PAST_MESSAGE,
      );
    });

    it("rechaza fechas que excedan los 15 días con mensaje contractual (RN-01)", () => {
      const tooFar = new Date("2026-11-05T10:00:00-05:00");
      assert.equal(isWithinBookingWindow(fixedNow, tooFar), false);
      assert.throws(
        () => validarVentanaReserva(tooFar, fixedNow),
        (err: any) => err instanceof BookingWindowError && err.message === BOOKING_WINDOW_EXCEEDED_MESSAGE,
      );
    });

    it("getBookingCalendarDays genera 20 días respetando ventana de 15 días", () => {
      const days = getBookingCalendarDays(15, 20, fixedNow);
      assert.equal(days.length, 20);
      assert.equal(days[0].isToday, true);
      assert.equal(days[15].isWithinWindow, true);
      assert.equal(days[16].isBeyondWindow, true);
    });
  });

  // 3. Pool maintenance test
  describe("3. Pool Maintenance Policy (Monday & Tuesday holiday shift)", () => {
    const holidays2026 = [
      { date: "2026-10-12", localName: "Día de la Raza", name: "Columbus Day" },
    ];

    it("Lunes ordinario (2026-10-05): cerrado por mantenimiento", () => {
      const res = isPoolMaintenanceDay("2026-10-05", holidays2026);
      assert.equal(res.blocked, true);
      assert.equal(res.reason, "MANTENIMIENTO_LUNES");
    });

    it("Lunes festivo (2026-10-12): abierto al público", () => {
      const res = isPoolMaintenanceDay("2026-10-12", holidays2026);
      assert.equal(res.blocked, false);
      assert.equal(res.reason, undefined);
    });

    it("Martes posterior a festivo (2026-10-13): cerrado por mantenimiento trasladado", () => {
      const res = isPoolMaintenanceDay("2026-10-13", holidays2026);
      assert.equal(res.blocked, true);
      assert.equal(res.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });

    it("Martes ordinario (2026-10-06): abierto sin bloqueo", () => {
      const res = isPoolMaintenanceDay("2026-10-06", holidays2026);
      assert.equal(res.blocked, false);
    });

    it("checkPoolMaintenanceWithCache resuelve con store simulado", async () => {
      const mockCache = {
        async getByYear() {
          return holidays2026;
        },
        async saveHolidays() {},
      };
      const res = await checkPoolMaintenanceWithCache("2026-10-13", { cacheStore: mockCache });
      assert.equal(res.blocked, true);
      assert.equal(res.reason, "MANTENIMIENTO_TRASLADADO_MARTES");
    });
  });

  // 4. Access Window test
  describe("4. Access Window & Control", () => {
    const startBogota = new Date("2026-10-10T15:00:00.000Z"); // 10:00:00 Bogotá (UTC-5)
    const endBogota = new Date("2026-10-10T16:00:00.000Z");   // 11:00:00 Bogotá

    it("permite acceso en hora válida dentro del rango (10:15)", () => {
      const at1015 = new Date("2026-10-10T15:15:00.000Z");
      const res = decidirAcceso({
        now: at1015,
        start: startBogota,
        end: endBogota,
        ticketStatus: "EMITIDO",
        ticketServiceId: "1",
        postServiceId: "1",
      });
      assert.deepEqual(res, { allowed: true, consume: true });
    });

    it("deniega acceso con mensaje contractual cuando la franja ya venció (11:01)", () => {
      const at1101 = new Date("2026-10-10T16:01:00.000Z");
      const res = decidirAcceso({
        now: at1101,
        start: startBogota,
        end: endBogota,
        ticketStatus: "EMITIDO",
        ticketServiceId: "1",
        postServiceId: "1",
      });
      assert.deepEqual(res, {
        allowed: false,
        code: "WINDOW_EXPIRED",
        message: ACCESS_WINDOW_EXPIRED_MESSAGE,
      });
    });

    it("deniega acceso si el servicio no coincide", () => {
      const at1015 = new Date("2026-10-10T15:15:00.000Z");
      const res = decidirAcceso({
        now: at1015,
        start: startBogota,
        end: endBogota,
        ticketStatus: "EMITIDO",
        ticketServiceId: "1",
        postServiceId: "2",
      });
      assert.deepEqual(res, {
        allowed: false,
        code: "SERVICE_MISMATCH",
        message: ACCESS_SERVICE_MISMATCH_MESSAGE,
      });
    });

    it("permite lectura sin consumo en modo consulta (postServiceId null)", () => {
      const res = decidirAcceso({
        now: startBogota,
        start: startBogota,
        end: endBogota,
        ticketStatus: "EMITIDO",
        ticketServiceId: "1",
        postServiceId: null,
      });
      assert.deepEqual(res, { allowed: true, consume: false });
    });

    it("puertaAuth verifica el estado de la cuenta y tiquete", () => {
      assert.deepEqual(puertaAuth({ accountStatus: "ACTIVO", ticketStatus: "EMITIDO" }), { allowed: true });
      assert.equal(puertaAuth({ accountStatus: "PENDIENTE" }).allowed, false);
      assert.equal(puertaAuth({ deleted: true }).allowed, false);
      assert.equal(puertaAuth({ ticketStatus: "USADO" }).allowed, false);
    });
  });

  // 5. Reserva, Membresia & Torneo Invariant validation
  describe("5. Invariants for Reserva, Membresia, Torneo", () => {
    it("bloquearReserva valida cupos y ventana", () => {
      const res = bloquearReserva({
        servicioId: 1,
        fecha: "2026-10-20",
        franjaHoraInicio: "10:00:00",
        cupos: 2,
        capacidadMaxima: 10,
        cuposOcupadosActuales: 3,
        now: new Date("2026-10-15T08:00:00-05:00"),
      });
      assert.equal(res.permitido, true);
      assert.equal(res.cuposRestantes, 5);
    });

    it("cancelarReserva rechaza estados terminales", () => {
      assert.throws(
        () => cancelarReserva({ id: "res-1", estado: "CANCELADA_ADMINISTRATIVA" }),
        /No se puede cancelar una reserva/,
      );
      const res = cancelarReserva({ id: "res-2", estado: "CONFIRMADA" });
      assert.equal(res.cancelable, true);
      assert.equal(res.nuevoEstado, "CANCELADA_ADMINISTRATIVA");
    });

    it("validarMembresia y aplicarDescuento comprueban vigencia", () => {
      const activa = {
        estado: "VIGENTE" as const,
        fechaInicio: new Date("2026-01-01"),
        fechaFin: new Date("2026-12-31"),
      };
      assert.equal(validarMembresia(activa).vigente, true);
      assert.equal(aplicarDescuento(10000, activa), 7000);

      const vencida = {
        estado: "VENCIDA" as const,
      };
      assert.equal(validarMembresia(vencida).vigente, false);
      assert.equal(aplicarDescuento(10000, vencida), 10000);
    });

    it("validarInscripcion y inscribir en torneos", () => {
      const torneo = {
        id: "t-1",
        estado: "INSCRIPCIONES_ABIERTAS" as const,
        cuposTotales: 16,
        cuposOcupados: 10,
      };
      const res = inscribir(torneo, "u-1", { confirmado: true });
      assert.equal(res.nuevoCuposOcupados, 11);
      assert.equal(res.estadoInscripcion, "CONFIRMADA");
      assert.equal(res.cuposDisponibles, 5);
    });
  });
});
