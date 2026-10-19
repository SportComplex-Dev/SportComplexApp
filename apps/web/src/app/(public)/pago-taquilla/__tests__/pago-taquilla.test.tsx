/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import PagoTaquillaPage from '@/app/(public)/pago-taquilla/page';
import { isRoleAllowedForPath } from '@/lib/auth/route-access';

async function render(estado?: string) {
  return renderToStaticMarkup(await PagoTaquillaPage({ searchParams: Promise.resolve({ estado }) }));
}

test('POS-QR: tras pagar, el cliente ve que su ticket se imprime en taquilla', async () => {
  const html = await render('ok');
  assert.ok(html.includes('Pago recibido'));
  assert.ok(html.includes('tu ticket se está imprimiendo'));
});

test('POS-QR: si cancela en Stripe, ve que no se cobró nada', async () => {
  const html = await render('cancelado');
  assert.ok(html.includes('Pago cancelado'));
  assert.ok(html.includes('No se realizó ningún cobro'));
});

test('POS-QR: la página es pública (el cliente de mostrador no tiene sesión)', () => {
  assert.equal(isRoleAllowedForPath('/pago-taquilla', null), true);
});
