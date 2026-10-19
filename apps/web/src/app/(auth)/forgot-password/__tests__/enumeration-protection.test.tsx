/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'

// Configuración de entorno JSDOM aislado
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/forgot-password',
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
const { default: ForgotPasswordPage } = await import('@/app/(auth)/forgot-password/page')

test.afterEach(() => {
  cleanup()
})

// ============================================================================
// TSK-QA-05 / Escenario 3: Prevención de Vulnerabilidad de Enumeración de Usuarios
// (CWE-204 / OWASP WSTG-IDNT-04)
// ============================================================================

test('TSK-QA-05 [Anti-Enumeración]: Correo existente y correo inexistente reciben exactamente la misma respuesta genérica en UI', async () => {
  const originalFetch = (globalThis as any).fetch

  // 1. Simular solicitud con correo EXISTENTE
  let existingPayload: any = null
  ;(globalThis as any).fetch = async (_url: string, init: any) => {
    existingPayload = JSON.parse(init.body)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Si el correo está registrado, se enviaron las instrucciones.',
      }),
    }
  }

  const { getByRole: getByRole1, findByTestId: findByTestId1, unmount: unmount1 } = render(
    React.createElement(ForgotPasswordPage)
  )

  const emailInput1 = getByRole1('textbox') as HTMLInputElement
  const submitBtn1 = getByRole1('button', { name: /enviar instrucciones/i })

  fireEvent.change(emailInput1, { target: { value: 'socio.registrado@sportcomplex.com' } })
  fireEvent.click(submitBtn1)

  const cardExisting = await findByTestId1('forgot-password-success')
  assert.ok(cardExisting, 'Debe mostrar la tarjeta de confirmación para correo existente')
  const titleExisting = cardExisting.querySelector('h1')?.textContent?.trim()
  const eyebrowExisting = cardExisting.querySelector('.eyebrow')?.textContent?.trim()
  const buttonExisting = cardExisting.querySelector('a[href="/login"]')?.textContent?.trim()

  assert.equal(titleExisting, 'Revisa tu bandeja de entrada')
  assert.equal(eyebrowExisting, 'CORREO ENVIADO')
  assert.equal(buttonExisting, 'Volver al login')
  assert.equal(existingPayload.email, 'socio.registrado@sportcomplex.com')

  unmount1()
  cleanup()

  // 2. Simular solicitud con correo INEXISTENTE
  let nonexistentPayload: any = null
  ;(globalThis as any).fetch = async (_url: string, init: any) => {
    nonexistentPayload = JSON.parse(init.body)
    // El backend seguro devuelve igualmente 200 OK con respuesta opaca
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Si el correo está registrado, se enviaron las instrucciones.',
      }),
    }
  }

  const { getByRole: getByRole2, findByTestId: findByTestId2, unmount: unmount2 } = render(
    React.createElement(ForgotPasswordPage)
  )

  const emailInput2 = getByRole2('textbox') as HTMLInputElement
  const submitBtn2 = getByRole2('button', { name: /enviar instrucciones/i })

  fireEvent.change(emailInput2, { target: { value: 'no.existe.en.sistema@randomdomain.xyz' } })
  fireEvent.click(submitBtn2)

  const cardNonexistent = await findByTestId2('forgot-password-success')
  assert.ok(cardNonexistent, 'Debe mostrar la tarjeta de confirmación para correo inexistente')
  const titleNonexistent = cardNonexistent.querySelector('h1')?.textContent?.trim()
  const eyebrowNonexistent = cardNonexistent.querySelector('.eyebrow')?.textContent?.trim()
  const buttonNonexistent = cardNonexistent.querySelector('a[href="/login"]')?.textContent?.trim()

  // 3. Verificación de paridad estricta (no revela existencia de usuario)
  assert.equal(
    titleExisting,
    titleNonexistent,
    'El encabezado debe ser 100% idéntico para correos existentes e inexistentes'
  )
  assert.equal(
    eyebrowExisting,
    eyebrowNonexistent,
    'El eyebrow debe ser 100% idéntico para evitar enumeración visual'
  )
  assert.equal(
    buttonExisting,
    buttonNonexistent,
    'Las acciones secundarias deben ser 100% idénticas'
  )
  assert.equal(nonexistentPayload.email, 'no.existe.en.sistema@randomdomain.xyz')

  unmount2()
  ;(globalThis as any).fetch = originalFetch
})

test('TSK-QA-05 [Anti-Enumeración]: Fallo de backend (500) o excepción de red no revela discrepancias al atacante', async () => {
  const originalFetch = (globalThis as any).fetch

  // Simular corte de red o rechazo del servidor
  ;(globalThis as any).fetch = async () => {
    throw new Error('Connection refused by server')
  }

  try {
    const { getByRole, findByTestId } = render(React.createElement(ForgotPasswordPage))

    const emailInput = getByRole('textbox') as HTMLInputElement
    const submitBtn = getByRole('button', { name: /enviar instrucciones/i })

    fireEvent.change(emailInput, { target: { value: 'victima.potencial@sportcomplex.com' } })
    fireEvent.click(submitBtn)

    // Fallback defensivo: para evitar oráculos de error en red, la UI mantiene la pantalla genérica
    const successCard = await findByTestId('forgot-password-success')
    assert.ok(successCard, 'La UI no debe revelar excepciones técnicas de infraestructura')
    assert.ok(successCard.textContent?.includes('Revisa tu bandeja de entrada'))
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('TSK-QA-05 [Anti-Enumeración]: Validación defensiva local detiene correos malformados antes de enviar requests', () => {
  let fetchWasCalled = false
  const originalFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async () => {
    fetchWasCalled = true
    return { ok: true, json: async () => ({}) }
  }

  try {
    const { getByRole, queryByTestId } = render(React.createElement(ForgotPasswordPage))

    const emailInput = getByRole('textbox') as HTMLInputElement
    const submitBtn = getByRole('button', { name: /enviar instrucciones/i })

    // Intentar inyección o formato anómalo
    fireEvent.change(emailInput, { target: { value: '<script>alert(1)</script>' } })
    fireEvent.click(submitBtn)

    assert.equal(fetchWasCalled, false, 'No debe disparar petición HTTP para entradas malformadas')
    const successCard = queryByTestId('forgot-password-success')
    assert.equal(successCard, null, 'No debe avanzar al estado de éxito')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})
