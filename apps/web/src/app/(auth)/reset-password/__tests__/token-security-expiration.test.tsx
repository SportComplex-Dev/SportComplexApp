/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { isTokenExpired, TOKEN_TTL_MS } from '@sportcomplex/security'
import { resetPasswordSchema } from '@sportcomplex/validation'

// Configuración de entorno JSDOM aislado para pruebas de seguridad
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
// TSK-QA-05 / Escenario 1: Pruebas de Seguridad y Expiración de Tokens (>15 min)
// ============================================================================

test('TSK-QA-05 [Seguridad]: TOKEN_TTL_MS equivale estrictamente a 15 minutos (900.000 ms)', () => {
  const EXPECTED_15_MIN_MS = 15 * 60 * 1000
  assert.equal(TOKEN_TTL_MS, EXPECTED_15_MIN_MS, 'El TTL de seguridad debe ser exactamente de 15 minutos')
})

test('TSK-QA-05 [Seguridad]: isTokenExpired rechaza tokens cuya marca temporal exceda 15 minutos', () => {
  const baseTime = new Date('2026-10-16T10:00:00.000Z')
  const expirationTime = new Date(baseTime.getTime() + TOKEN_TTL_MS) // 10:15:00

  // 1. Token dentro de ventana válida (14 minutos transcurridos)
  const validInstance = new Date(baseTime.getTime() + 14 * 60 * 1000)
  assert.equal(
    isTokenExpired(expirationTime, validInstance),
    false,
    'Un token con menos de 15 minutos transcurridos debe considerarse vigente'
  )

  // 2. Token exactamente en el límite de expiración (15 minutos transcurridos)
  const exactExpiryInstance = new Date(baseTime.getTime() + 15 * 60 * 1000)
  assert.equal(
    isTokenExpired(expirationTime, exactExpiryInstance),
    true,
    'Al alcanzar los 15 minutos exactos, el token debe expirar'
  )

  // 3. Token vencido (>15 minutos transcurridos, ej. 15 min 1 seg y 20 min)
  const expiredInstance = new Date(baseTime.getTime() + 15 * 60 * 1000 + 1000)
  assert.equal(
    isTokenExpired(expirationTime, expiredInstance),
    true,
    'Un token con más de 15 minutos debe ser rechazado como expirado'
  )

  const veryExpiredInstance = new Date(baseTime.getTime() + 30 * 60 * 1000)
  assert.equal(
    isTokenExpired(expirationTime, veryExpiredInstance),
    true,
    'Un token de hace 30 minutos debe ser categóricamente rechazado'
  )
})

test('TSK-QA-05 [Seguridad]: Simulador de manejador backend rechaza token vencido >15 min con TOKEN_EXPIRED', () => {
  // Simular el verificador backend
  const verifyTokenHandler = (tokenData: { expiraEn: Date; utilizado: boolean }, now: Date) => {
    if (tokenData.utilizado) {
      return { ok: false, error: { code: 'TOKEN_ALREADY_USED', message: 'El enlace ya fue utilizado' } }
    }
    if (isTokenExpired(tokenData.expiraEn, now)) {
      return { ok: false, error: { code: 'TOKEN_EXPIRED', message: 'El enlace para restablecer tu contraseña ha expirado (>15 min)' } }
    }
    return { ok: true }
  }

  const creation = new Date('2026-10-16T12:00:00.000Z')
  const tokenRecord = {
    expiraEn: new Date(creation.getTime() + TOKEN_TTL_MS),
    utilizado: false,
  }

  // Consulta después de 16 minutos (excede TTL de 15 min)
  const queryTime = new Date(creation.getTime() + 16 * 60 * 1000)
  const result = verifyTokenHandler(tokenRecord, queryTime)

  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'TOKEN_EXPIRED')
  assert.ok(result.error?.message.includes('expirado'))
})

