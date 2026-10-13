import test from "node:test";
import assert from "node:assert/strict";
import { getPaymentErrorMessage } from "../stripe-payment-form";

test("getPaymentErrorMessage - mapea insuficientes fondos de manera accionable", () => {
  const msg = getPaymentErrorMessage("card_declined", "insufficient_funds");
  assert.equal(
    msg,
    "Tu tarjeta no tiene fondos suficientes. Prueba con otra tarjeta o consulta con tu banco."
  );
});

test("getPaymentErrorMessage - mapea tarjeta vencida de manera accionable", () => {
  const msg1 = getPaymentErrorMessage("expired_card");
  assert.equal(
    msg1,
    "La tarjeta está vencida. Revisa la fecha de expiración o intenta con otra tarjeta."
  );

  const msg2 = getPaymentErrorMessage("card_declined", "expired_card");
  assert.equal(
    msg2,
    "La tarjeta está vencida. Revisa la fecha de expiración o intenta con otra tarjeta."
  );
});

test("getPaymentErrorMessage - mapea CVC inválido o erróneo", () => {
  const msg = getPaymentErrorMessage("incorrect_cvc");
  assert.equal(
    msg,
    "El código de seguridad (CVC) no coincide. Revísalo e inténtalo de nuevo."
  );
});

test("getPaymentErrorMessage - mapea número de tarjeta inválido", () => {
  const msg = getPaymentErrorMessage("invalid_number");
  assert.equal(
    msg,
    "El número de tarjeta no es válido. Verifica los dígitos e inténtalo de nuevo."
  );
});

test("getPaymentErrorMessage - mapea sospecha de fraude / tarjeta perdida", () => {
  const msg = getPaymentErrorMessage("card_declined", "fraudulent");
  assert.equal(
    msg,
    "La transacción no pudo ser autorizada por seguridad. Por favor contacta a tu banco o usa otro medio de pago."
  );
});

test("getPaymentErrorMessage - mapea rechazo bancario genérico", () => {
  const msg = getPaymentErrorMessage("card_declined", "generic_decline");
  assert.equal(
    msg,
    "El banco no autorizó el pago. Prueba con otra tarjeta o comunícate con tu entidad financiera."
  );
});

test("getPaymentErrorMessage - nunca muestra un mensaje crudo no amigable", () => {
  const msg = getPaymentErrorMessage(undefined, undefined);
  assert.equal(
    msg,
    "No se pudo completar el pago. Revisa los datos ingresados o intenta con otra tarjeta."
  );
});
