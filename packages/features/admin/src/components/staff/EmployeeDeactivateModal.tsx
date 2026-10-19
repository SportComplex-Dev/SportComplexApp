'use client'

import { AlertTriangle, Loader2, ShieldAlert, UserX } from 'lucide-react'
import type { Employee } from './EmployeeTable'

interface EmployeeDeactivateModalProps {
  employee: Employee | null
  onClose: () => void
  onConfirm: () => void
  isDeactivating: boolean
}

export function EmployeeDeactivateModal({
  employee,
  onClose,
  onConfirm,
  isDeactivating,
}: EmployeeDeactivateModalProps) {
  if (!employee) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[var(--surface)] p-6 shadow-2xl relative">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[var(--ink)]">Confirmar Baja de Empleado</h3>
            <p className="text-xs text-[var(--subtle)] mt-1">
              ¿Estás seguro de dar de baja a <b>{employee.nombre}</b> ({employee.correo})?
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldAlert size={14} /> Garantía de Integridad (RN-10):
          </div>
          <p className="text-[11.5px] opacity-90">
            El usuario pasará a estado <b>INACTIVO</b> revocando inmediatamente sus sesiones y tokens de acceso. Sus cobros, lecturas y auditorías históricas <b>no serán eliminados</b>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--line)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--subtle)] hover:bg-[var(--surface-soft)] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeactivating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-sm"
          >
            {isDeactivating ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
            Confirmar y dar de baja
          </button>
        </div>
      </div>
    </div>
  )
}
