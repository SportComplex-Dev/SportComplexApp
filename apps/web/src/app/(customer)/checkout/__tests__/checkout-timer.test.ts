import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHECKOUT_TTL_SECONDS,
  WARNING_THRESHOLD_SECONDS,
  formatCountdown,
  calculateRemainingSeconds,
  getTimerStatus,
  isPaymentBlocked,
  calculateProgressPercentage,
} from '../../../../components/booking/checkout-timer-utils'

// TSK-FE-09: Suite de Pruebas Unitarias para Checkout con Temporizador Regresivo (SCRUM-117 / HU-09 / RF-08)

test('TSK-FE-09 / HU-09: Formato visual de cuenta regresiva en formato MM:SS', () => {
  // 30 minutos estándar
  assert.equal(formatCountdown(CHECKOUT_TTL_SECONDS), '30:00')
  // 15 minutos
  assert.equal(formatCountdown(900), '15:00')
  // Casos de borde con padding
  assert.equal(formatCountdown(65), '01:05')
  assert.equal(formatCountdown(59), '00:59')
  assert.equal(formatCountdown(5), '00:05')
  assert.equal(formatCountdown(0), '00:00')
  // Manejo de valores negativos (clamp a cero)
  assert.equal(formatCountdown(-10), '00:00')
})

test('TSK-FE-09 / HU-09: Cálculo preciso de segundos restantes contra timestamp de expiración', () => {
  const now = 1700000000000 // referencia fija

  // Expira en exactamente 30 minutos (1800 segundos)
  const expiresAtFuture = now + 1800 * 1000
  assert.equal(calculateRemainingSeconds(expiresAtFuture, now), 1800)

  // Expira en 4 minutos y 30 segundos (270 segundos)
  const expiresAtWarning = now + 270 * 1000
  assert.equal(calculateRemainingSeconds(expiresAtWarning, now), 270)

  // Ya expiró hace 10 segundos
  const expiresAtPast = now - 10 * 1000
  assert.equal(calculateRemainingSeconds(expiresAtPast, now), 0)

  // Sin expiresAt provisto debe usar el default de 30 minutos (1800 s)
  assert.equal(calculateRemainingSeconds(undefined, now), CHECKOUT_TTL_SECONDS)
})

test('TSK-FE-09 / HU-09: Determinación reactiva de estados (active, warning, expired)', () => {
  // Estado normal: más de 5 minutos restantes
  assert.equal(getTimerStatus(1800), 'active')
  assert.equal(getTimerStatus(301), 'active')

  // Estado advertencia: 5 minutos o menos (urgencia)
  assert.equal(getTimerStatus(WARNING_THRESHOLD_SECONDS), 'warning')
  assert.equal(getTimerStatus(120), 'warning')
  assert.equal(getTimerStatus(1), 'warning')

  // Estado expirado: 0 o negativo
  assert.equal(getTimerStatus(0), 'expired')
  assert.equal(getTimerStatus(-5), 'expired')
})

test('TSK-FE-09 / HU-09: Bloqueo de acción de pago cuando el tiempo llega a cero', () => {
  // Tiempo vigente: acción permitida
  assert.equal(isPaymentBlocked(1800), false)
  assert.equal(isPaymentBlocked(60), false)
  assert.equal(isPaymentBlocked(1), false)

  // Tiempo expirado: acción bloqueada
  assert.equal(isPaymentBlocked(0), true)
  assert.equal(isPaymentBlocked(-1), true)

  // Fail-secure SEC-01: valores no finitos (NaN, Infinity) bloquean el pago
  assert.equal(isPaymentBlocked(Number.NaN), true)
  assert.equal(isPaymentBlocked(Infinity), true)
  assert.equal(isPaymentBlocked(-Infinity), true)
})

test('TSK-FE-09 / HU-09: Cálculo de barra de progreso proporcional', () => {
  assert.equal(calculateProgressPercentage(1800, 1800), 100)
  assert.equal(calculateProgressPercentage(900, 1800), 50)
  assert.equal(calculateProgressPercentage(450, 1800), 25)
  assert.equal(calculateProgressPercentage(0, 1800), 0)
  assert.equal(calculateProgressPercentage(-50, 1800), 0)
  assert.equal(calculateProgressPercentage(2000, 1800), 100)

  // Casos de borde no numéricos o totales inválidos
  assert.equal(calculateProgressPercentage(Number.NaN, 1800), 0)
  assert.equal(calculateProgressPercentage(900, 0), 0)
  assert.equal(calculateProgressPercentage(900, -100), 0)
  assert.equal(calculateProgressPercentage(900, Number.NaN), 0)
})

test('TSK-FE-09 / HU-09: Manejo seguro de NaN en formatCountdown y getTimerStatus', () => {
  assert.equal(formatCountdown(Number.NaN), '00:00')
  assert.equal(getTimerStatus(Number.NaN), 'expired')
})
