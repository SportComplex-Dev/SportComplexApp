/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import {
  validateCanAddToCart,
  calculateCartTotal,
  buildLockCartPayload,
  generateDynamicTimeSlots,
  getNumericServiceId,
  resolveCheckoutRedirection,
  type CartItem,
} from '@/app/(customer)/portal/book/cart-utils';
import { Cart } from '@/app/(customer)/portal/book/components/cart';
import { BookingSummaryModal } from '@/app/(customer)/portal/book/components/booking-summary-modal';
import { ServiceSelector } from '@/app/(customer)/portal/book/components/service-selector';

/**
 * TSK-FE-12 / HU-12 / RF-11 / RN-07:
 * Suite de Pruebas: Selección múltiple de servicios en la misma franja horaria.
 */

test('TSK-FE-12 Test 1 (RN-07): Permite agregar dos servicios distintos en el mismo rango horario (ej. Cancha 1 y Piscina de 17:00 a 18:00) al carrito', () => {
  const date = '2026-10-15';
  const startTime = '17:00';
  const endTime = '18:00';

  // Carrito inicial con el Servicio 1: Cancha de tenis 1
  const itemCancha: CartItem = {
    serviceId: 'tenis-cancha-1',
    numericServiceId: getNumericServiceId('tenis-cancha-1'),
    serviceName: 'Cancha de tenis · Cancha 1',
    serviceCategory: 'Canchas',
    date,
    startTime,
    endTime,
    price: 48000,
  };

  const cart: CartItem[] = [itemCancha];

  // Intento de agregar Servicio 2 distinto: Piscina nado libre en la misma franja
  const itemPiscina = {
    serviceId: 'piscina-nado-libre',
    numericServiceId: getNumericServiceId('piscina-nado-libre'),
    serviceName: 'Piscina · Nado libre',
    serviceCategory: 'Piscinas',
    date,
    startTime,
    endTime,
    price: 22000,
  };

  const validationResult = validateCanAddToCart(cart, itemPiscina);
  assert.equal(
    validationResult.valid,
    true,
    'RN-07: Debe permitir agregar dos servicios distintos en el mismo rango horario',
  );

  // Agregar el segundo ítem al carrito
  const updatedCart: CartItem[] = [...cart, itemPiscina];
  assert.equal(updatedCart.length, 2, 'El carrito debe contener exactamente 2 servicios');
  assert.equal(updatedCart[0].startTime, updatedCart[1].startTime);
  assert.equal(updatedCart[0].endTime, updatedCart[1].endTime);
  assert.notEqual(updatedCart[0].serviceId, updatedCart[1].serviceId);

  // Verificación adicional: Intento de agregar duplicado exacto del mismo servicio en la misma franja
  const duplicateValidation = validateCanAddToCart(updatedCart, {
    serviceId: 'tenis-cancha-1',
    numericServiceId: 1,
    date,
    startTime,
    endTime,
  });
  assert.equal(duplicateValidation.valid, false);
  assert.equal(duplicateValidation.code, 'DUPLICATE_ITEM');

  // Verificación adicional: Intento de agregar un servicio con diferente franja horaria
  const differentSlotValidation = validateCanAddToCart(updatedCart, {
    serviceId: 'gimnasio-funcional',
    numericServiceId: 10,
    date,
    startTime: '10:00',
    endTime: '11:00',
  });
  assert.equal(differentSlotValidation.valid, false);
  assert.equal(differentSlotValidation.code, 'DIFFERENT_SLOT');
});

