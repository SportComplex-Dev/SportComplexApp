'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Search,
  UserPlus,
} from 'lucide-react'
import { Input } from '@sportcomplex/ui'
import { ActionButton } from '@sportcomplex/ui'
import { useApp } from '@/components/app-provider'
import {
  EmployeeStats,
} from '@sportcomplex/features-admin'
import {
  EmployeeTable,
  type Employee,
} from '@sportcomplex/features-admin'
import {
  EmployeeCreateModal,
} from '@sportcomplex/features-admin'
import {
  EmployeeDeactivateModal,
} from '@sportcomplex/features-admin'

export default function AdminEmployeesPage() {
  const { notify } = useApp()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modal Alta
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    nombre: '',
    correo: '',
    rolNombre: 'VENDEDOR',
    password: '',
  })

  // Modal Baja
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<Employee | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchEmployees = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/employees')
      const json = await res.json()
      if (res.ok && json.success && Array.isArray(json.data)) {
        setEmployees(json.data)
      } else {
        throw new Error(json.error?.message ?? 'No se pudo cargar la lista de empleados.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor.'
      setFetchError(msg)
      setEmployees([])
      notify(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  // Filtrado reactivo
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        emp.nombre.toLowerCase().includes(search.toLowerCase()) ||
        emp.correo.toLowerCase().includes(search.toLowerCase())

      const normalizedRole = emp.rol?.nombre?.toUpperCase() ?? ''
      const matchesRole =
        roleFilter === 'ALL' ||
        normalizedRole === roleFilter ||
        (roleFilter === 'VENDEDOR' && normalizedRole.includes('VENDEDOR')) ||
        (roleFilter === 'LECTOR' && normalizedRole.includes('LECTOR')) ||
        (roleFilter === 'ADMIN' && (normalizedRole.includes('ADMIN') || normalizedRole === 'ADMINISTRADOR'))

      const matchesStatus =
        statusFilter === 'ALL' || emp.estado === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [employees, search, roleFilter, statusFilter])

  // KPIs
  const stats = useMemo(() => {
    const total = employees.length
    const active = employees.filter((e) => e.estado === 'ACTIVO').length
    const inactive = employees.filter((e) => e.estado === 'INACTIVO').length
    const sellers = employees.filter((e) => e.rol?.nombre?.includes('VENDEDOR')).length
    const readers = employees.filter((e) => e.rol?.nombre?.includes('LECTOR')).length
    return { total, active, inactive, sellers, readers }
  }, [employees])

  // Manejo de creación
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.nombre.trim() || !createForm.correo.trim() || !createForm.password.trim()) {
      notify('Completa todos los campos requeridos.', 'error')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        notify('Empleado registrado exitosamente.', 'success')
        setIsCreateOpen(false)
        setCreateForm({ nombre: '', correo: '', rolNombre: 'VENDEDOR', password: '' })
        fetchEmployees()
      } else {
        notify(json.error?.message ?? 'No se pudo registrar el empleado.', 'error')
      }
    } catch {
      notify('Error al procesar el registro.', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  // Manejo de baja lógica (RN-10)
  const handleDeactivate = async () => {
    if (!deactivatingEmployee) return

    setIsDeactivating(true)
    try {
      const res = await fetch(`/api/admin/employees/${deactivatingEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'INACTIVO' }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        notify(`Baja lógica aplicada a ${deactivatingEmployee.nombre}. Accesos revocados.`, 'success')
        setDeactivatingEmployee(null)
        // Actualización optimista local
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === deactivatingEmployee.id
              ? { ...emp, estado: 'INACTIVO', deletedAt: new Date().toISOString() }
              : emp
          )
        )
      } else {
        notify(json.error?.message ?? 'No se pudo aplicar la baja.', 'error')
      }
    } catch {
      notify('Error de red al procesar la baja.', 'error')
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <div className="admin-page-container space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow text-[#557b53] dark:text-[#9ee285]">SEGURIDAD & ROLES (RF-18 / RN-10)</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Personal y Roles Operativos
          </h1>
          <p className="text-xs sm:text-sm text-[var(--subtle)] mt-1">
            Gestión de usuarios internos, asignación de permisos de taquilla o acceso y control de bajas lógicas sin borrado físico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchEmployees}
            disabled={isLoading}
            className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors cursor-pointer"
            title="Recargar lista"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <ActionButton onClick={() => setIsCreateOpen(true)} className="gap-2">
            <UserPlus size={16} /> Nuevo empleado
          </ActionButton>
        </div>
      </div>

      {/* Error de Conexión / Servidor */}
      {fetchError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Error de sincronización con el servidor</p>
              <p className="text-[11px] opacity-90">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchEmployees}
            disabled={isLoading}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <EmployeeStats stats={stats} />

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--surface-soft)] p-1 rounded-lg border border-[var(--line)] text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                roleFilter === 'ALL' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('VENDEDOR')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                roleFilter === 'VENDEDOR' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              Vendedores
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('LECTOR')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                roleFilter === 'LECTOR' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              Lectores
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('ADMIN')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                roleFilter === 'ADMIN' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              Admins
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] cursor-pointer"
          >
            <option value="ALL">Estado: Todos</option>
            <option value="ACTIVO">Solo Activos</option>
            <option value="INACTIVO">Solo Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla de Empleados */}
      <EmployeeTable
        employees={filteredEmployees}
        onDeactivateClick={(emp) => setDeactivatingEmployee(emp)}
      />

      {/* Modal Alta de Empleado */}
      <EmployeeCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        form={createForm}
        setForm={setCreateForm}
        isCreating={isCreating}
      />

      {/* Modal Confirmación de Baja Lógica (RN-10) */}
      <EmployeeDeactivateModal
        employee={deactivatingEmployee}
        onClose={() => setDeactivatingEmployee(null)}
        onConfirm={handleDeactivate}
        isDeactivating={isDeactivating}
      />
    </div>
  )
}

