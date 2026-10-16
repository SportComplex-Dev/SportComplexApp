/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { resetPasswordSchema } from '@sportcomplex/validation'

// Configuración de entorno JSDOM aislado para pruebas WCAG
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/reset-password',
})
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
;(globalThis as any).HTMLElement = dom.window.HTMLElement
;(globalThis as any).React = React
;(globalThis as any).self = dom.window
;(globalThis as any).localStorage = dom.window.localStorage
dom.window.requestIdleCallback = ((cb: any) => setTimeout(cb, 1) as unknown as number) as any
dom.window.cancelIdleCallback = ((id: any) => clearTimeout(id)) as any

const { render, fireEvent, cleanup } = await import('@testing-library/react')
const { ResetPasswordContent } = await import('../page')

test.afterEach(() => {
  cleanup()
})

// ============================================================================
// TSK-QA-05 / Sección B: Pruebas de Accesibilidad WCAG 2.2 (Password Visibility)
// ============================================================================

test('TSK-QA-05 [WCAG 4.1.2]: Botones de visibilidad cuentan con aria-label descriptivo y semántica adecuada', () => {
  const { container } = render(
    React.createElement(ResetPasswordContent, { tokenProp: 'token-wcag-test-123' })
  )

  // 1. Botón de nueva contraseña
  const toggleButtons = container.querySelectorAll('button[type="button"]')
  const newPassToggle = Array.from(toggleButtons).find(btn =>
    btn.getAttribute('aria-label')?.includes('nueva contraseña')
  )
  assert.ok(newPassToggle, 'Debe existir el botón toggle para nueva contraseña')
  assert.equal(
    newPassToggle.getAttribute('aria-label'),
    'Mostrar nueva contraseña',
    'El aria-label inicial debe ser descriptivo ("Mostrar nueva contraseña")'
  )

  // Verificar que el SVG interno es decorativo (aria-hidden)
  const svgInside1 = newPassToggle.querySelector('svg')
  assert.ok(svgInside1, 'Debe contener un icono SVG de lucide-react')
  assert.equal(svgInside1.getAttribute('aria-hidden'), 'true', 'El icono debe tener aria-hidden="true"')

  // 2. Conmutar estado y verificar actualización del aria-label
  fireEvent.click(newPassToggle)
  assert.equal(
    newPassToggle.getAttribute('aria-label'),
    'Ocultar nueva contraseña',
    'El aria-label debe alternar a "Ocultar nueva contraseña" al mostrarse el texto'
  )

  // 3. Botón de confirmación de contraseña
  const confirmToggle = Array.from(toggleButtons).find(btn =>
    btn.getAttribute('aria-label')?.includes('confirmación de contraseña')
  )
  assert.ok(confirmToggle, 'Debe existir el botón toggle para confirmar contraseña')
  assert.equal(
    confirmToggle.getAttribute('aria-label'),
    'Mostrar confirmación de contraseña',
    'El aria-label inicial debe ser "Mostrar confirmación de contraseña"'
  )

  fireEvent.click(confirmToggle)
  assert.equal(
    confirmToggle.getAttribute('aria-label'),
    'Ocultar confirmación de contraseña',
    'El aria-label debe alternar a "Ocultar confirmación de contraseña"'
  )
})

test('TSK-QA-05 [WCAG 2.1.1]: Botón de toggle es accesible por teclado con foco y activación por Enter y Space', () => {
  const { container } = render(
    React.createElement(ResetPasswordContent, { tokenProp: 'token-wcag-test-123' })
  )

  const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
  const toggleButtons = container.querySelectorAll('button[type="button"]')
  const newPassToggle = Array.from(toggleButtons).find(btn =>
    btn.getAttribute('aria-label')?.includes('nueva contraseña')
  ) as HTMLButtonElement

  assert.ok(newPassToggle, 'El botón de toggle debe estar presente')

  // A. Verificación de foco por teclado
  newPassToggle.focus()
  assert.equal(
    (dom.window.document as Document).activeElement,
    newPassToggle,
    'El botón de alternancia debe ser capaz de recibir el foco del teclado'
  )

  // B. Activación con tecla 'Enter'
  assert.equal(passwordInput.type, 'password', 'Tipo inicial del input es password')

  fireEvent.keyDown(newPassToggle, { key: 'Enter', code: 'Enter' })
  assert.equal(passwordInput.type, 'text', 'Pulsar Enter debe conmutar el input a type="text"')

  fireEvent.keyDown(newPassToggle, { key: 'Enter', code: 'Enter' })
  assert.equal(passwordInput.type, 'password', 'Una segunda pulsación de Enter debe devolverlo a type="password"')

  // C. Activación con tecla 'Space' (Espacio)
  fireEvent.keyDown(newPassToggle, { key: ' ', code: 'Space' })
  assert.equal(passwordInput.type, 'text', 'Pulsar Space debe conmutar el input a type="text"')

  fireEvent.keyDown(newPassToggle, { key: ' ', code: 'Space' })
  assert.equal(passwordInput.type, 'password', 'Una segunda pulsación de Space debe devolverlo a type="password"')

  // D. Activación en el campo de confirmación con teclado
  const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
  const confirmToggle = Array.from(toggleButtons).find(btn =>
    btn.getAttribute('aria-label')?.includes('confirmación de contraseña')
  ) as HTMLButtonElement

  confirmToggle.focus()
  assert.equal(confirmInput.type, 'password')

  fireEvent.keyDown(confirmToggle, { key: 'Enter', code: 'Enter' })
  assert.equal(confirmInput.type, 'text', 'Enter en confirmación conmuta a text')

  fireEvent.keyDown(confirmToggle, { key: ' ', code: 'Space' })
  assert.equal(confirmInput.type, 'password', 'Space en confirmación conmuta de regreso a password')
})

