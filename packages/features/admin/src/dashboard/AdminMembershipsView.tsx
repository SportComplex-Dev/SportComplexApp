'use client'

import { useState, useMemo } from 'react'

import {
  Users,
  TrendingUp,
  UserPlus,
  UserX,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react'
import { Badge, Input, Card } from '@sportcomplex/ui'

export interface AdminMembershipMember {
  id: string
  nombre: string
  fechaInicio?: string | Date
  fechaFin?: string | Date
}

export interface AdminMembershipOverviewData {
  segments: {
    active: AdminMembershipMember[]
    none: AdminMembershipMember[]
    expired: AdminMembershipMember[]
  }
  metrics: {
    newMembersLast30Days: number
    renewalPercentage: number
  }
}

export type MembershipSegmentTab = 'active' | 'none' | 'expired'

export interface AdminMembershipsViewProps {
  data?: AdminMembershipOverviewData | null
  isLoading?: boolean
  onRefresh?: () => void
  initialTab?: MembershipSegmentTab
}

/** Formatea fechas con zona horaria America/Bogota sin desfases */
export function formatBogotaDate(date: string | Date | undefined | null): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

export function AdminMembershipsView({
  data,
  isLoading = false,
  onRefresh,
  initialTab = 'active',
}: AdminMembershipsViewProps) {
  const [activeTab, setActiveTab] = useState<MembershipSegmentTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  const activeMembers = data?.segments?.active ?? []
  const noneMembers = data?.segments?.none ?? []
  const expiredMembers = data?.segments?.expired ?? []

  const currentSegmentList = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return activeMembers
      case 'none':
        return noneMembers
      case 'expired':
        return expiredMembers
      default:
        return []
    }
  }, [activeTab, activeMembers, noneMembers, expiredMembers])

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return currentSegmentList
    return currentSegmentList.filter(
      (m) =>
        m.nombre.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
    )
  }, [currentSegmentList, searchQuery])

  const newMembers = data?.metrics?.newMembersLast30Days ?? 0
  const renewalRate = data?.metrics?.renewalPercentage ?? 0

  return (
    <div
      className="space-y-6"
      data-testid="admin-memberships-view"
    >
      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Gestión y Control de Membresías
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Segmentación de socios, métricas de retención e histórico de suscripciones del complejo deportivo.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            data-testid="refresh-button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            aria-label="Actualizar datos de membresías"
          >
            <RefreshCw
              size={16}
              className={isLoading ? 'animate-spin text-brand-primary' : ''}
            />
            <span>{isLoading ? 'Actualizando...' : 'Refrescar'}</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Socios Activos */}
        <div
          data-testid="kpi-active-members"
          className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Socios Activos
            </span>
            <Users size={18} className="p-0.5 rounded-md bg-emerald-500/10" />
          </div>
          <div className="text-3xl font-black mt-3 text-emerald-900 dark:text-emerald-300 tracking-tight">
            {isLoading ? '...' : activeMembers.length}
          </div>
          <div className="text-[12px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 flex items-center justify-between">
            <span>Membresías vigentes</span>
            <span className="font-bold flex items-center gap-1 text-[11px]">
              <CheckCircle2 size={12} /> Al día
            </span>
          </div>
        </div>

        {/* KPI 2: Tasa de Renovación */}
        <div
          data-testid="kpi-renewal-rate"
          className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-xs relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Tasa de Renovación
            </span>
            <TrendingUp size={18} className="p-0.5 rounded-md bg-blue-500/10" />
          </div>
          <div className="text-3xl font-black mt-3 text-blue-900 dark:text-blue-300 tracking-tight">
            {isLoading ? '...' : `${renewalRate}%`}
          </div>
          <div className="text-[12px] text-blue-700/80 dark:text-blue-400/80 mt-1 flex items-center justify-between">
            <span>Fidelización histórica</span>
            <span className="font-bold text-[11px]">Recurrente</span>
          </div>
        </div>

        {/* KPI 3: Nuevos del Mes */}
        <div
          data-testid="kpi-new-members"
          className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 shadow-xs relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Nuevos del Mes
            </span>
            <UserPlus size={18} className="p-0.5 rounded-md bg-purple-500/10" />
          </div>
          <div className="text-3xl font-black mt-3 text-purple-900 dark:text-purple-300 tracking-tight">
            {isLoading ? '...' : newMembers}
          </div>
          <div className="text-[12px] text-purple-700/80 dark:text-purple-400/80 mt-1 flex items-center justify-between">
            <span>Últimos 30 días</span>
            <span className="font-bold text-[11px]">Altas</span>
          </div>
        </div>

        {/* KPI 4: Sin Membresía / Potenciales */}
        <div
          data-testid="kpi-none-members"
          className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-xs relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Sin Membresía
            </span>
            <UserX size={18} className="p-0.5 rounded-md bg-amber-500/10" />
          </div>
          <div className="text-3xl font-black mt-3 text-amber-900 dark:text-amber-300 tracking-tight">
            {isLoading ? '...' : noneMembers.length}
          </div>
          <div className="text-[12px] text-amber-700/80 dark:text-amber-400/80 mt-1 flex items-center justify-between">
            <span>Clientes ocasionales</span>
            <span className="font-bold text-[11px]">Potenciales</span>
          </div>
        </div>
      </div>

      {/* Tabs y Buscador */}
      <Card className="p-4 sm:p-5 border-border bg-card shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-border">
          {/* Tabs Segmentados */}
          <div
            role="tablist"
            aria-label="Segmentos de membresías"
            className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl overflow-x-auto shrink-0 scrollbar-none max-w-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'active'}
              data-testid="tab-active"
              onClick={() => setActiveTab('active')}
              className={`whitespace-nowrap shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span>Activas</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                {activeMembers.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'none'}
              data-testid="tab-none"
              onClick={() => setActiveTab('none')}
              className={`whitespace-nowrap shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'none'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HelpCircle size={15} className="text-amber-500" />
              <span>Sin Membresía</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                {noneMembers.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'expired'}
              data-testid="tab-expired"
              onClick={() => setActiveTab('expired')}
              className={`whitespace-nowrap shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'expired'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertCircle size={15} className="text-rose-500" />
              <span>Histórico</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold">
                {expiredMembers.length}
              </span>
            </button>
          </div>

          {/* Buscador en tiempo real */}
          <div className="relative w-full xl:w-72 shrink-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              type="text"
              data-testid="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente o ID..."
              className="pl-9 pr-8 h-10 w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabla Reactiva de Clientes */}
        <div className="mt-4 overflow-x-auto">
          <table
            data-testid="memberships-table"
            className="w-full text-left text-sm border-collapse"
          >
            <thead>
              <tr className="border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider bg-muted/20">
                <th className="py-3 px-4">Cliente / Socio</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Fecha Inicio</th>
                <th className="py-3 px-4">
                  {activeTab === 'active' ? 'Próxima Renovación' : 'Fecha Fin / Expiración'}
                </th>
                <th className="py-3 px-4 text-right hidden md:table-cell">Identificador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando segmentación de membresías...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    {searchQuery ? (
                      <div>
                        <p className="font-medium text-foreground">
                          No se encontraron coincidencias para &ldquo;{searchQuery}&rdquo;
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Intenta con otro término o limpia el buscador.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">
                          No hay clientes registrados en este segmento
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Los registros aparecerán automáticamente cuando haya actividad.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {/* Nombre y Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary font-bold flex items-center justify-center text-xs">
                          {member.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {member.nombre}
                          </div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            ID: {member.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Estado con Badge */}
                    <td className="py-3.5 px-4">
                      {activeTab === 'active' && (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        >
                          Vigente
                        </Badge>
                      )}
                      {activeTab === 'none' && (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                        >
                          Sin Membresía
                        </Badge>
                      )}
                      {activeTab === 'expired' && (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                        >
                          Histórico / Vencida
                        </Badge>
                      )}
                    </td>

                    {/* Fecha Inicio */}
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {formatBogotaDate(member.fechaInicio)}
                    </td>

                    {/* Fecha Fin */}
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {formatBogotaDate(member.fechaFin)}
                    </td>

                    {/* ID */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                      <span title={member.id}>
                        {member.id.length > 12 ? `${member.id.substring(0, 8)}...` : member.id}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con conteo */}
        {!isLoading && filteredMembers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{filteredMembers.length}</strong> de{' '}
              <strong className="text-foreground">{currentSegmentList.length}</strong> clientes en este segmento
            </span>
            <span className="hidden sm:inline">
              Zona horaria: America/Bogota (COT)
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}
