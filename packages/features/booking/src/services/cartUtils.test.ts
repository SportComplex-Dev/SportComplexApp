import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCanAddToCart,
  calculateCartTotal,
  buildLockCartPayload,
  buildContinuousLockCartPayload,
  buildSingleLockPayload,
  generateDynamicTimeSlots,
  getNumericServiceId,
  resolveCheckoutRedirection,
  formatMoney,
  getBogotaDateAfter,
  getBogotaTodayISO,
} from './cartUtils';
import type { CartItem } from '../types/cart';

test('cartUtils - getNumericServiceId: maps known services and throws on unknown', () => {
  assert.equal(getNumericServiceId('tenis-cancha-1'), 1);
  assert.equal(getNumericServiceId('tenis-cancha-2'), 2);
  assert.equal(getNumericServiceId('padel-cancha-1'), 3);
  assert.equal(getNumericServiceId('futbol-5-cancha-1'), 4);
  assert.equal(getNumericServiceId('futbol-5-cancha-2'), 5);
  assert.equal(getNumericServiceId('piscina-nado-libre'), 6);
  assert.equal(getNumericServiceId('piscina-carril-entrenamiento'), 7);
  assert.equal(getNumericServiceId('piscina-infantil'), 8);
  assert.equal(getNumericServiceId('gimnasio-sesion-individual'), 9);
  assert.equal(getNumericServiceId('gimnasio-funcional'), 10);
  assert.equal(getNumericServiceId('zona-humeda-sauna'), 11);
  assert.equal(getNumericServiceId('zona-humeda-turco-jacuzzi'), 12);

  assert.throws(
    () => getNumericServiceId('servicio-desconocido'),
    /Servicio desconocido o sin identificador numérico configurado: servicio-desconocido/,
  );
});

test('cartUtils - formatMoney: formats currency in Colombian peso style', () => {
  const formatted = formatMoney(48000);
  assert.ok(formatted.startsWith('$'));
  assert.ok(formatted.includes('48'));
});

test('cartUtils - getBogotaTodayISO & getBogotaDateAfter: calculates Bogotá dates correctly', () => {
  const fixedNow = new Date('2026-10-15T12:00:00Z');
  const today = getBogotaTodayISO(fixedNow);
  assert.equal(today, '2026-10-15');

  const tomorrow = getBogotaDateAfter(1, fixedNow);
  assert.equal(tomorrow, '2026-10-16');

  const inFiveDays = getBogotaDateAfter(5, fixedNow);
  assert.equal(inFiveDays, '2026-10-20');
});

test('cartUtils - generateDynamicTimeSlots: generates hourly slots from 06:00 to 22:00', () => {
  const date = '2026-10-15';
  const slots = generateDynamicTimeSlots(date);
  assert.equal(slots.length, 16); // 6 to 22 is 16 slots
  assert.equal(slots[0]?.startTime, '06:00');
  assert.equal(slots[0]?.endTime, '07:00');
  assert.equal(slots[slots.length - 1]?.startTime, '21:00');
  assert.equal(slots[slots.length - 1]?.endTime, '22:00');
});

test('cartUtils - generateDynamicTimeSlots: disables past dates completely', () => {
  const pastSlots = generateDynamicTimeSlots('2020-01-01');
  assert.ok(pastSlots.every((s) => !s.isAvailable && s.disabledReason === 'Fecha concluida'));
});

test('cartUtils - validateCanAddToCart: RN-07 allows different services in the same time slot', () => {
  const date = '2026-10-15';
  const itemCancha: CartItem = {
    serviceId: 'tenis-cancha-1',
    numericServiceId: 1,
    serviceName: 'Cancha de tenis · Cancha 1',
    serviceCategory: 'Canchas',
    date,
    startTime: '17:00',
    endTime: '18:00',
    price: 48000,
  };

  const cart: CartItem[] = [itemCancha];

  const itemPiscina = {
    serviceId: 'piscina-nado-libre',
    numericServiceId: 6,
    date,
    startTime: '17:00',
    endTime: '18:00',
  };

  const result = validateCanAddToCart(cart, itemPiscina);
  assert.equal(result.valid, true);
});

test('cartUtils - validateCanAddToCart: rejects duplicates by string id or numeric id', () => {
  const date = '2026-10-15';
  const itemCancha: CartItem = {
    serviceId: 'tenis-cancha-1',
    numericServiceId: 1,
    serviceName: 'Cancha de tenis · Cancha 1',
    serviceCategory: 'Canchas',
    date,
    startTime: '17:00',
    endTime: '18:00',
    price: 48000,
  };

  const cart: CartItem[] = [itemCancha];

  const duplicateByString = validateCanAddToCart(cart, {
    serviceId: 'tenis-cancha-1',
    numericServiceId: 99,
    date,
    startTime: '17:00',
    endTime: '18:00',
  });
  assert.equal(duplicateByString.valid, false);
  assert.equal(duplicateByString.code, 'DUPLICATE_ITEM');

  const duplicateByNumeric = validateCanAddToCart(cart, {
    serviceId: 'otro-id',
    numericServiceId: 1,
    date,
    startTime: '17:00',
    endTime: '18:00',
  });
  assert.equal(duplicateByNumeric.valid, false);
  assert.equal(duplicateByNumeric.code, 'DUPLICATE_ITEM');
});

