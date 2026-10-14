/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import NotFound from '../not-found';

test('NOTFOUND-UI-01: Renderiza marcador táctico 404, badge atlético y texto descriptivo', () => {
  const html = renderToStaticMarkup(<NotFound />);

  // Marcador táctico y badge deportivo
  assert.ok(
    html.includes('Saque de Fondo • Error 404'),
    'Debe contener el badge táctico de estado deportivo'
  );
  assert.ok(
    html.includes('CANCHA SIN SEÑAL • FUERA DE LOS LÍMITES'),
    'Debe incluir el subtítulo táctico en tipografía mono'
  );
  assert.ok(
    html.includes('404'),
    'Debe desplegar el número 404 prominente'
  );

  // Título principal empático
  assert.ok(
    html.includes('Esta jugada quedó fuera de la cancha'),
    'Debe contener el encabezado H1 con la metáfora deportiva'
  );

  // Párrafo descriptivo
  assert.ok(
    html.includes('complejo deportivo AKROS'),
    'Debe mencionar la identidad institucional del club'
  );
});

test('NOTFOUND-UI-02: Expone las 2 acciones principales de reanudación', () => {
  const html = renderToStaticMarkup(<NotFound />);

  // 1. Volver al Inicio
  assert.ok(
    html.includes('href="/"'),
    'Debe incluir enlace de retorno al inicio'
  );
  assert.ok(
    html.includes('VOLVER AL INICIO'),
    'Debe etiquetar claramente el botón primario de inicio'
  );

  // 2. Explorar Canchas e Instalaciones
  assert.ok(
    html.includes('href="/portal/book"'),
    'Debe incluir enlace al catálogo de reservas /portal/book'
  );
  assert.ok(
    html.includes('EXPLORAR CANCHAS E INSTALACIONES'),
    'Debe rotular el botón secundario de exploración'
  );
});

test('NOTFOUND-UI-03: Renderiza las 3 rutas rápidas de rescate con enlaces canónicos', () => {
  const html = renderToStaticMarkup(<NotFound />);

  // Título de sección de rescate
  assert.ok(
    html.includes('RUTAS DISPONIBLES EN EL CLUB'),
    'Debe titular la sección de rutas disponibles'
  );
  assert.ok(
    html.includes('3 opciones inmediatas'),
    'Debe indicar el contador de 3 opciones de rescate'
  );

  // 1. Catálogo de Reservas (/portal/book)
  assert.ok(
    html.includes('Catálogo de Reservas'),
    'Debe incluir tarjeta para Catálogo de Reservas'
  );
  assert.ok(
    html.includes('Canchas de pádel, tenis y fútbol'),
    'Debe describir las modalidades deportivas disponibles'
  );

  // 2. Pase Digital y Tickets (/portal/tickets)
  assert.ok(
    html.includes('href="/portal/tickets"'),
    'Debe enlazar a /portal/tickets'
  );
  assert.ok(
    html.includes('Pase Digital y Tickets'),
    'Debe rotular la tarjeta de pases y tickets'
  );

  // 3. Reglamentos y Normativa (/rules)
  assert.ok(
    html.includes('href="/rules"'),
    'Debe enlazar a la vista canónica oficial /rules'
  );
  assert.ok(
    html.includes('Reglamentos y Normativa'),
    'Debe rotular la tarjeta hacia los reglamentos'
  );
});

test('NOTFOUND-UI-04: Contiene canal de asistencia y concierge oficial por WhatsApp', () => {
  const html = renderToStaticMarkup(<NotFound />);

  assert.ok(
    html.includes('¿Crees que se trata de un error del sistema?'),
    'Debe ofrecer asistencia ante posibles fallos'
  );
  assert.ok(
    html.includes('href="https://wa.me/573001234567"'),
    'Debe utilizar la línea institucional de WhatsApp homologada'
  );
  assert.ok(
    html.includes('CONTACTAR A CONCIERGE DEPORTIVO'),
    'Debe incluir texto de llamada a la acción para concierge'
  );
  assert.ok(
    html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'),
    'Debe incluir atributos de seguridad para enlaces externos'
  );
});

test('NOTFOUND-UI-05: Garantiza accesibilidad semántica (aria-labelledby, sr-only, focus rings)', () => {
  const html = renderToStaticMarkup(<NotFound />);

  // Accesibilidad para lectores de pantalla
  assert.ok(
    html.includes('sr-only') && html.includes('Error 404: Página no encontrada'),
    'Debe tener texto oculto descriptivo para lectores de pantalla'
  );
  assert.ok(
    html.includes('aria-labelledby="not-found-heading"'),
    'La sección debe estar asociada a su encabezado H1'
  );
  assert.ok(
    html.includes('id="not-found-heading"'),
    'El encabezado H1 debe declarar el id de accesibilidad'
  );

  // Indicadores de foco
  assert.ok(
    html.includes('focus-visible:ring-2'),
    'Los enlaces interactivos deben tener anillos de foco visibles'
  );
});
