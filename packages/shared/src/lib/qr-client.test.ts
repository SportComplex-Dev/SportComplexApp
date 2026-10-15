import test from "node:test";
import assert from "node:assert/strict";
import { parseTicketQr } from "./qr-client";

const VALID_UUID = "9f0d6f4e-0000-4000-8000-0000000000ff";
const VALID_SIG = "a".repeat(64);

test("parseTicketQr: parsea formato estándar SC1:<uuid>:<firma>", () => {
  const payload = `SC1:${VALID_UUID}:${VALID_SIG}`;
  const result = parseTicketQr(payload);
  assert.notEqual(result, null);
  assert.equal(result?.ticketId, VALID_UUID);
  assert.equal(result?.signature, VALID_SIG);
});

test("parseTicketQr: parsea formato JSON {ticketId, signature}", () => {
  const json = JSON.stringify({ ticketId: VALID_UUID, signature: VALID_SIG });
  const result = parseTicketQr(json);
  assert.notEqual(result, null);
  assert.equal(result?.ticketId, VALID_UUID);
  assert.equal(result?.signature, VALID_SIG);
});

test("parseTicketQr: parsea formato separado por espacios o barras", () => {
  const text = `${VALID_UUID} | ${VALID_SIG}`;
  const result = parseTicketQr(text);
  assert.notEqual(result, null);
  assert.equal(result?.ticketId, VALID_UUID);
  assert.equal(result?.signature, VALID_SIG);
});

test("parseTicketQr: rechaza textos inválidos, corruptos o incompletos", () => {
  assert.equal(parseTicketQr(""), null);
  assert.equal(parseTicketQr("hola mundo"), null);
  assert.equal(parseTicketQr(`SC1:${VALID_UUID}`), null);
  assert.equal(parseTicketQr(`SC2:${VALID_UUID}:${VALID_SIG}`), null);
  assert.equal(parseTicketQr(`SC1:invalido:${VALID_SIG}`), null);
  assert.equal(parseTicketQr(`SC1:${VALID_UUID}:corta`), null);
});
