import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

// Provide global React for jsx runtime if needed in Node test runner
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

import { resolveCatalogServiceId } from '@sportcomplex/core'
import { bookingRequestSchema } from '@sportcomplex/validation'
import { obtenerRutaImagen, extraerNombreArchivo } from '@sportcomplex/seed'

// ============================================================================
// FIX EMERGENCY: Tests de Resolución de serviceId Numérico e Integridad Catálogo
// ============================================================================

test('Resolución de serviceId: bookingRequestSchema rechaza slugs y exige entero positivo', () => {
  const payloadSlug = {
    serviceId: 'tenis-cancha-1',
    startTime: '2026-11-01T10:00:00.000Z',
    endTime: '2026-11-01T11:00:00.000Z',
    cantidadCupos: 1,
  }
  const resultSlug = bookingRequestSchema.safeParse(payloadSlug)
  assert.equal(resultSlug.success, false, 'bookingRequestSchema debe rechazar slugs en serviceId')

  const resolvedId = resolveCatalogServiceId('tenis-cancha-1')
  assert.equal(typeof resolvedId, 'number')
  assert.ok(Number.isInteger(resolvedId) && resolvedId > 0)
  assert.equal(resolvedId, 17)

  const payloadValido = {
    ...payloadSlug,
    serviceId: resolvedId,
  }
  const resultValido = bookingRequestSchema.safeParse(payloadValido)
  assert.equal(resultValido.success, true, 'bookingRequestSchema debe aceptar el serviceId entero resuelto')
})

test('Resolución de serviceId: resuelve cancha-de-tenis-polvo-de-ladrillo a entero positivo canónico', () => {
  const resolved = resolveCatalogServiceId('cancha-de-tenis-polvo-de-ladrillo')
  assert.equal(resolved, 17, 'cancha-de-tenis-polvo-de-ladrillo debe mapear a la cancha central 17')

  const fromObject = resolveCatalogServiceId({
    id: 'cancha-de-tenis-polvo-de-ladrillo',
    name: 'Cancha de Tenis Polvo de Ladrillo',
  })
  assert.equal(fromObject, 17)

  const directServiceId = resolveCatalogServiceId({
    id: 'cancha-de-tenis-polvo-de-ladrillo',
    serviceId: 18,
    name: 'Cancha de tenis · Cancha 2',
  })
  assert.equal(directServiceId, 18, 'Debe priorizar serviceId numérico existente en el ítem')
})

test('Resolución de serviceId: rechaza identificadores no reconocidos antes de invocar la API', () => {
  assert.throws(
    () => resolveCatalogServiceId('servicio-inexistente-aleatorio-999'),
    /Servicio de catálogo no reconocido/,
    'Debe arrojar error antes de despachar hacia /api/bookings'
  )
})

test('Mapeo de respuestas 4xx de /api/bookings: códigos granulares y mensajes accionables', () => {
  type ApiErrorResponse = {
    success: boolean
    error: {
      code: string
      message: string
    }
  }

  const parseBookingError = (status: number, data?: ApiErrorResponse) => {
    const code =
      data?.error?.code ||
      (status === 401
        ? 'UNAUTHORIZED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 409
            ? 'CONFLICT'
            : status === 400
              ? 'VALIDATION_ERROR'
              : 'SERVER_ERROR')

    let message = data?.error?.message
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
      message = message || 'Tu sesión ha expirado o no tienes permisos para reservar. Por favor inicia sesión nuevamente.'
    } else if (code === 'VALIDATION_ERROR') {
      message = message || 'Los datos de la reserva no cumplen el formato esperado por el servidor.'
    } else if (
      code === 'TITULAR_RESERVATION_OVERLAP' ||
      code === 'CONFLICT' ||
      code === 'SLOT_BLOCKED' ||
      code === 'CAPACITY_EXCEEDED'
    ) {
      message = message || 'El horario seleccionado ya no tiene cupos disponibles o presenta solapamiento con otra reserva.'
    }
    return { code, message }
  }

  // 401 Sin sesión
  const err401 = parseBookingError(401, {
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Debes iniciar sesión.' },
  })
  assert.equal(err401.code, 'UNAUTHORIZED')
  assert.equal(err401.message, 'Debes iniciar sesión.')

  // 400 Validación
  const err400 = parseBookingError(400, {
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Datos de reserva inválidos.' },
  })
  assert.equal(err400.code, 'VALIDATION_ERROR')
  assert.equal(err400.message, 'Datos de reserva inválidos.')

  // 409 Solapamiento
  const err409 = parseBookingError(409, {
    success: false,
    error: { code: 'TITULAR_RESERVATION_OVERLAP', message: 'Ya tienes una reserva en esta franja.' },
  })
  assert.equal(err409.code, 'TITULAR_RESERVATION_OVERLAP')
  assert.equal(err409.message, 'Ya tienes una reserva en esta franja.')
})

test('Integridad de imagen: cancha-de-tenis-polvo-de-ladrillo apunta a WebP canónico existente', () => {
  const ruta = obtenerRutaImagen('cancha-de-tenis-polvo-de-ladrillo')
  const archivo = extraerNombreArchivo(ruta)
  assert.equal(archivo, 'tenis-cancha-1.webp')
})

