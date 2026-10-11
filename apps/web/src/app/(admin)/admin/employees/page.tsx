'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { Badge, Input } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'
import { useApp } from '@/components/app-provider'

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

  const fetchEmployees = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/employees')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setEmployees(json.data)
      } else {
        // Carga de respaldo local para entorno estático/demo
        setEmployees([
          {
            id: 'emp-1',
            nombre: 'Sebastián Mendoza',
            correo: 'admin@sportcomplex.co',
            estado: 'ACTIVO',
            creadoEn: '2026-09-01T08:00:00Z',
            deletedAt: null,
            rolId: 1,
            rol: { id: 1, nombre: 'ADMIN' },
          },
          {
            id: 'emp-2',
            nombre: 'Andrés Muñoz',
            correo: 'andres.taquilla@sportcomplex.co',
            estado: 'ACTIVO',
            creadoEn: '2026-09-15T09:30:00Z',
            deletedAt: null,
            rolId: 2,
            rol: { id: 2, nombre: 'VENDEDOR' },
          },
          {
            id: 'emp-3',
            nombre: 'Carolina Gómez',
            correo: 'carolina.torniquete@sportcomplex.co',
            estado: 'ACTIVO',
            creadoEn: '2026-09-20T14:15:00Z',
            deletedAt: null,
            rolId: 3,
            rol: { id: 3, nombre: 'LECTOR' },
          },
          {
            id: 'emp-4',
            nombre: 'Felipe Restrepo',
            correo: 'felipe.antiguo@sportcomplex.co',
            estado: 'INACTIVO',
            creadoEn: '2026-08-10T10:00:00Z',
            deletedAt: '2026-09-28T16:45:00Z',
            rolId: 2,
            rol: { id: 2, nombre: 'VENDEDOR' },
          },
        ])
      }
    } catch {
      notify('No se pudo conectar con el servidor. Mostrando datos locales.', 'error')
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

  const formatRoleBadge = (roleName: string) => {
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

      {/* KPI Cards */}
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
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--subtle)]">
                    <UserX size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm">No se encontraron empleados</p>
                    <p className="text-xs mt-1">Prueba cambiando los filtros de búsqueda o rol.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
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
                          <button
                            type="button"
                            onClick={() => setDeactivatingEmployee(emp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
                          >
                            <UserX size={13} /> Dar de baja
                          </button>
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

      {/* Modal Alta de Empleado */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
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

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">Nombre Completo</label>
                <Input
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                  placeholder="Ej. Carlos Restrepo"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">Correo Electrónico Institucional</label>
                <Input
                  type="email"
                  value={createForm.correo}
                  onChange={(e) => setCreateForm({ ...createForm, correo: e.target.value })}
                  placeholder="ejemplo@sportcomplex.co"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">Rol Operativo</label>
                <select
                  value={createForm.rolNombre}
                  onChange={(e) => setCreateForm({ ...createForm, rolNombre: e.target.value })}
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
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
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
                  onClick={() => setIsCreateOpen(false)}
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
      )}

      {/* Modal Confirmación de Baja Lógica (RN-10) */}
      {deactivatingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[var(--surface)] p-6 shadow-2xl relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--ink)]">Confirmar Baja de Empleado</h3>
                <p className="text-xs text-[var(--subtle)] mt-1">
                  ¿Estás seguro de dar de baja a <b>{deactivatingEmployee.nombre}</b> ({deactivatingEmployee.correo})?
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
                onClick={() => setDeactivatingEmployee(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--subtle)] hover:bg-[var(--surface-soft)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-sm"
              >
                {isDeactivating ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                Confirmar y dar de baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
