'use client'

import { useState } from 'react'
import { sedes, type CatalogItem } from '@sportcomplex/core'
import { Input } from '@sportcomplex/ui'
import { ActionButton } from '@sportcomplex/ui'
import { Modal } from '@sportcomplex/ui'
import { type CustomCategory } from '@/app/(admin)/admin/catalog/types'

export function CatalogFormModal({
  initial,
  categories,
  onSave,
  onClose,
}: {
  initial: CatalogItem
  categories: CustomCategory[]
  onSave: (item: CatalogItem) => Promise<boolean | void> | void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const set = <K extends keyof CatalogItem>(key: K, value: CatalogItem[K]) =>
    setForm({ ...form, [key]: value })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    try {
      await onSave({ ...form, name: form.name.trim(), description: form.description.trim() })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={initial.id ? 'Editar servicio / instancia' : 'Agregar servicio al catálogo'}
      description="Crea instancias independientes (ej. Cancha 1, Cancha 2) con identificador y calendario autónomo persistido en BD (RF-03, TSK-BE-04)."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label className="demo-field">
          Nombre de la instancia
          <Input
            required
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Ej. Cancha de tenis · Cancha 3 o Piscina Semi-olímpica"
          />
        </label>
        <label className="demo-field">
          Categoría
          <select
            value={form.category}
            onChange={(event) => set('category', event.target.value as CatalogItem['category'])}
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="demo-field">
          Descripción
          <Input
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Breve descripción de las características técnicas del espacio"
          />
        </label>
        <div className="form-row">
          <label className="demo-field">
            Precio base (COP)
            <Input
              required
              type="number"
              min={0}
              step={1000}
              value={form.price}
              onChange={(event) => set('price', Number(event.target.value))}
            />
          </label>
          <label className="demo-field">
            Aforo / Capacidad
            <Input
              required
              type="number"
              min={1}
              value={form.capacity}
              onChange={(event) => set('capacity', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="demo-field">
            Sede
            <select value={form.sede} onChange={(event) => set('sede', event.target.value)}>
              {sedes.map((sede) => (
                <option key={sede} value={sede}>
                  {sede}
                </option>
              ))}
            </select>
          </label>
          <label className="demo-field">
            Disponibilidad
            <select
              value={form.status}
              onChange={(event) => set('status', event.target.value as CatalogItem['status'])}
            >
              <option value="Disponible">Disponible</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <ActionButton secondary onClick={onClose} disabled={isSaving}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando en BD...' : initial.id ? 'Guardar cambios' : 'Agregar instancia'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
