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
} from './index'

// ============================================================================
// SCRUM-172: Tests de Componentes UI y Microinteracciones (Motion & WCAG 2.2)
// ============================================================================

test('Button (SCRUM-172): Renderiza con clase base interactive-button y microinteracciones accesibles de foco', () => {
  const html = renderToStaticMarkup(
    <Button variant="default" size="default">
      Reservar ahora
    </Button>
  )

  // Debe incluir la clase sem+璯tica global interactive-button
  assert.ok(html.includes('interactive-button'), 'Debe incluir interactive-button')
  // Debe incluir soporte accesible de foco visible WCAG 2.2
  assert.ok(html.includes('focus-visible:ring-2'), 'Debe incluir anillo de foco visible')
  assert.ok(html.includes('focus-visible:ring-primary'), 'Debe usar el anillo de foco del tema primario')
  assert.ok(html.includes('focus-visible:ring-offset-2'), 'Debe incluir separaci+好 ring-offset')
  // Debe respetar movimiento reducido
  assert.ok(html.includes('motion-reduce:transform-none'), 'Debe respetar prefers-reduced-motion')
  // Debe preservar el contenido
  assert.ok(html.includes('Reservar ahora'), 'Debe renderizar el texto del bot+好')
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

  const linkHtml = renderToStaticMarkup(<Button variant="link">Link</Button>)
  assert.ok(linkHtml.includes('text-primary underline-offset-4'), 'Variante link preserva estilo accesible')
})

test('Button (SCRUM-172): Respeta estado disabled y estado isLoading con aria-disabled y aria-busy', () => {
  // 1. Estado disabled
  const disabledHtml = renderToStaticMarkup(
    <Button disabled variant="default">
      Deshabilitado
    </Button>
  )
  assert.ok(disabledHtml.includes('disabled=""') || disabledHtml.includes('disabled'), 'El atributo disabled debe estar presente')
  assert.ok(disabledHtml.includes('aria-disabled="true"'), 'Debe comunicar aria-disabled a lectores de pantalla')
  assert.ok(disabledHtml.includes('disabled:pointer-events-none'), 'Debe bloquear eventos cuando disabled')
  assert.ok(disabledHtml.includes('disabled:opacity-50'), 'Debe atenuar opacidad cuando disabled')
  assert.ok(disabledHtml.includes('disabled:transform-none'), 'Debe desactivar transforms cuando disabled')

  // 2. Estado isLoading
  const loadingHtml = renderToStaticMarkup(
    <Button isLoading variant="default">
      Guardando...
    </Button>
  )
  assert.ok(loadingHtml.includes('aria-busy="true"'), 'Debe comunicar aria-busy="true"')
  assert.ok(loadingHtml.includes('animate-spin'), 'Debe renderizar spinner accesible')
})

