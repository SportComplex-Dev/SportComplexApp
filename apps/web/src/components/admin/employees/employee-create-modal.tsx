'use client'

import React from 'react'
import { Check, Loader2, UserPlus, X } from 'lucide-react'
import { Input } from '@sportcomplex/ui'
import { ActionButton } from '@sportcomplex/ui'

export interface CreateEmployeeFormData {
  nombre: string
  correo: string
  rolNombre: string
  password: string
}

interface EmployeeCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  form: CreateEmployeeFormData
  setForm: React.Dispatch<React.SetStateAction<CreateEmployeeFormData>>
  isCreating: boolean
}

export function EmployeeCreateModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  isCreating,
}: EmployeeCreateModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)] cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#557b53]/10 text-[#557b53] dark:text-[#9ee285] flex items-center justify-center">
            <UserPlus size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[var(--ink)]">Alta de Empleado</h3>
            <p className="text-xs text-[var(--subtle)]">Asignación de rol y credenciales operativas</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">Nombre Completo</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej. Carlos Restrepo"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">Correo Electrónico Institucional</label>
            <Input
              type="email"
              value={form.correo}
              onChange={(e) => setForm((prev) => ({ ...prev, correo: e.target.value }))}
              placeholder="ejemplo@sportcomplex.co"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">Rol Operativo</label>
            <select
              value={form.rolNombre}
              onChange={(e) => setForm((prev) => ({ ...prev, rolNombre: e.target.value }))}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              <option value="VENDEDOR">Vendedor (Acceso a Taquilla & Cobro POS)</option>
              <option value="LECTOR">Lector (Acceso exclusivo a Escáner Torniquete)</option>
              <option value="ADMIN">Administrador (Control total del club)</option>
            </select>
            <span className="text-[11px] text-[var(--subtle)] block mt-1">
              Los permisos se aplicarán perimetralmente en el middleware de Next.js.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">Contraseña Temporal</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
            <span className="text-[10.5px] text-[var(--subtle)] block mt-1">
              Se almacenará mediante hash criptográfico Argon2id. Nunca en texto plano.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--subtle)] hover:bg-[var(--surface-soft)] cursor-pointer"
            >
              Cancelar
            </button>
            <ActionButton type="submit" disabled={isCreating} className="gap-2 text-xs">
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Registrar colaborador
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  )
}
