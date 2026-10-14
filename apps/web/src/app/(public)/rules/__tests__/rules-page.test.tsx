/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import RulesPage from '../page';
import { InstitutionalFooter } from '@/components/home/institutional-footer';

test('RULES-UI-01: Renderiza el encabezado institucional, hero y metadatos normativos', () => {
  const html = renderToStaticMarkup(<RulesPage />);

  // Badge superior temático
  assert.ok(
    html.includes('MARCO LEGAL Y DE CONVIVENCIA • AKROS CLUB'),
    'Debe contener el badge temático institucional'
  );

  // Título principal
  assert.ok(
    html.includes('Reglamento Interno y Términos de Convivencia Deportiva'),
    'Debe incluir el título oficial del reglamento'
  );

  // Subtítulo descriptivo y sedes
  assert.ok(
    html.includes('Sede El Poblado y Sede Laureles (Medellín, Colombia)'),
    'Debe referenciar las dos sedes físicas de Medellín'
  );

  // Metadatos oficiales
  assert.ok(
    html.includes('Versión 2.0 • Octubre 2026'),
    'Debe mostrar el indicador de versión oficial 2.0'
  );
  assert.ok(
    html.includes('Descargar Normativa PDF'),
    'Debe incluir botón interactivo para descarga de PDF'
  );
  assert.ok(
    html.includes('6 Módulos Oficiales'),
    'Debe indicar los 6 módulos oficiales'
  );
});

test('RULES-UI-02: Renderiza los 6 módulos normativos con su legislación y reglas de negocio', () => {
  const html = renderToStaticMarkup(<RulesPage />);

  // Módulo 01: Acceso QR (RN-14)
  assert.ok(
    html.includes('Acceso, Identificación y Pase Digital QR'),
    'Debe incluir módulo 01'
  );
  assert.ok(html.includes('RN-14'), 'Debe incluir regla RN-14 de control de acceso');
  assert.ok(
    html.includes('Empleado_Lector'),
    'Debe mencionar validación por parte del rol Empleado_Lector'
  );

  // Módulo 02: Canchas deportivas
  assert.ok(
    html.includes('Uso de Canchas e Instalaciones (Pádel, Tenis y Fútbol)'),
    'Debe incluir módulo 02'
  );
  assert.ok(
    html.includes('suela no marcante'),
    'Debe incluir exigencia de calzado con suela no marcante'
  );
  assert.ok(
    html.includes('10 minutos'),
    'Debe incluir tiempo de gracia de 10 minutos antes de abandono'
  );

  // Módulo 03: Piscinas (Ley 1209 de 2008 & RN-02)
  assert.ok(
    html.includes('Seguridad y Normativa en Piscinas (Ley 1209 de 2008)'),
    'Debe incluir módulo 03 con Ley 1209 de 2008'
  );
  assert.ok(html.includes('RN-02'), 'Debe incluir regla RN-02 de mantenimiento');
  assert.ok(html.includes('gorro de natación') || html.includes('gorro de baño'), 'Debe exigir gorro de baño');
  assert.ok(html.includes('ducha corporal previa') || html.includes('ducha previa'), 'Debe exigir ducha previa');
  assert.ok(
    html.includes('menores de doce (12) años') || html.includes('Menores de 12 años'),
    'Debe incluir supervisión obligatoria sobre menores de 12 años'
  );

  // Módulo 04: Reservas y Cashless (RN-01, RN-08, RN-13)
  assert.ok(
    html.includes('Políticas de Reserva, Cancelación y Modelo Cashless'),
    'Debe incluir módulo 04'
  );
  assert.ok(html.includes('RN-13'), 'Debe referenciar operación cashless RN-13');
  assert.ok(html.includes('RN-01'), 'Debe referenciar bloqueo anti-colisión RN-01');
  assert.ok(html.includes('RN-08'), 'Debe referenciar descuento para socios RN-08');
  assert.ok(html.includes('12 horas'), 'Debe fijar mínimo 12 horas de antelación para cancelaciones');

  // Módulo 05: Convivencia y Código de Policía (Ley 1801 de 2016)
  assert.ok(
    html.includes('Convivencia, Seguridad y Salud (Código de Convivencia)'),
    'Debe incluir módulo 05'
  );
  assert.ok(
    html.includes('Ley 1801 de 2016'),
    'Debe referenciar Código de Convivencia Ley 1801 de 2016'
  );
  assert.ok(
    html.includes('Declaración Voluntaria de Aptitud Física'),
    'Debe incluir cláusula de declaración de aptitud física'
  );

  // Módulo 06: Protección de datos y CCTV (Ley 1581 de 2012)
  assert.ok(
    html.includes('Protección de Datos Personales y Videovigilancia'),
    'Debe incluir módulo 06'
  );
  assert.ok(
    html.includes('Ley 1581 de 2012'),
    'Debe referenciar Ley Estatutaria 1581 de 2012'
  );
  assert.ok(
    html.includes('Circuito Cerrado de Televisión (CCTV)'),
    'Debe incluir aviso de videovigilancia CCTV'
  );
});