test('TSK-QA-05 [Seguridad]: /reset-password activa tarjeta de contingencia al responder la API token expirado (>15 min)', async () => {
  let endpointCalled = false
  const originalFetch = (globalThis as any).fetch

  // Mock de la API respondiendo 410 Gone / TOKEN_EXPIRED
  ;(globalThis as any).fetch = async (_url: string, _init: any) => {
    endpointCalled = true
    return {
      ok: false,
      status: 410,
      json: async () => ({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'El enlace para restablecer tu contraseña es inválido o ha expirado.',
        },
      }),
    }
  }

  try {
    const { container, getByRole, findByTestId } = render(
      React.createElement(ResetPasswordContent, { tokenProp: 'token-expirado-16min' })
    )

    const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
    const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
    const submitButton = getByRole('button', { name: /guardar nueva contraseña/i })

    // Ingresar credenciales válidas
    fireEvent.change(passwordInput, { target: { value: 'NuevaPassword2026*' } })
    fireEvent.change(confirmInput, { target: { value: 'NuevaPassword2026*' } })
    fireEvent.click(submitButton)

    // La interfaz debe recibir el rechazo del token expirado y activar la contingencia
    const contingencyCard = await findByTestId('invalid-token-alert')
    assert.ok(contingencyCard, 'Debe activar data-testid="invalid-token-alert"')
    assert.ok(
      contingencyCard.textContent?.includes('ENLACE INVÁLIDO O EXPIRADO'),
      'Debe mostrar el eyebrow "ENLACE INVÁLIDO O EXPIRADO"'
    )
    assert.ok(
      contingencyCard.textContent?.includes('Enlace no disponible'),
      'Debe mostrar el título "Enlace no disponible"'
    )

    // Redirección o enlace a /forgot-password
    const rescueLink = contingencyCard.querySelector('a[href="/forgot-password"]')
    assert.ok(rescueLink, 'Debe incluir enlace directo a /forgot-password')
    assert.equal(rescueLink.textContent?.trim(), 'Solicitar nuevo enlace')
    assert.equal(endpointCalled, true, 'El endpoint fue invocado y rechazó la clave')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

// ============================================================================
// TSK-QA-05 / Escenario 2: Tokens Alterados, Truncados o Malformados
// ============================================================================

test('TSK-QA-05 [Seguridad]: Token string vacío o espacios en blanco activa tarjeta de contingencia inmediatamente', () => {
  // Caso 1: Token como string vacío
  const { getByTestId, queryByRole, container } = render(
    React.createElement(ResetPasswordContent, { tokenProp: '' })
  )

  const alertEmpty = getByTestId('invalid-token-alert')
  assert.ok(alertEmpty, 'Debe mostrar inmediatamente la alerta de contingencia')
  assert.ok(alertEmpty.textContent?.includes('ENLACE INVÁLIDO O EXPIRADO'))

  // No debe existir ningún input para ingresar contraseñas (bloqueo total)
  const passwordInputs = container.querySelectorAll('input')
  assert.equal(passwordInputs.length, 0, 'No debe renderizar ningún input cuando el token es vacío')

  // No debe existir botón de submit
  const submitBtn = queryByRole('button', { name: /guardar nueva contraseña/i })
  assert.equal(submitBtn, null, 'No debe haber botón de envío de contraseñas')

  // Enlace a /forgot-password
  const forgotLink = alertEmpty.querySelector('a[href="/forgot-password"]')
  assert.ok(forgotLink, 'Debe ofrecer enlace de reinicio a /forgot-password')
})

test('TSK-QA-05 [Seguridad]: Token con sólo espacios en blanco ("   ") es sanitizado y rechazado de inmediato', () => {
  const { getByTestId, container } = render(
    React.createElement(ResetPasswordContent, { tokenProp: '     ' })
  )

  const alertSpaces = getByTestId('invalid-token-alert')
  assert.ok(alertSpaces, 'Debe tratar token de espacios en blanco como ausente')
  assert.ok(alertSpaces.textContent?.includes('Enlace no disponible'))

  const passwordInputs = container.querySelectorAll('input')
  assert.equal(passwordInputs.length, 0, 'Bloqueo preventivo de formulario')
})

test('TSK-QA-05 [Seguridad]: Token con firma inválida o caracteres corruptos es rechazado por la API y activa contingencia', async () => {
  let payloadReceived: any = null
  const originalFetch = (globalThis as any).fetch

  ;(globalThis as any).fetch = async (_url: string, init: any) => {
    payloadReceived = JSON.parse(init.body)
    return {
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Firma de seguridad inválida o token corrupto.',
        },
      }),
    }
  }

  try {
    const corruptToken = 'tok_corrupt_signature_$$$###_truncated'
    const { container, getByRole, findByTestId } = render(
      React.createElement(ResetPasswordContent, { tokenProp: corruptToken })
    )

    const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
    const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
    const submitButton = getByRole('button', { name: /guardar nueva contraseña/i })

    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura2026@' } })
    fireEvent.change(confirmInput, { target: { value: 'ClaveSegura2026@' } })
    fireEvent.click(submitButton)

    // Verificación de activación de contingencia
    const contingencyCard = await findByTestId('invalid-token-alert')
    assert.ok(contingencyCard, 'Debe activar tarjeta de contingencia ante firma inválida')
    assert.equal(payloadReceived.token, corruptToken, 'Envió el token alterado al backend')

    const resetLink = contingencyCard.querySelector('a[href="/forgot-password"]')
    assert.ok(resetLink, 'Provee enlace de recuperación')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('TSK-QA-05 [Seguridad]: resetPasswordSchema valida consistencia de token y rechaza datos anómalos', () => {
  // Token vacío en esquema
  const emptyTokenParsed = resetPasswordSchema.safeParse({
    token: '   ',
    password: 'PasswordValida123*',
    confirmPassword: 'PasswordValida123*',
  })
  // trim().min(1) falla cuando sólo hay espacios
  assert.equal(emptyTokenParsed.success, false, 'Token de sólo espacios debe fallar esquema Zod')

  // Faltan contraseñas
  const missingPass = resetPasswordSchema.safeParse({
    token: 'token-valido-xyz',
    password: '',
    confirmPassword: '',
  })
  assert.equal(missingPass.success, false, 'Contraseña vacía debe fallar')
})