test('cartUtils - validateCanAddToCart: rejects items in different dates or time slots', () => {
  const date = '2026-10-15';
  const cart: CartItem[] = [
    {
      serviceId: 'tenis-cancha-1',
      numericServiceId: 1,
      serviceName: 'Cancha de tenis · Cancha 1',
      serviceCategory: 'Canchas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 48000,
    },
  ];

  const differentSlot = validateCanAddToCart(cart, {
    serviceId: 'gimnasio-funcional',
    numericServiceId: 10,
    date,
    startTime: '10:00',
    endTime: '11:00',
  });
  assert.equal(differentSlot.valid, false);
  assert.equal(differentSlot.code, 'DIFFERENT_SLOT');

  const differentDate = validateCanAddToCart(cart, {
    serviceId: 'gimnasio-funcional',
    numericServiceId: 10,
    date: '2026-10-16',
    startTime: '17:00',
    endTime: '18:00',
  });
  assert.equal(differentDate.valid, false);
  assert.equal(differentDate.code, 'DIFFERENT_SLOT');
});

test('cartUtils - calculateCartTotal: correctly sums prices of items in cart', () => {
  const cart: CartItem[] = [
    {
      serviceId: 'tenis-cancha-1',
      numericServiceId: 1,
      serviceName: 'Cancha de tenis 1',
      serviceCategory: 'Canchas',
      date: '2026-10-15',
      startTime: '17:00',
      endTime: '18:00',
      price: 48000,
    },
    {
      serviceId: 'piscina-nado-libre',
      numericServiceId: 6,
      serviceName: 'Piscina Libre',
      serviceCategory: 'Piscinas',
      date: '2026-10-15',
      startTime: '17:00',
      endTime: '18:00',
      price: 22000,
    },
  ];

  assert.equal(calculateCartTotal(cart), 70000);
  assert.equal(calculateCartTotal([]), 0);
});

test('cartUtils - buildLockCartPayload: formats payload with valid ISO strings', () => {
  const date = '2026-10-15';
  const cart: CartItem[] = [
    {
      serviceId: 'tenis-cancha-1',
      numericServiceId: 1,
      serviceName: 'Cancha de tenis 1',
      serviceCategory: 'Canchas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 48000,
    },
    {
      serviceId: 'piscina-nado-libre',
      numericServiceId: 6,
      serviceName: 'Piscina Libre',
      serviceCategory: 'Piscinas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 22000,
    },
  ];

  const payload = buildLockCartPayload(cart, date);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0]?.serviceId, 1);
  assert.equal(payload.items[1]?.serviceId, 6);
  assert.equal(payload.items[0]?.cantidadCupos, 1);
  assert.equal(payload.items[1]?.cantidadCupos, 1);

  const expectedStart = new Date(`${date}T17:00:00-05:00`).toISOString();
  const expectedEnd = new Date(`${date}T18:00:00-05:00`).toISOString();
  assert.equal(payload.items[0]?.startTime, expectedStart);
  assert.equal(payload.items[0]?.endTime, expectedEnd);
});

test('buildContinuousLockCartPayload serializes every contiguous slot in Bogota time', () => {
  const date = '2026-10-15';
  const payload = buildContinuousLockCartPayload(1, [
    { startTime: '15:00', endTime: '16:00', label: '15:00 – 16:00', isAvailable: true },
    { startTime: '14:00', endTime: '15:00', label: '14:00 – 15:00', isAvailable: true },
  ], date);

  assert.deepEqual(payload, {
    serviceId: 1,
    franjas: [
      { inicio: new Date(`${date}T14:00:00-05:00`).toISOString(), fin: new Date(`${date}T15:00:00-05:00`).toISOString() },
      { inicio: new Date(`${date}T15:00:00-05:00`).toISOString(), fin: new Date(`${date}T16:00:00-05:00`).toISOString() },
    ],
  });
});

test('cartUtils - buildSingleLockPayload: constructs single lock payload correctly', () => {
  const date = '2026-10-15';
  const item: CartItem = {
    serviceId: 'tenis-cancha-1',
    numericServiceId: 1,
    serviceName: 'Cancha de tenis 1',
    serviceCategory: 'Canchas',
    date,
    startTime: '17:00',
    endTime: '18:00',
    price: 48000,
  };

  const payload = buildSingleLockPayload(item, date);
  assert.equal(payload.serviceId, 1);
  assert.equal(payload.date, date);
  assert.equal(payload.cantidadCupos, 1);
  assert.equal(payload.startTime, new Date(`${date}T17:00:00-05:00`).toISOString());
  assert.equal(payload.endTime, new Date(`${date}T18:00:00-05:00`).toISOString());
});

test('cartUtils - resolveCheckoutRedirection: handles internal and external URLs', () => {
  const internal = resolveCheckoutRedirection('/checkout?bookingIds=1,2', ['1', '2']);
  assert.equal(internal.type, 'internal');
  assert.equal(internal.url, '/checkout?bookingIds=1,2');

  const external = resolveCheckoutRedirection('https://checkout.stripe.com/c/pay/cs_123', ['1', '2']);
  assert.equal(external.type, 'external');
  assert.equal(external.url, 'https://checkout.stripe.com/c/pay/cs_123');

  const defaultInternal = resolveCheckoutRedirection(null, ['uuid-1', 'uuid-2']);
  assert.equal(defaultInternal.type, 'internal');
  assert.equal(defaultInternal.url, '/checkout?bookingIds=uuid-1,uuid-2&bookingId=uuid-1');

  const emptyDefault = resolveCheckoutRedirection(null, []);
  assert.equal(emptyDefault.type, 'internal');
  assert.equal(emptyDefault.url, '/checkout');
});
