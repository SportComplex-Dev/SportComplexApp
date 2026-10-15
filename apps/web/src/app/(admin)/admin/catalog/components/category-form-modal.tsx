'use client'

import { useState } from 'react'
import { Input } from '@sportcomplex/ui'
import { ActionButton } from '@sportcomplex/ui'
import { Modal } from '@sportcomplex/ui'
import { type CustomCategory, slugify } from '@/app/(admin)/admin/catalog/types'

export function CategoryFormModal({
  onSave,
  onClose,
}: {
  onSave: (cat: CustomCategory) => Promise<boolean | void> | void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('hora')
  const [tipo, setTipo] = useState<'CANCHA' | 'PISCINA' | 'GIMNASIO' | 'ZONA_HUMEDA'>('CANCHA')
  const [desc, setDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSaving) return
    const slug = slugify(name)
    setIsSaving(true)
    try {
      await onSave({ slug, name: name.trim(), unit, tipo, description: desc.trim() })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title="Crear Nueva Categoría"
      description="Define una nueva categoría para agrupar instancias de servicios deportivos (RF-03, TSK-BE-04)."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label className="demo-field">
          Nombre de la Categoría
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Squash, Crossfit, Artes Marciales"
          />
        </label>
        <label className="demo-field">
          Tipo de Disciplina / Recinto
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as NonNullable<CustomCategory['tipo']>)}
          >
            <option value="CANCHA">Canchas y Deportes de Raqueta / Balón (CANCHA)</option>
            <option value="PISCINA">Zona Acuática / Piscinas (PISCINA)</option>
            <option value="GIMNASIO">Gimnasio y Fitness (GIMNASIO)</option>
            <option value="ZONA_HUMEDA">Zona Húmeda y Recuperación (ZONA_HUMEDA)</option>
          </select>
        </label>
        <label className="demo-field">
          Unidad de cobro estándar
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="hora">Por hora (hora)</option>
            <option value="sesión">Por sesión (sesión)</option>
            <option value="entrada">Por entrada (entrada)</option>
            <option value="acceso">Por acceso (acceso)</option>
          </select>
        </label>
        <label className="demo-field">
          Descripción general
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Breve descripción del tipo de instalación o disciplina"
          />
        </label>
        <div className="form-actions">
          <ActionButton secondary onClick={onClose} disabled={isSaving}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando en BD...' : 'Crear Categoría'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
