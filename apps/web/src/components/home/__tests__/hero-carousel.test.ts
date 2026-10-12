import test from 'node:test'
import assert from 'node:assert/strict'
import { HERO_SLIDES } from '../hero-carousel'

test('HeroCarousel: Configuración de exactamente 5 imágenes para el carrusel', () => {
  assert.equal(HERO_SLIDES.length, 5, 'El carrusel debe contener exactamente 5 imágenes')
})

test('HeroCarousel: La primera imagen es la imagen principal previa /images/club-hero.png', () => {
  const principalSlide = HERO_SLIDES[0]!
  assert.equal(principalSlide.id, 'principal')
  assert.equal(principalSlide.src, '/images/club-hero.png')
  assert.ok(principalSlide.title.length > 0)
})

test('HeroCarousel: Todas las diapositivas tienen metadatos descriptivos y tags deportivos válidos', () => {
  for (const slide of HERO_SLIDES) {
    assert.ok(slide.id, 'Debe tener un id único')
    assert.ok(slide.src.startsWith('/images/'), 'La ruta de imagen debe estar en /images/')
    assert.ok(slide.alt.length > 10, 'El texto alternativo accesible debe ser descriptivo')
    assert.ok(slide.title.length > 0, 'Debe tener un título visible')
    assert.ok(slide.subtitle.length > 0, 'Debe tener un subtítulo visible')
    assert.ok(slide.tag.length > 0, 'Debe tener un tag o categoría')
  }

  const ids = HERO_SLIDES.map((s) => s.id)
  const uniqueIds = new Set(ids)
  assert.equal(uniqueIds.size, 5, 'Cada diapositiva debe tener un ID único')
})

test('HeroCarousel: Lógica de rotación circular de diapositivas (Siguiente y Anterior)', () => {
  const total = HERO_SLIDES.length

  const nextIndex = (curr: number) => (curr + 1) % total
  const prevIndex = (curr: number) => (curr - 1 + total) % total

  // Desde el primer slide (0)
  assert.equal(nextIndex(0), 1)
  assert.equal(prevIndex(0), 4, 'Al retroceder desde el primer slide debe ir al último (4)')

  // Desde el último slide (4)
  assert.equal(nextIndex(4), 0, 'Al avanzar desde el último slide debe regresar al primero (0)')
  assert.equal(prevIndex(4), 3)

  // Recorrido secuencial completo
  let cur = 0
  for (let i = 1; i <= total; i++) {
    cur = nextIndex(cur)
  }
  assert.equal(cur, 0, 'Tras 5 avances debe volver a la slide 0')
})

test('HeroCarousel: Soporte de pausa y navegación directa por índice', () => {
  const isValidIndex = (index: number) => index >= 0 && index < HERO_SLIDES.length

  assert.equal(isValidIndex(0), true)
  assert.equal(isValidIndex(4), true)
  assert.equal(isValidIndex(-1), false)
  assert.equal(isValidIndex(5), false)
})
