'use client'

import { useState, useEffect } from 'react'
import type { CatalogItem } from '@sportcomplex/core'

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";
const asset = (p: string) => (ASSETS_BASE ? `${ASSETS_BASE}${p}` : p);

export interface PublicCategory {
  id: number
  nombre: string
  tipo: string
  slug: string
  unit: string
}

export interface PublicCatalogData {
  catalog: CatalogItem[]
  categories: PublicCategory[]
  loading: boolean
  error: string | null
}

let cachedData: { catalog: CatalogItem[]; categories: PublicCategory[] } | null = null

export function resetPublicCatalogCache(): void {
  cachedData = null
}

export function usePublicCatalog(): PublicCatalogData {
  const [catalog, setCatalog] = useState<CatalogItem[]>(cachedData?.catalog ?? [])
  const [categories, setCategories] = useState<PublicCategory[]>(cachedData?.categories ?? [])
  const [loading, setLoading] = useState<boolean>(!cachedData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/public/catalogo')
      .then((res) => {
        if (!res.ok) throw new Error('Error al consultar el catálogo público')
        return res.json()
      })
      .then((json: {
        success?: boolean
        data?: {
          categorias?: Array<{ id: number; nombre: string; tipo: string }>
          servicios?: Array<{
            id: number
            nombre: string
            categoriaId: number
            tarifa: number | string
            capacidadMaxima: number
            estado: string
            tipoPiscina?: string | null
            description?: string
            slug?: string
          }>
        }
      }) => {
        if (!mounted) return
        if (json.success && json.data) {
          const rawCats = json.data.categorias ?? []
          const mappedCats: PublicCategory[] = rawCats.map((c) => {
            const slug = c.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            return {
              id: c.id,
              nombre: c.nombre,
              tipo: c.tipo,
              slug,
              unit: c.tipo === 'GIMNASIO' ? 'sesión' : c.tipo === 'PISCINA' ? 'entrada' : 'hora',
            }
          })

          const rawServices = json.data.servicios ?? []

          const mappedServices: CatalogItem[] = rawServices.map((s) => {
            const cat = mappedCats.find((c) => c.id === s.categoriaId)
            const catSlug = (cat?.slug ?? 'canchas') as CatalogItem['category']
            const serviceSlug = s.slug ?? s.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
            const item: CatalogItem = {
              id: serviceSlug,
              name: s.nombre,
              category: catSlug,
              sede: 'Poblado',
              description: s.description ?? (s.tipoPiscina ? `Piscina ${s.tipoPiscina.toLowerCase()}` : `Instalación deportiva oficial`),
              price: Number(s.tarifa) || 0,
              capacity: s.capacidadMaxima || 1,
              status: s.estado === 'ACTIVO' ? 'Disponible' : 'Mantenimiento',
              image: asset(`/catalogo/${serviceSlug}.webp`),
            }
            if (s.tipoPiscina) {
              item.poolType = s.tipoPiscina as 'PUBLICA' | 'PRIVADA'
            }
            return item
          })

          cachedData = { catalog: mappedServices, categories: mappedCats }
          setCatalog(mappedServices)
          setCategories(mappedCats)
        }
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Error al cargar catálogo')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { catalog, categories, loading, error }
}
