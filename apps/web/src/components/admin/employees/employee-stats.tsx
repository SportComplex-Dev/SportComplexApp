'use client'

import React from 'react'
import { Users, UserCheck, UserX, Shield } from 'lucide-react'

export interface EmployeeStatsCounts {
  total: number
  active: number
  inactive: number
  sellers: number
  readers: number
}

interface EmployeeStatsProps {
  stats: EmployeeStatsCounts
}

export function EmployeeStats({ stats }: EmployeeStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="flex items-center justify-between text-[var(--subtle)]">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Plantilla</span>
          <Users size={16} />
        </div>
        <div className="text-2xl font-black mt-2 text-[var(--ink)]">{stats.total}</div>
        <div className="text-[11px] text-[var(--subtle)] mt-1">Colaboradores registrados</div>
      </div>

      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Activos</span>
          <UserCheck size={16} />
        </div>
        <div className="text-2xl font-black mt-2 text-emerald-700 dark:text-emerald-300">{stats.active}</div>
        <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Con acceso al sistema</div>
      </div>

      <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 shadow-xs">
        <div className="flex items-center justify-between text-red-600 dark:text-red-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Inactivos (Bajas)</span>
          <UserX size={16} />
        </div>
        <div className="text-2xl font-black mt-2 text-red-700 dark:text-red-300">{stats.inactive}</div>
        <div className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-1">Historial preservado</div>
      </div>

      <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="flex items-center justify-between text-[var(--subtle)]">
          <span className="text-xs font-semibold uppercase tracking-wider">Taquilla / Puerta</span>
          <Shield size={16} />
        </div>
        <div className="text-2xl font-black mt-2 text-[var(--ink)]">
          {stats.sellers} <span className="text-xs font-normal text-[var(--subtle)]">/ {stats.readers} lectores</span>
        </div>
        <div className="text-[11px] text-[var(--subtle)] mt-1">Personal en campo</div>
      </div>
    </div>
  )
}
