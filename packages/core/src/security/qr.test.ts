import test from "node:test";
import assert from "node:assert/strict";
import {
  TICKET_QR_PREFIX,
  buildTicketQrPayload,
  newTicketId,
  parseTicketQrPayload,
  signTicket,
  verifyTicketSignature,
} from "./qr";

const SECRET = "secreto-qr-tsk-be-19";

test("TSK-BE-19: el payload del QR lleva ID + firma y vuelve a separarse sin pérdida", () => {
  const ticketId = newTicketId();
  const firma = signTicket(ticketId, SECRET);
  const payload = buildTicketQrPayload(ticketId, firma);

  assert.equal(payload.startsWith(`${TICKET_QR_PREFIX}:`), true);
  assert.deepEqual(parseTicketQrPayload(payload), { ticketId, signature: firma });
  // El par reconstruido sigue validando la firma (RF-13 / ARCHITECTURE §8.2).
  assert.equal(verifyTicketSignature(ticketId, firma, SECRET), true);
});

test("TSK-BE-19: payload manipulado o con prefijo ajeno se rechaza (null)", () => {
  const ticketId = newTicketId();
  const payload = buildTicketQrPayload(ticketId, signTicket(ticketId, SECRET));

  // Una firma con el formato correcto pero incorrecta SÍ se separa: el
  // descarte criptográfico es de `verifyTicketSignature`, no del parser.
  const firmaAdulterada = "0".repeat(64);
  const separado = parseTicketQrPayload(`${TICKET_QR_PREFIX}:${ticketId}:${firmaAdulterada}`);
  assert.deepEqual(separado, { ticketId, signature: firmaAdulterada });
  assert.equal(verifyTicketSignature(ticketId, firmaAdulterada, SECRET), false);

  assert.equal(parseTicketQrPayload(payload.slice(0, -3)), null); // firma truncada
  assert.equal(parseTicketQrPayload(payload.replace("SC1", "SC2")), null); // prefijo ajeno
  assert.equal(parseTicketQrPayload(""), null);
  assert.equal(parseTicketQrPayload(`${ticketId}:${"0".repeat(64)}`), null);
});

test("TSK-BE-19: buildTicketQrPayload valida los componentes", () => {
  assert.throws(() => buildTicketQrPayload("no-uuid", "a".repeat(64)));
  assert.throws(() => buildTicketQrPayload(newTicketId(), "firma-corta"));
});