import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Provide global React for jsx runtime if needed in Node test runner
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

import { PageTransition } from '../components/page-transition'
import PublicTemplate from '../app/(public)/template'
import CustomerTemplate from '../app/(customer)/template'
import AdminTemplate from '../app/(admin)/admin/template'
import AuthTemplate from '../app/(auth)/template'
import StaffTemplate from '../app/(staff)/template'

// ============================================================================
// SCRUM-173: Tests de Transiciones de Rutas, Plantillas y Movimiento Reducido
// ============================================================================

test('PageTransition (SCRUM-173): Envuelve contenido con la clase page-transition y conserva clases adicionales', () => {
  const html = renderToStaticMarkup(
    <PageTransition className="custom-view-wrap">
      <main>Contenido de la vista</main>
    </PageTransition>
  )

  assert.ok(html.includes('page-transition'), 'Debe incluir la clase semántica page-transition')
  assert.ok(html.includes('custom-view-wrap'), 'Debe concatenar clases personalizadas')
  assert.ok(html.includes('Contenido de la vista'), 'Debe renderizar los elementos hijos sin alteración')
})

test('Route Templates (SCRUM-173): PublicTemplate, CustomerTemplate, AdminTemplate, AuthTemplate y StaffTemplate usan PageTransition', () => {
  const publicHtml = renderToStaticMarkup(
    <PublicTemplate>
      <div id="landing-content">Catálogo de Servicios</div>
    </PublicTemplate>
  )
  assert.ok(publicHtml.includes('page-transition'), 'PublicTemplate aplica page-transition')
  assert.ok(publicHtml.includes('landing-content'), 'PublicTemplate preserva contenido')

  const customerHtml = renderToStaticMarkup(
    <CustomerTemplate>
      <div id="portal-content">Mis Reservas y Tiquetes</div>
    </CustomerTemplate>
  )
  assert.ok(customerHtml.includes('page-transition'), 'CustomerTemplate aplica page-transition')
  assert.ok(customerHtml.includes('portal-content'), 'CustomerTemplate preserva contenido')

  const adminHtml = renderToStaticMarkup(
    <AdminTemplate>
      <div id="admin-content">Gestión de Canchas</div>
    </AdminTemplate>
  )
  assert.ok(adminHtml.includes('page-transition'), 'AdminTemplate aplica page-transition')
  assert.ok(adminHtml.includes('admin-content'), 'AdminTemplate preserva contenido')

  const authHtml = renderToStaticMarkup(
    <AuthTemplate>
      <div id="login-content">Iniciar Sesión</div>
    </AuthTemplate>
  )
  assert.ok(authHtml.includes('page-transition'), 'AuthTemplate aplica page-transition')
  assert.ok(authHtml.includes('login-content'), 'AuthTemplate preserva contenido')

  const staffHtml = renderToStaticMarkup(
    <StaffTemplate>
      <div id="pos-content">Taquilla POS</div>
    </StaffTemplate>
  )
  assert.ok(staffHtml.includes('page-transition'), 'StaffTemplate aplica page-transition')
  assert.ok(staffHtml.includes('pos-content'), 'StaffTemplate preserva contenido')
})

test('CSS Motion Tokens (SCRUM-172 & SCRUM-173): globals.css define tokens de duración, curvas y clases globales', () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/globals.css')
  const css = fs.readFileSync(cssPath, 'utf8')

  // Duraciones
  assert.ok(css.includes('--motion-duration-fast: 150ms;'), 'Define token duración rápida (150ms)')
  assert.ok(css.includes('--motion-duration-normal: 200ms;'), 'Define token duración normal (200ms)')
  assert.ok(css.includes('--motion-duration-slow: 250ms;'), 'Define token duración extendida (250ms)')

  // Curvas de aceleración/desaceleración suaves
  assert.ok(css.includes('--motion-ease-out: cubic-bezier(0.2, 0, 0, 1);'), 'Define curva de desaceleración suave')
  assert.ok(css.includes('--motion-ease-in-out:'), 'Define curva ease-in-out')

  // Clases semánticas globales
  assert.ok(css.includes('.interactive-card'), 'Define clase .interactive-card')
  assert.ok(css.includes('.interactive-button'), 'Define clase .interactive-button')
  assert.ok(css.includes('.interactive-badge'), 'Define clase .interactive-badge')
  assert.ok(css.includes('.motion-interactive'), 'Define clase .motion-interactive')
  assert.ok(css.includes('.page-transition'), 'Define clase .page-transition')
  assert.ok(css.includes('@keyframes page-fade-in'), 'Define animación page-fade-in')
})

test('Accessibility & Reduced Motion (WCAG 2.2): globals.css desactiva transformaciones decorativas y animaciones', () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/globals.css')
  const css = fs.readFileSync(cssPath, 'utf8')

  // Regla para prefers-reduced-motion
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Debe incluir media query prefers-reduced-motion')
  assert.ok(css.includes('transform: none !important;'), 'Debe cancelar transformaciones en modo reducido')
  assert.ok(css.includes('animation: none !important;'), 'Debe cancelar animaciones en modo reducido')
  assert.ok(css.includes('transition: none !important;'), 'Debe cancelar transiciones en modo reducido')
})