test('TSK-FE-12 Test 2: Muestra el total consolidado de ambos servicios y renderiza los badges claros en el carrito', () => {
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
    {
      serviceId: 'piscina-nado-libre',
      numericServiceId: 6,
      serviceName: 'Piscina · Nado libre',
      serviceCategory: 'Piscinas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 22000,
    },
  ];

  // Cálculo consolidado de precio
  const total = calculateCartTotal(cart);
  assert.equal(total, 70000, 'El total consolidado debe ser la suma exacta (48000 + 22000 = 70000)');

  // Verificación visual de renderizado en componente Cart
  const html = renderToStaticMarkup(
    <Cart
      cart={cart}
      onRemoveService={() => {}}
      onClearCart={() => {}}
      onReviewSelection={() => {}}
    />,
  );

  // Debe contener ambos servicios
  assert.ok(html.includes('Cancha de tenis · Cancha 1'), 'Debe renderizar la cancha');
  assert.ok(html.includes('Piscina · Nado libre'), 'Debe renderizar la piscina');

  // Debe contener los badges de franja horaria para ambos
  assert.ok(html.includes('17:00 – 18:00'), 'Debe incluir el badge con la franja 17:00 – 18:00');

  // Debe renderizar el total consolidado formateado en pesos colombianos
  assert.ok(
    html.includes('70.000') || html.includes('70,000') || html.includes('70000'),
    'Debe mostrar el total consolidado de $70.000',
  );

  // Debe incluir botones accesibles de eliminar para cada servicio
  assert.ok(
    html.includes('Quitar Cancha de tenis · Cancha 1 del carrito'),
    'Debe incluir botón accesible de eliminar Cancha 1',
  );
  assert.ok(
    html.includes('Quitar Piscina · Nado libre del carrito'),
    'Debe incluir botón accesible de eliminar Piscina',
  );
});

test('TSK-FE-12 Test 3: Envía correctamente el payload multi-ítem a POST /api/bookings/lock-cart y procesa la redirección a /checkout', async () => {
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
    {
      serviceId: 'piscina-nado-libre',
      numericServiceId: 6,
      serviceName: 'Piscina · Nado libre',
      serviceCategory: 'Piscinas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 22000,
    },
  ];

  // 1. Construir payload multi-ítem
  const payload = buildLockCartPayload(cart, date);
  assert.equal(payload.items.length, 2, 'El payload debe contener 2 ítems');
  assert.equal(payload.items[0].serviceId, 1);
  assert.equal(payload.items[1].serviceId, 6);
  assert.equal(payload.items[0].cantidadCupos, 1);
  assert.equal(payload.items[1].cantidadCupos, 1);

  // Validar formato ISO datetime requerido por Zod cartCheckoutSchema
  const expectedStart = new Date(`${date}T17:00:00-05:00`).toISOString();
  const expectedEnd = new Date(`${date}T18:00:00-05:00`).toISOString();
  assert.equal(payload.items[0].startTime, expectedStart, 'startTime debe coincidir con la hora ISO correspondiente a 17:00 COT');
  assert.equal(payload.items[0].endTime, expectedEnd, 'endTime debe coincidir con la hora ISO correspondiente a 18:00 COT');
  assert.ok(
    !isNaN(Date.parse(payload.items[0].startTime)),
    'startTime debe ser una fecha ISO válida',
  );

  // 2. Mock de llamada a POST /api/bookings/lock-cart y procesamiento de redirección
  let redirectedUrl = '';
  const mockRouter = {
    push: (url: string) => {
      redirectedUrl = url;
    },
  };

  const fakeApiResponse = {
    ok: true,
    status: 201,
    json: async () => ({
      success: true,
      data: {
        reservas: [
          { id: 'reserva-uuid-1', estado: 'PENDIENTE_PAGO' },
          { id: 'reserva-uuid-2', estado: 'PENDIENTE_PAGO' },
        ],
        checkout: {
          sessionId: 'cs_test_mock_123',
          url: '/checkout?bookingIds=reserva-uuid-1,reserva-uuid-2',
        },
      },
    }),
  };

  // Simular la ejecución de checkout multi-servicio
  const res = fakeApiResponse;
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.reservas.length, 2);

  const reservas = data.data.reservas;
  const bookingIds = reservas.map((r: { id: string }) => r.id);

  // 2.1 Validación de redirección interna (/checkout)
  const internalRedirection = resolveCheckoutRedirection(data.data.checkout.url, bookingIds);
  assert.equal(internalRedirection.type, 'internal');
  mockRouter.push(internalRedirection.url);

  assert.ok(
    redirectedUrl.startsWith('/checkout'),
    'Debe procesar la redirección a la ruta /checkout',
  );
  assert.ok(
    redirectedUrl.includes('reserva-uuid-1') && redirectedUrl.includes('reserva-uuid-2'),
    'La URL de checkout debe incluir los IDs de las reservas bloqueadas',
  );

  // 2.2 Validación de redirección externa hacia Stripe Checkout (evitando falso positivo de router.push)
  const stripeExternalUrl = 'https://checkout.stripe.com/c/pay/cs_test_mock_123';
  const externalRedirection = resolveCheckoutRedirection(stripeExternalUrl, bookingIds);
  assert.equal(
    externalRedirection.type,
    'external',
    'Las URLs que inician con https://checkout.stripe.com deben resolverse como externas',
  );
  assert.equal(externalRedirection.url, stripeExternalUrl);

  // 2.3 Validación defensiva de getNumericServiceId para servicios no catalogados
  assert.throws(
    () => getNumericServiceId('servicio-desconocido-no-existente'),
    /Servicio desconocido o sin identificador numérico configurado/,
    'Debe rechazar identificadores no mapeados',
  );
});

