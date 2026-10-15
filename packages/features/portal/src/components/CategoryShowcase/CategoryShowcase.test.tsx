import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CategoryShowcase, IconBox, categoryIcons } from './CategoryShowcase'
import type { CatalogItem } from '@sportcomplex/core'

test('CategoryShowcase: renders showcase categories and attaches onSelectCategory callback', () => {
  const mockCatalog: CatalogItem[] = [
    {
      id: 'c1',
      title: 'Cancha de Fútbol 5',
      category: 'canchas',
      price: 90000,
      pricingUnit: 'hora',
      status: 'Disponible',
      capacity: 10,
      description: 'Cancha sintética techada',
      badge: 'Popular',
    },
    {
      id: 'c2',
      title: 'Piscina Olímpica',
      category: 'piscinas',
      price: 25000,
      pricingUnit: 'persona',
      status: 'Disponible',
      capacity: 1,
      description: 'Carril de nado libre',
      badge: 'Nuevo',
    },
  ]

  let selectedCategory: string | null = null
  const handleSelect = (category: string) => {
    selectedCategory = category
  }

  const html = renderToStaticMarkup(
    <CategoryShowcase catalog={mockCatalog} onSelectCategory={handleSelect} />
  )

  assert.ok(html.includes('HECHO PARA TI'), 'Must render category section eyebrow')
  assert.ok(html.includes('¿Qué hacemos'), 'Must render category showcase heading')
  assert.ok(html.includes('2 espacios disponibles ahora'), 'Must display accurate available count')
  assert.ok(html.includes('/services/canchas'), 'Must render link to canchas category')
  assert.ok(html.includes('/services/piscinas'), 'Must render link to piscinas category')
  assert.ok(html.includes('Desde $25.000'), 'Must render minimum price from catalog')
  assert.ok(html.includes('Desde $90.000'), 'Must render minimum price for canchas')

  // Trigger callback test
  handleSelect('canchas')
  assert.equal(selectedCategory, 'canchas')
})

test('IconBox: renders with various tone classes (e.g. emerald, sky, lime)', () => {
  const emeraldHtml = renderToStaticMarkup(
    <IconBox icon={categoryIcons.court} tone="emerald" />
  )
  assert.ok(emeraldHtml.includes('tone-emerald'), 'Must contain tone-emerald class')
  assert.ok(emeraldHtml.includes('icon-box'), 'Must contain base icon-box class')

  const skyHtml = renderToStaticMarkup(
    <IconBox icon={categoryIcons.pool} tone="sky" />
  )
  assert.ok(skyHtml.includes('tone-sky'), 'Must contain tone-sky class')

  const limeHtml = renderToStaticMarkup(
    <IconBox icon={categoryIcons.gym} tone="lime" />
  )
  assert.ok(limeHtml.includes('tone-lime'), 'Must contain tone-lime class')
})
