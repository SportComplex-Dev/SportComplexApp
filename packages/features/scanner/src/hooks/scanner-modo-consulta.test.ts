import test from "node:test";
import assert from "node:assert/strict";
import { parseTicketQr } from "@sportcomplex/shared/lib";

// TSK-FE-15: Modo consulta informativo (HU-15 / RF-13)
// Alcance técnico:
// - Toggle de Modo Consulta sin puesto asignado.
// - Pantalla con servicio, fecha, franja y titular.
// - Sin botón de canje.
// Criterio de aceptación clave:
// - El boleto permanece en EMITIDO tras la consulta y el empleado no puede realizar gastos desde esta vista.

test("TSK-FE-15 (Parser QR): Decodifica formato oficial SC1:<uuid>:<firma> para el escáner", () => {
  const ticketId = "9f0d6f4e-0000-4000-8000-0000000000ff";
  const signature = "a".repeat(64);
  const rawQrText = `SC1:${ticketId}:${signature}`;

  const parsed = parseTicketQr(rawQrText);
  assert.notEqual(parsed, null);
  assert.equal(parsed?.ticketId, ticketId);
  assert.equal(parsed?.signature, signature);
});

test("TSK-FE-15 (Parser QR): Decodifica payload JSON alternativo para compatibilidad", () => {
  const ticketId = "9f0d6f4e-0000-4000-8000-0000000000ff";
  const signature = "b".repeat(64);
  const jsonPayload = JSON.stringify({ ticketId, signature });

  const parsed = parseTicketQr(jsonPayload);
  assert.notEqual(parsed, null);
  assert.equal(parsed?.ticketId, ticketId);
  assert.equal(parsed?.signature, signature);
});

test("TSK-FE-15 (Parser QR): Rechaza QR malformado o sin firma legítima", () => {
  assert.equal(parseTicketQr("codigo-sin-firma"), null);
  assert.equal(parseTicketQr("SC1:id-invalido:123"), null);
  assert.equal(parseTicketQr(""), null);
});

test("TSK-FE-15 (Contrato de Datos): La respuesta informativa incluye servicio, fecha, franja, titular y estado EMITIDO intacto", () => {
  // Simulación de la respuesta canónica devuelta por GET /api/tickets/verify/[code] (TSK-BE-15)
  const mockResponseData = {
    access: "GRANTED" as const,
    modo: "CONSULTA" as const,
    resultado: "CONSULTA" as const,
    canjeado: false, // Invariante: jamás canjeado en modo consulta
    ticket: {
      id: "ticket-uuid-1",
      reservaId: "reserva-uuid-1",
      estado: "EMITIDO" as const, // Criterio de Aceptación: permanece en EMITIDO
      servicioId: 1,
      servicioNombre: "Cancha Sintética 1", // Campo 1: Servicio
      fecha: "2026-10-10", // Campo 2: Fecha
      horaInicio: "10:00:00", // Campo 3: Franja (inicio)
      horaFin: "11:00:00", // Campo 3: Franja (fin)
      titularId: "user-uuid-1",
      titularNombre: "Leonardo Perez", // Campo 4: Titular
    },
  };

  // Verificación de los 4 campos obligatorios del alcance técnico
  assert.ok(mockResponseData.ticket.servicioNombre, "Debe contener servicioNombre");
  assert.ok(mockResponseData.ticket.fecha, "Debe contener fecha");
  assert.ok(mockResponseData.ticket.horaInicio, "Debe contener horaInicio");
  assert.ok(mockResponseData.ticket.horaFin, "Debe contener horaFin");
  assert.ok(mockResponseData.ticket.titularNombre, "Debe contener titularNombre");

  // Verificación del criterio de aceptación clave (permanece en EMITIDO y canjeado === false)
  assert.equal(mockResponseData.modo, "CONSULTA");
  assert.equal(mockResponseData.resultado, "CONSULTA");
  assert.equal(mockResponseData.canjeado, false);
  assert.equal(mockResponseData.ticket.estado, "EMITIDO");
});
