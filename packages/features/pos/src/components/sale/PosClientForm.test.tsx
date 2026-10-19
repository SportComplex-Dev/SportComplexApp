import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosClientForm } from './PosClientForm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const baseProps = {
  clientDoc: '1020304050',
  onClientDocChange: noop,
  clientName: 'Carlos Santana',
  onClientNameChange: noop,
  clientEmail: 'cliente@ejemplo.com',
  onClientEmailChange: noop,
  clientPhone: '3001234567',
  onClientPhoneChange: noop,
  isMember: false,
  onIsMemberChange: noop,
  onQuickWalkIn: noop,
}

test('PosClientForm: renders client fields with values', () => {
  const html = renderToStaticMarkup(<PosClientForm {...baseProps} />)

  assert.ok(html.includes('Datos del Cliente'), 'Debe mostrar el título de la sección')
  assert.ok(html.includes('pos-client-doc'), 'Debe incluir el campo de documento')
  assert.ok(html.includes('1020304050'), 'Debe mostrar el documento ingresado')
  assert.ok(html.includes('Carlos Santana'), 'Debe mostrar el nombre ingresado')
  assert.ok(html.includes('cliente@ejemplo.com'), 'Debe mostrar el correo ingresado')
  assert.ok(html.includes('Walk-in'), 'Debe ofrecer el acceso rápido walk-in')
})

test('PosClientForm: hides member discount notice when not a member', () => {
  const html = renderToStaticMarkup(<PosClientForm {...baseProps} />)

  assert.ok(html.includes('Socio AKROS Vigente'), 'Debe ofrecer la opción de membresía')
  assert.ok(
    !html.includes('Descuento del 30% solicitado'),
    'Sin membresía no debe mostrar el aviso de descuento',
  )
})

test('PosClientForm: shows member discount notice when isMember', () => {
  const html = renderToStaticMarkup(<PosClientForm {...baseProps} isMember={true} />)

  assert.ok(
    html.includes('Descuento del 30% solicitado'),
    'Debe confirmar la solicitud del descuento de socio',
  )
})