test('TSK-QA-05 [WCAG 3.3.1 / 3.3.3]: Medidor de robustez Zod reactivo actualiza niveles según entropía', () => {
  const { container } = render(
    React.createElement(ResetPasswordContent, { tokenProp: 'token-wcag-test-123' })
  )

  const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement

  // 1. Contraseña vacía: no hay medidor visible
  assert.equal(container.textContent?.includes('Seguridad:'), false, 'Con entrada vacía no muestra medidor')

  // 2. Muy débil (<8 caracteres, ej. "abc")
  fireEvent.change(passwordInput, { target: { value: 'abc' } })
  assert.ok(container.textContent?.includes('Seguridad:'))
  assert.ok(container.textContent?.includes('Muy débil'))
  assert.ok(container.querySelector('.bg-red-500'), 'Debe aplicar color rojo (bg-red-500)')

  // 3. Débil (cumple 2 condiciones: >=8 caracteres y letras, pero sin números ni símbolos, ej. "abcdefgh")
  fireEvent.change(passwordInput, { target: { value: 'abcdefgh' } })
  assert.ok(container.textContent?.includes('Débil'))
  assert.ok(container.querySelector('.bg-orange-500'), 'Debe aplicar color naranja (bg-orange-500)')

  // 4. Media (3 condiciones: >=8 caracteres, letras y números, ej. "Abcdef12")
  fireEvent.change(passwordInput, { target: { value: 'Abcdef12' } })
  assert.ok(container.textContent?.includes('Media'))
  assert.ok(container.querySelector('.bg-amber-500'), 'Debe aplicar color ámbar (bg-amber-500)')

  // 5. Fuerte (4 condiciones: >=8 caracteres, letras, números y símbolos, ej. "Abcdef12!@")
  fireEvent.change(passwordInput, { target: { value: 'Abcdef12!@' } })
  assert.ok(container.textContent?.includes('Fuerte'))
  assert.ok(container.querySelector('.bg-emerald-500'), 'Debe aplicar color esmeralda (bg-emerald-500)')
})

test('TSK-QA-05 [WCAG 3.3.1]: Alerta en tiempo real "Las contraseñas no coinciden" bloquea submit y desaparece al sincronizar', async () => {
  const { container, findByRole, queryByRole } = render(
    React.createElement(ResetPasswordContent, { tokenProp: 'token-wcag-test-123' })
  )

  const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
  const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
  const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement

  // Escribir contraseña inicial
  fireEvent.change(passwordInput, { target: { value: 'MiClaveSegura2026!' } })

  // Escribir confirmación diferente
  fireEvent.change(confirmInput, { target: { value: 'MiClaveDiferente999?' } })

  // Comprobar alerta semántica accesible role="alert"
  const alert = await findByRole('alert')
  assert.ok(alert, 'Debe renderizar un mensaje de alerta accesible')
  assert.equal(alert.textContent?.trim(), 'Las contraseñas no coinciden')

  // Botón de submit debe deshabilitarse para prevenir errores
  assert.equal(submitButton.disabled, true, 'El botón de guardar debe deshabilitarse')

  // Corregir confirmación para que coincida exactamente
  fireEvent.change(confirmInput, { target: { value: 'MiClaveSegura2026!' } })

  // La alerta de error debe desaparecer del DOM
  const alertGone = queryByRole('alert')
  assert.equal(alertGone, null, 'Al coincidir las contraseñas, la alerta de discrepancia debe eliminarse')
  assert.equal(submitButton.disabled, false, 'El botón de guardar debe habilitarse nuevamente')
})

test('TSK-QA-05 [Zod Schema]: resetPasswordSchema .refine produce path exacto confirmPassword', () => {
  const result = resetPasswordSchema.safeParse({
    token: 'tok-abc',
    password: 'PasswordValida123!',
    confirmPassword: 'NoCoincide123!',
  })

  assert.equal(result.success, false)
  if (!result.success) {
    const issue = result.error.issues[0]
    assert.equal(issue?.message, 'Las contraseñas no coinciden')
    assert.deepEqual(issue?.path, ['confirmPassword'], 'El error debe asociarse al campo confirmPassword')
  }
})
