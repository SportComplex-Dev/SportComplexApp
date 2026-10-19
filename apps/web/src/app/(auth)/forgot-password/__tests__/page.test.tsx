/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { forgotPasswordSchema } from '@sportcomplex/validation'

// Configurar entorno DOM para pruebas de componentes React
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/forgot-password',
})
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
;(globalThis as any).HTMLElement = dom.window.HTMLElement
// Node 24 already provides global navigator
;(globalThis as any).React = React
;(globalThis as any).self = dom.window
;(globalThis as any).localStorage = dom.window.localStorage
dom.window.requestIdleCallback = ((cb: any) => setTimeout(cb, 1) as unknown as number) as any
dom.window.cancelIdleCallback = ((id: any) => clearTimeout(id)) as any

// Importar después de preparar globalThis
const { render, fireEvent, cleanup } = await import('@testing-library/react')
const { default: ForgotPasswordPage } = await import('@/app/(auth)/forgot-password/page')
const { AuthForm } = await import('@/components/auth/auth-form')

test.afterEach(() => {
  cleanup()
})

test('TSK-FE-33: forgotPasswordSchema rechaza correos inválidos y acepta formatos válidos', () => {
  const invalid1 = forgotPasswordSchema.safeParse({ email: '' })
  assert.equal(invalid1.success, false, 'Correo vacío debe ser rechazado')

  const invalid2 = forgotPasswordSchema.safeParse({ email: 'no-es-correo' })
  assert.equal(invalid2.success, false, 'Formato sin arroba debe ser rechazado')

  const invalid3 = forgotPasswordSchema.safeParse({ email: 'usuario@' })
  assert.equal(invalid3.success, false, 'Correo sin dominio debe ser rechazado')

  const valid = forgotPasswordSchema.safeParse({ email: 'atleta@sportcomplex.com' })
  assert.equal(valid.success, true, 'Correo válido debe ser aceptado')
  if (valid.success) {
    assert.equal(valid.data.email, 'atleta@sportcomplex.com')
  }
})

test('TSK-FE-33: /forgot-password rechaza correos inválidos mostrando error en la UI', async () => {
  const { getByRole, findByRole } = render(React.createElement(ForgotPasswordPage))

  const emailInput = getByRole('textbox') as HTMLInputElement
  const submitButton = getByRole('button', { name: /enviar instrucciones/i })

  // Escribir correo con formato inválido
  fireEvent.change(emailInput, { target: { value: 'correo-invalido' } })
  fireEvent.click(submitButton)

  const alert = await findByRole('alert')
  assert.ok(alert, 'Debe renderizar un mensaje de alerta role="alert"')
  assert.ok(
    alert.textContent?.includes('Ingresa un correo electrónico válido') ||
    alert.textContent?.includes('correo'),
    'El mensaje debe indicar que el formato del correo es inválido'
  )
})

test('TSK-FE-33: /forgot-password muestra "Revisa tu bandeja de entrada" tras el submit exitoso', async () => {
  // Mock fetch para simular llamada POST a /api/auth/forgot-password
  let fetchCalled = false
  let requestPayload: any = null

  const originalFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    fetchCalled = true
    requestPayload = JSON.parse(init.body)
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }
  }

  try {
    const { getByRole, findByText, container } = render(React.createElement(ForgotPasswordPage))

    const emailInput = getByRole('textbox') as HTMLInputElement
    const submitButton = getByRole('button', { name: /enviar instrucciones/i })

    // Ingresar correo válido y enviar
    fireEvent.change(emailInput, { target: { value: 'socio@sportcomplex.com' } })
    fireEvent.click(submitButton)

    // Validar transición a confirmación visible
    const confirmationHeader = await findByText('Revisa tu bandeja de entrada')
    assert.ok(confirmationHeader, 'Debe mostrar el encabezado "Revisa tu bandeja de entrada"')

    assert.equal(fetchCalled, true, 'Debe realizar la llamada a la API')
    assert.equal(requestPayload.email, 'socio@sportcomplex.com', 'Debe enviar el correo en el payload')

    // Validar botón o link de retorno a /login
    const loginLink = container.querySelector('a[href="/login"]')
    assert.ok(loginLink, 'Debe existir enlace <Link href="/login"> para volver al login')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('TSK-FE-33: El enlace "¿Olvidaste tu contraseña?" en auth-form.tsx apunta a /forgot-password', () => {
  const { container, getByText } = render(React.createElement(AuthForm))

  const forgotLink = getByText('¿Olvidaste tu contraseña?')
  assert.ok(forgotLink, 'Debe renderizar el texto "¿Olvidaste tu contraseña?"')

  const anchorElement = container.querySelector('a[href="/forgot-password"]')
  assert.ok(anchorElement, 'Debe contener un elemento <Link> que apunte a "/forgot-password"')
  assert.equal(
    anchorElement.getAttribute('href'),
    '/forgot-password',
    'El href debe ser exactamente /forgot-password'
  )
})


test('TSK-FE-33: /forgot-password muestra error cuando el servidor responde HTTP 429 Too Many Requests', async () => {
  const originalFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Too many requests' }),
  })

  try {
    const { getByRole, findByRole } = render(React.createElement(ForgotPasswordPage))
    const emailInput = getByRole('textbox') as HTMLInputElement
    const submitButton = getByRole('button', { name: /enviar instrucciones/i })

    fireEvent.change(emailInput, { target: { value: 'socio@sportcomplex.com' } })
    fireEvent.click(submitButton)

    const alert = await findByRole('alert')
    assert.ok(alert.textContent?.includes('Demasiados intentos'), 'Debe advertir sobre límite de intentos')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