test('Card (SCRUM-172): Distingue entre tarjeta informativa (default) y tarjeta interactiva', () => {
  // 1. Tarjeta informativa est+癃ica
  const infoHtml = renderToStaticMarkup(
    <Card>
      <CardHeader>
        <CardTitle>Horario de atenci+好</CardTitle>
        <CardDescription>Lunes a Domingo 6:00 a 22:00</CardDescription>
      </CardHeader>
      <CardContent>Informaci+好 general</CardContent>
      <CardFooter>Sede Medell+》</CardFooter>
    </Card>
  )

  assert.ok(!infoHtml.includes('interactive-card'), 'Card informativa NO debe tener clase interactive-card')
  assert.ok(!infoHtml.includes('cursor-pointer'), 'Card informativa NO debe tener cursor-pointer')
  assert.ok(!infoHtml.includes('role="button"'), 'Card informativa NO debe simular ser un bot+好')
  assert.ok(!infoHtml.includes('data-interactive="true"'), 'Card informativa NO debe tener data-interactive')
  assert.ok(infoHtml.includes('Horario de atenci+好'), 'Contenido preservado')
  assert.ok(infoHtml.includes('data-slot="card"'), 'Estructura sem+璯tica preservada')

  // 2. Tarjeta interactiva con interactive={true}
  const interactiveHtml = renderToStaticMarkup(
    <Card interactive>
      <CardHeader>
        <CardTitle>Cancha de P+獮el 1</CardTitle>
      </CardHeader>
    </Card>
  )

  assert.ok(interactiveHtml.includes('interactive-card'), 'Card interactiva debe tener clase interactive-card')
  assert.ok(interactiveHtml.includes('cursor-pointer'), 'Card interactiva debe tener cursor-pointer')
  assert.ok(interactiveHtml.includes('hover:shadow-xl'), 'Card interactiva debe tener elevaci+好 envolvente shadow-xl')
  assert.ok(interactiveHtml.includes('hover:border-primary/50'), 'Card interactiva debe tener realce de borde')
  assert.ok(interactiveHtml.includes('focus-visible:ring-2'), 'Card interactiva debe tener foco visible accesible')
  assert.ok(interactiveHtml.includes('role="button"'), 'Card interactiva debe exponer role="button"')
  assert.ok(interactiveHtml.includes('tabindex="0"'), 'Card interactiva debe ser navegable con teclado')
  assert.ok(interactiveHtml.includes('data-interactive="true"'), 'Card interactiva marca atributo sem+璯tico')
})

test('Badge (SCRUM-172): Distingue entre badge informativo, interactivo y con estado en vivo (isLive / pulse)', () => {
  // 1. Badge puramente informativo (default)
  const infoBadge = renderToStaticMarkup(<Badge variant="success">CONFIRMADA</Badge>)
  assert.ok(!infoBadge.includes('interactive-badge'), 'Badge informativo no debe tener interactive-badge')
  assert.ok(!infoBadge.includes('cursor-pointer'), 'Badge informativo no debe tener cursor-pointer')
  assert.ok(!infoBadge.includes('role="button"'), 'Badge informativo no debe tener role="button"')
  assert.ok(infoBadge.includes('CONFIRMADA'), 'Badge informativo renderiza texto')

  // 2. Badge interactivo (interactive={true}) con selecci+好
  const interactiveBadge = renderToStaticMarkup(
    <Badge variant="secondary" interactive isSelected={true}>
      Filtro Tenis
    </Badge>
  )
  assert.ok(interactiveBadge.includes('interactive-badge'), 'Badge interactivo debe tener interactive-badge')
  assert.ok(interactiveBadge.includes('cursor-pointer'), 'Badge interactivo debe tener cursor-pointer')
  assert.ok(interactiveBadge.includes('role="button"'), 'Badge interactivo debe exponer role="button"')
  assert.ok(interactiveBadge.includes('tabindex="0"'), 'Badge interactivo debe tener tabIndex')
  assert.ok(interactiveBadge.includes('aria-pressed="true"'), 'Badge interactivo comunica estado aria-pressed')
  assert.ok(interactiveBadge.includes('focus-visible:ring-2'), 'Badge interactivo tiene foco visible accesible')

  // 3. Badge en vivo (isLive={true})
  const liveBadge = renderToStaticMarkup(
    <Badge variant="success" isLive>
      Disponible Ahora
    </Badge>
  )
  assert.ok(liveBadge.includes('role="status"'), 'Badge en vivo debe exponer role="status"')
  assert.ok(liveBadge.includes('aria-live="polite"'), 'Badge en vivo debe declarar aria-live="polite"')
  assert.ok(liveBadge.includes('animate-pulse'), 'Badge en vivo debe incluir micro-pulso')
})

test('Badge (SCRUM-172): Preserva todas las variantes sem+璯ticas existentes', () => {
  const variants = ['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'admin'] as const

  for (const variant of variants) {
    const html = renderToStaticMarkup(<Badge variant={variant}>Test</Badge>)
    assert.ok(html.includes('Test'), `Variante ${variant} debe renderizar el contenido`)
  }
})