test('RULES-UI-03: Garantiza accesibilidad en acordeones (WAI-ARIA: aria-expanded, aria-controls, role=region)', () => {
  const html = renderToStaticMarkup(<RulesPage />);

  // Módulo 1 debe iniciar expandido por defecto para accesibilidad y usabilidad
  assert.ok(
    html.includes('id="module-btn-acceso-qr"') && html.includes('aria-expanded="true"'),
    'El módulo 01 debe incluir botón con id y aria-expanded="true"'
  );
  assert.ok(
    html.includes('aria-controls="module-content-acceso-qr"'),
    'El botón debe controlar su región de contenido con aria-controls'
  );
  assert.ok(
    html.includes('id="module-content-acceso-qr"') && html.includes('role="region"'),
    'El contenido desplegable debe tener id correspondiente y role="region"'
  );

  // Módulo 2 inicia cerrado por defecto
  assert.ok(
    html.includes('id="module-btn-canchas-deportivas"') && html.includes('aria-expanded="false"'),
    'El módulo 02 debe iniciar con aria-expanded="false"'
  );

  // Anillos de foco visibles en todos los botones de acordeón
  assert.ok(
    html.includes('focus-visible:ring-2'),
    'Debe contener clases para navegación accesible por teclado y anillo de foco visible'
  );
});

test('RULES-UI-04: Contiene controles colectivos para Expandir todos y Colapsar todos', () => {
  const html = renderToStaticMarkup(<RulesPage />);

  assert.ok(html.includes('Expandir todos'), 'Debe incluir botón para expandir todos los módulos');
  assert.ok(html.includes('Colapsar todos'), 'Debe incluir botón para colapsar todos los módulos');
});

test('RULES-UI-05: Auditoría de enlaces del InstitutionalFooter hacia /rules (SCRUM-187)', () => {
  const html = renderToStaticMarkup(React.createElement(InstitutionalFooter));

  // Comprobar que los enlaces a reglamentos apunten a /rules
  assert.ok(
    html.includes('href="/rules"'),
    'El footer debe contener enlaces hacia la ruta oficial /rules'
  );
  assert.ok(
    html.includes('Reglamentos Institucionales'),
    'Debe incluir el texto Reglamentos Institucionales apuntando a /rules'
  );
  assert.ok(
    html.includes('Reglamentos y Condiciones'),
    'Debe incluir el texto Reglamentos y Condiciones apuntando a /rules'
  );

  // Comprobar ausencia de enlaces obsoletos hacia /legal en el footer
  assert.ok(
    !html.includes('href="/legal"'),
    'No deben quedar enlaces residuales apuntando a /legal en InstitutionalFooter'
  );
});

test('RULES-UI-06: Verificación de accesibilidad de teclado (Enter / Space) según estándar W3C APG para acordeones', () => {
  const html = renderToStaticMarkup(<RulesPage />);

  // Los botones de acordeón deben ser elementos <button type="button"> nativos
  // lo cual garantiza que los navegadores disparen automáticamente el evento de activación
  // tanto con la tecla Enter (código 13) como con la barra espaciadora (Space, código 32)
  // de acuerdo con la especificación WAI-ARIA Authoring Practices Guide (APG 1.2).
  assert.ok(
    html.includes('type="button"') && html.includes('id="module-btn-acceso-qr"'),
    'Los botones deben declarar type="button" para activar eventos con Enter y Space'
  );
  assert.ok(
    html.includes('cursor-pointer'),
    'Los controles deben reflejar cursor-pointer para affordance de clic interactivo'
  );
});
