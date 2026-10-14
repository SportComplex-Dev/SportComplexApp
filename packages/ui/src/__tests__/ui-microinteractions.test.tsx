import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings are resolved via workspace consuming apps
import { renderToStaticMarkup } from 'react-dom/server'

// Provide global React for jsx runtime if needed in Node test runner
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from '../index'

// ============================================================================
// SCRUM-172: Tests de Componentes UI y Microinteracciones
// ============================================================================

test('Button (SCRUM-172): Renderiza con clase base interactive-button y microinteracciones de active/focus', () => {
  const html = renderToStaticMarkup(
    <Button variant="default" size="default">
      Reservar ahora
    </Button>
  )

  // Debe incluir la clase semántica global interactive-button
  assert.ok(html.includes('interactive-button'), 'Debe incluir interactive-button')
  // Debe incluir feedback activo de pulsación (active:scale-[0.98])
  assert.ok(html.includes('active:scale-[0.98]'), 'Debe incluir active:scale')
  // Debe incluir soporte accesible de foco visible
  assert.ok(html.includes('focus-visible:ring-2'), 'Debe incluir foco visible accesible')
  assert.ok(html.includes('focus-visible:ring-[#1d6048]'), 'Debe usar el token de foco semántico')
  // Debe respetar movimiento reducido
  assert.ok(html.includes('motion-reduce:transform-none'), 'Debe respetar prefers-reduced-motion')
  // Debe preservar el contenido
  assert.ok(html.includes('Reservar ahora'), 'Debe renderizar el texto del botón')
})

test('Button (SCRUM-172): Preserva variantes (brand, accent, secondary, destructive, link) y clases personalizadas', () => {
  const brandHtml = renderToStaticMarkup(<Button variant="brand">Brand</Button>)
  assert.ok(brandHtml.includes('bg-[#123e30]'), 'Variante brand preserva color institucional')

  const accentHtml = renderToStaticMarkup(<Button variant="accent">Accent</Button>)
  assert.ok(accentHtml.includes('bg-[#c9ef75]'), 'Variante accent preserva color de acento')

  const customHtml = renderToStaticMarkup(
    <Button variant="outline" className="my-custom-class">
      Custom
    </Button>
  )
  assert.ok(customHtml.includes('my-custom-class'), 'Preserva clases personalizadas')

  // Variante link no debe tener escalado activo que salte el texto
  const linkHtml = renderToStaticMarkup(<Button variant="link">Link</Button>)
  assert.ok(!linkHtml.includes('active:scale-[0.98]'), 'Variante link evita distorsión de escala')
})

test('Button (SCRUM-172): Respeta estado disabled sin permitir microinteracciones activas', () => {
  const html = renderToStaticMarkup(
    <Button disabled variant="default">
      Deshabilitado
    </Button>
  )
  assert.ok(html.includes('disabled'), 'El atributo disabled debe estar presente')
  assert.ok(html.includes('disabled:pointer-events-none'), 'Debe bloquear eventos cuando disabled')
  assert.ok(html.includes('disabled:opacity-50'), 'Debe atenuar opacidad cuando disabled')
  assert.ok(html.includes('disabled:transform-none'), 'Debe desactivar transforms cuando disabled')
})

test('Card (SCRUM-172): Distingue entre tarjeta informativa (default) y tarjeta interactiva', () => {
  // 1. Tarjeta informativa estática
  const infoHtml = renderToStaticMarkup(
    <Card>
      <CardHeader>
        <CardTitle>Horario de atención</CardTitle>
        <CardDescription>Lunes a Domingo 6:00 a 22:00</CardDescription>
      </CardHeader>
      <CardContent>Información general</CardContent>
      <CardFooter>Sede Medellín</CardFooter>
    </Card>
  )

  assert.ok(!infoHtml.includes('interactive-card'), 'Card informativa NO debe tener clase interactive-card')
  assert.ok(!infoHtml.includes('cursor-pointer'), 'Card informativa NO debe tener cursor-pointer')
  assert.ok(!infoHtml.includes('hover:-translate-y-0.5'), 'Card informativa NO debe tener elevación en hover')
  assert.ok(infoHtml.includes('Horario de atención'), 'Contenido preservado')

  // 2. Tarjeta interactiva con interactive={true}
  const interactiveHtml = renderToStaticMarkup(
    <Card interactive>
      <CardHeader>
        <CardTitle>Cancha de Pádel 1</CardTitle>
      </CardHeader>
    </Card>
  )

  assert.ok(interactiveHtml.includes('interactive-card'), 'Card interactiva debe tener clase interactive-card')
  assert.ok(interactiveHtml.includes('cursor-pointer'), 'Card interactiva debe tener cursor-pointer')
  assert.ok(interactiveHtml.includes('hover:-translate-y-0.5'), 'Card interactiva debe tener elevación suave en hover')
  assert.ok(interactiveHtml.includes('active:translate-y-0'), 'Card interactiva debe estabilizarse en active')
  assert.ok(interactiveHtml.includes('focus-visible:ring-2'), 'Card interactiva debe tener foco visible accesible')
  assert.ok(interactiveHtml.includes('data-interactive="true"'), 'Card interactiva marca atributo semántico')
})

test('Badge (SCRUM-172): Distingue entre badge informativo y badge interactivo sin falso hover', () => {
  // 1. Badge puramente informativo (default)
  const infoBadge = renderToStaticMarkup(<Badge variant="success">CONFIRMADA</Badge>)
  assert.ok(!infoBadge.includes('interactive-badge'), 'Badge informativo no debe tener interactive-badge')
  assert.ok(!infoBadge.includes('cursor-pointer'), 'Badge informativo no debe tener cursor-pointer')
  assert.ok(!infoBadge.includes('hover:-translate-y-0.5'), 'Badge informativo no debe elevarse en hover')
  assert.ok(!infoBadge.includes('active:scale-95'), 'Badge informativo no debe escalarse al hacer click')
  assert.ok(infoBadge.includes('CONFIRMADA'), 'Badge informativo renderiza texto')

  // 2. Badge interactivo (interactive={true})
  const interactiveBadge = renderToStaticMarkup(
    <Badge variant="secondary" interactive>
      Filtro Tenis
    </Badge>
  )
  assert.ok(interactiveBadge.includes('interactive-badge'), 'Badge interactivo debe tener interactive-badge')
  assert.ok(interactiveBadge.includes('cursor-pointer'), 'Badge interactivo debe tener cursor-pointer')
  assert.ok(interactiveBadge.includes('hover:-translate-y-0.5'), 'Badge interactivo tiene microinteracción hover')
  assert.ok(interactiveBadge.includes('active:scale-95'), 'Badge interactivo tiene respuesta táctil active')
  assert.ok(interactiveBadge.includes('focus-visible:ring-2'), 'Badge interactivo tiene foco visible accesible')
  assert.ok(interactiveBadge.includes('data-interactive="true"'), 'Badge interactivo tiene atributo semántico')
})

test('Badge (SCRUM-172): Preserva todas las variantes semánticas existentes', () => {
  const variants = ['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'admin'] as const

  for (const variant of variants) {
    const html = renderToStaticMarkup(<Badge variant={variant}>Test</Badge>)
    assert.ok(html.includes('Test'), `Variante ${variant} debe renderizar el contenido`)
  }
})