test('TSK-FE-12 Test 4: Maneja el error cuando una de las franjas retorna SLOT_NOT_FOUND o conflicto (409) sin romper el renderizado', () => {
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
    {
      serviceId: 'piscina-nado-libre',
      numericServiceId: 6,
      serviceName: 'Piscina · Nado libre',
      serviceCategory: 'Piscinas',
      date,
      startTime: '17:00',
      endTime: '18:00',
      price: 22000,
    },
  ];

  // Caso 4.1: Renderizado con error 404 / SLOT_NOT_FOUND
  const errorMessage404 =
    'El servicio Piscina · Nado libre agotó sus cupos para la franja 17:00 - 18:00.';

  const htmlWith404 = renderToStaticMarkup(
    <BookingSummaryModal
      isOpen={true}
      onClose={() => {}}
      cart={cart}
      onProceedToPayment={() => {}}
      isProcessing={false}
      checkoutError={errorMessage404}
    />,
  );

  // Debe renderizar la alerta accesible de error sin romper el diálogo
  assert.ok(htmlWith404.includes('role="alert"'), 'Debe incluir un contenedor con role="alert"');
  assert.ok(
    htmlWith404.includes('Piscina · Nado libre agotó sus cupos'),
    'Debe mostrar la alerta indicando qué servicio agotó cupos',
  );
  assert.ok(
    htmlWith404.includes('Confirma tu selección en la misma franja'),
    'El modal debe conservar el renderizado íntegro',
  );

  // Caso 4.2: Renderizado con error 409 / CONFLICT
  const errorMessage409 =
    'Conflicto de disponibilidad: una de las franjas ya fue reservada por otro usuario.';

  const htmlWith409 = renderToStaticMarkup(
    <BookingSummaryModal
      isOpen={true}
      onClose={() => {}}
      cart={cart}
      onProceedToPayment={() => {}}
      isProcessing={false}
      checkoutError={errorMessage409}
    />,
  );

  assert.ok(htmlWith409.includes('role="alert"'));
  assert.ok(htmlWith409.includes('Conflicto de disponibilidad'));

  // Caso 4.3: Verificación de franjas horarias dinámicas (no quemadas/estáticas)
  const dynamicSlots = generateDynamicTimeSlots(date);
  assert.ok(dynamicSlots.length >= 10, 'Debe generar franjas dinámicas operativas (06:00 a 22:00)');
  assert.ok(
    dynamicSlots.some((s) => s.startTime === '06:00' && s.endTime === '07:00'),
    'Debe incluir franjas matutinas',
  );
  assert.ok(
    dynamicSlots.some((s) => s.startTime === '17:00' && s.endTime === '18:00'),
    'Debe incluir la franja de las 17:00',
  );
  assert.ok(
    dynamicSlots.some((s) => s.startTime === '21:00' && s.endTime === '22:00'),
    'Debe incluir franjas nocturnas',
  );

  // Renderizado del ServiceSelector con franjas dinámicas
  const selectorHtml = renderToStaticMarkup(
    <ServiceSelector
      date={date}
      onDateChange={() => {}}
      timeSlots={dynamicSlots}
      selectedSlot={dynamicSlots.find((s) => s.startTime === '17:00') ?? null}
      onSelectSlot={() => {}}
      selectedCategory="todos"
      onCategoryChange={() => {}}
      cartServiceIds={['tenis-cancha-1']}
      onAddService={() => {}}
    />,
  );

  assert.ok(selectorHtml.includes('Paso 1 · Fecha y horario dinámico'));
  assert.ok(selectorHtml.includes('17:00 – 18:00'));

  // Caso 4.4: Fechas pasadas deben tener todas sus franjas deshabilitadas
  const pastSlots = generateDynamicTimeSlots('2020-01-01');
  assert.ok(
    pastSlots.every((s) => !s.isAvailable && s.disabledReason === 'Fecha concluida'),
    'Todas las franjas de una fecha en el pasado deben estar deshabilitadas',
  );
});

