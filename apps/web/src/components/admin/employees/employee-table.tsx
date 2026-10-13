'use client'

import React from 'react'
import { Mail, Shield, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'

export interface Employee {
  id: string
  nombre: string
  correo: string
  estado: 'ACTIVO' | 'INACTIVO' | 'PENDIENTE'
  creadoEn: string
  deletedAt: string | null
  rolId: number
  rol: {
    id: number
    nombre: string
  }
}

interface EmployeeTableProps {
  employees: Employee[]
  onDeactivateClick: (emp: Employee) => void
}

export function formatRoleBadge(roleName: string) {
  const r = roleName.toUpperCase()
  if (r.includes('ADMIN')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        <ShieldCheck size={12} /> ADMIN
      </span>
    )
  }
  if (r.includes('VENDEDOR')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <UserCheck size={12} /> VENDEDOR
      </span>
    )
  }
  if (r.includes('LECTOR')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <Shield size={12} /> LECTOR
      </span>
    )
  }
  return <Badge variant="secondary">{roleName}</Badge>
}

export function EmployeeTable({ employees, onDeactivateClick }: EmployeeTableProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-[var(--surface-soft)] text-[var(--subtle)] font-bold uppercase text-[10px] tracking-wider border-b border-[var(--line)]">
            <tr>
              <th className="py-3 px-4">Colaborador</th>
              <th className="py-3 px-4">Rol Asignado</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Fecha de Alta</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[var(--subtle)]">
                  <UserX size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm">No se encontraron empleados</p>
                  <p className="text-xs mt-1">Prueba cambiando los filtros de búsqueda o rol.</p>
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isActive = emp.estado === 'ACTIVO'
                const initials = emp.nombre
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <tr key={emp.id} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--ink)] shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--ink)]">{emp.nombre}</div>
                          <div className="text-[11px] text-[var(--subtle)] flex items-center gap-1">
                            <Mail size={11} /> {emp.correo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {formatRoleBadge(emp.rol?.nombre ?? 'VENDEDOR')}
                    </td>
                    <td className="py-3.5 px-4">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Inactivo
                          </span>
                          {emp.deletedAt && (
                            <span className="text-[10px] text-[var(--subtle)] mt-0.5">
                              Baja: {new Date(emp.deletedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--subtle)] text-xs">
                      {new Date(emp.creadoEn).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isActive ? (
                        emp.rol?.nombre?.toUpperCase().includes('ADMIN') ? (
                          <span className="text-[11px] font-medium text-[var(--subtle)] italic">
                            Administrador
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDeactivateClick(emp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
                          >
                            <UserX size={13} /> Dar de baja
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] font-medium text-[var(--subtle)] italic">
                          Acceso revocado
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
