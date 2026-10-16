/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { resetPasswordSchema } from '@sportcomplex/validation'

// Configurar JSDOM
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
const { default: ResetPasswordPage, ResetPasswordContent } = await import('../page')

test.afterEach(() => {
  cleanup()
})

test('TSK-FE-33: resetPasswordSchema exige mínimo 8 caracteres y letras + números/símbolos', () => {
  // Menos de 8 caracteres
  const tooShort = resetPasswordSchema.safeParse({
    token: 'token-abc-123',
    password: 'Pass1',
    confirmPassword: 'Pass1',
  })
  assert.equal(tooShort.success, false, 'Contraseña de menos de 8 caracteres debe ser rechazada')

  // Solo letras sin números ni símbolos
  const onlyLetters = resetPasswordSchema.safeParse({
    token: 'token-abc-123',
    password: 'PasswordLargo',
    confirmPassword: 'PasswordLargo',
  })
  assert.equal(onlyLetters.success, false, 'Debe requerir al menos un número o símbolo')

  // Válida: letras y números con >= 8 caracteres
  const valid = resetPasswordSchema.safeParse({
    token: 'token-abc-123',
    password: 'Password123',
    confirmPassword: 'Password123',
  })
  assert.equal(valid.success, true, 'Contraseña con 8+ caracteres, letras y números debe ser válida')
})

test('TSK-FE-33: resetPasswordSchema detecta en tiempo real cuando las contraseñas no coinciden', () => {
  const mismatch = resetPasswordSchema.safeParse({
    token: 'token-abc-123',
    password: 'Password123',
    confirmPassword: 'Password456',
  })

  assert.equal(mismatch.success, false, 'Contraseñas distintas deben fallar la validación')
  if (!mismatch.success) {
    const errorMsg = mismatch.error.issues[0]?.message
    assert.equal(errorMsg, 'Las contraseñas no coinciden')
  }
})

test('TSK-FE-33: /reset-password muestra alerta visual y enlace a /forgot-password cuando falta el token en la URL', () => {
  // Renderizar sin token en la URL
  dom.reconfigure({ url: 'http://localhost:3000/reset-password' })
  const { getByTestId, container } = render(React.createElement(ResetPasswordPage))

  const alertContainer = getByTestId('invalid-token-alert')
  assert.ok(alertContainer, 'Debe renderizar el contenedor de alerta de token inválido')
  assert.ok(
    alertContainer.textContent?.includes('Enlace no disponible') ||
    alertContainer.textContent?.includes('ENLACE INVÁLIDO O EXPIRADO'),
    'Debe advertir que el enlace es inválido o expiró'
  )

  const forgotLink = container.querySelector('a[href="/forgot-password"]')
  assert.ok(forgotLink, 'Debe incluir un botón/enlace que redirija a /forgot-password')
})

test('TSK-FE-33: /reset-password muestra medidor de robustez y detecta contraseñas no coincidentes en tiempo real en la UI', async () => {
  // Renderizar con token presente
  const { container, findByRole } = render(
    React.createElement(ResetPasswordContent, { tokenProp: 'token-valido-123' })
  )

  const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
  const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
  assert.ok(passwordInput, 'Debe renderizar campo de nueva contraseña')
  assert.ok(confirmInput, 'Debe renderizar campo de confirmar nueva contraseña')

  // Escribir contraseña en nueva contraseña
  fireEvent.change(passwordInput, { target: { value: 'Pass1234' } })

  // Verificar que el medidor de robustez aparezca
  assert.ok(container.textContent?.includes('Seguridad:'), 'Debe mostrar el medidor de seguridad')
  assert.ok(
    container.textContent?.includes('Media') ||
    container.textContent?.includes('Fuerte'),
    'Debe indicar el nivel de robustez de la contraseña'
  )

  // Escribir contraseña distinta en confirmación
  fireEvent.change(confirmInput, { target: { value: 'PassDiferente' } })

  // Verificar mensaje de discrepancia en tiempo real
  const alert = await findByRole('alert')
  assert.ok(alert, 'Debe renderizar alert de discrepancia')
  assert.equal(alert.textContent?.trim(), 'Las contraseñas no coinciden')

  // Verificar toggle de visibilidad (Eye / EyeOff)
  const toggleButtons = container.querySelectorAll('button[aria-label*="contraseña"]')
  assert.ok(toggleButtons.length >= 2, 'Debe tener botones de toggle para ambos campos')

  // El campo inicia como tipo password
  assert.equal(passwordInput.type, 'password')

  // Al hacer clic en el primer toggle, conmuta a text
  fireEvent.click(toggleButtons[0]!)
  assert.equal(passwordInput.type, 'text', 'El campo debe conmutar a text al activar visibilidad')
})

test('TSK-FE-33: /reset-password envía el formulario con éxito y muestra confirmación de contraseña actualizada', async () => {
  let fetchCalled = false
  let payload: any = null

  const originalFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    fetchCalled = true
    payload = JSON.parse(init.body)
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }
  }

  try {
    const { container, getByRole, findAllByText } = render(
      React.createElement(ResetPasswordContent, { tokenProp: 'token-seguro-789' })
    )

    const passwordInput = container.querySelector('input[placeholder="Mínimo 8 caracteres"]') as HTMLInputElement
    const confirmInput = container.querySelector('input[placeholder="Repite la nueva contraseña"]') as HTMLInputElement
    const submitButton = getByRole('button', { name: /guardar nueva contraseña/i })

    // Escribir contraseñas coincidentes y robustas
    fireEvent.change(passwordInput, { target: { value: 'NuevaClave2026!' } })
    fireEvent.change(confirmInput, { target: { value: 'NuevaClave2026!' } })

    fireEvent.click(submitButton)

    // Confirmación visual exitosa
    const successElements = await findAllByText('Contraseña actualizada exitosamente')
    assert.ok(successElements.length >= 1, 'Debe mostrar "Contraseña actualizada exitosamente"')

    assert.equal(fetchCalled, true, 'Debe llamar al endpoint de reset')
    assert.equal(payload.token, 'token-seguro-789')
    assert.equal(payload.password, 'NuevaClave2026!')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})
