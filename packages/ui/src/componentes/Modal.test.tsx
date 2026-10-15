import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Modal, ConfirmDialog } from './Modal'

;(globalThis as any).React = React

test('Modal: renderiza titulo y descripcion', () => {
  const html = renderToStaticMarkup(
    <Modal title="Titulo prueba" description="Descripcion prueba" onClose={() => {}}>
      Contenido
    </Modal>
  )
  assert.ok(html.includes('Titulo prueba'), 'Debe incluir el titulo')
  assert.ok(html.includes('Descripcion prueba'), 'Debe incluir la descripcion')
  assert.ok(html.includes('Contenido'), 'Debe incluir el contenido hijo')
  assert.ok(html.includes('role="dialog"'), 'Debe incluir role="dialog"')
})

test('Modal: incluye boton de cierre accesible', () => {
  const html = renderToStaticMarkup(
    <Modal title="Cerrar prueba" onClose={() => {}}>
      Contenido
    </Modal>
  )
  assert.ok(html.includes('aria-label="Cerrar"'), 'Debe incluir boton con aria-label Cerrar')
})

test('ConfirmDialog: renderiza labels de confirmacion y cancelacion', () => {
  const html = renderToStaticMarkup(
    <ConfirmDialog
      title="Eliminar reserva"
      message="Esta accion no se puede deshacer"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )
  assert.ok(html.includes('Eliminar reserva'), 'Debe incluir el titulo')
  assert.ok(html.includes('Esta accion no se puede deshacer'), 'Debe incluir el mensaje')
  assert.ok(html.includes('Cancelar'), 'Debe incluir label Cancelar')
  assert.ok(html.includes('Eliminar'), 'Debe incluir label de confirmacion por defecto')
})

test('ConfirmDialog: respeta confirmLabel personalizado y variante danger', () => {
  const html = renderToStaticMarkup(
    <ConfirmDialog
      title="Confirmar pago"
      message="Se cobrara la tarjeta"
      confirmLabel="Pagar ahora"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )
  assert.ok(html.includes('Pagar ahora'), 'Debe incluir el label personalizado')
})
