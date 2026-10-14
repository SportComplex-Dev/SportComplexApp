'use client'

import { Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { formatMoney, type CatalogItem, type OperatingScheduleConfig } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import type { CustomCategory } from '../types'

interface CatalogTableProps {
  services: CatalogItem[]
  categories: CustomCategory[]
  schedules: Record<string, OperatingScheduleConfig>
  selectedServiceId: string
  onSelectService: (id: string) => void
  onEditSchedule: (item: CatalogItem) => void
  onToggleStatus: (item: CatalogItem) => void
  onEdit: (item: CatalogItem) => void
  onDelete: (item: CatalogItem) => void
}

export function CatalogTable({
  services,
  categories,
  schedules,
  selectedServiceId,
  onSelectService,
  onEditSchedule,
  onToggleStatus,
  onEdit,
  onDelete,
}: CatalogTableProps) {
  return (
    <section className="demo-card">
      <div className="demo-card-heading">
        <div>
          <h2>Instancias de Servicios ({services.length})</h2>
          <p>
            Cada instancia coexiste con su identificador y calendario independiente (Criterio Clave HU-04).
            Haz clic en cualquier fila para ver su matriz de disponibilidad.
          </p>
        </div>
      </div>

      <div className="demo-table-wrap">
        <table className="demo-table">
          <thead>
            <tr>
              <th>Instancia / Servicio</th>
              <th>Categoría</th>
              <th>Sede</th>
              <th>Precio</th>
              <th>Aforo & Modalidad (RF-04)</th>
              <th>Disponibilidad</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-subtle">
                  No se encontraron servicios con los filtros aplicados.
                </td>
              </tr>
            )}
            {services.map((item) => {
              const config = schedules[item.id]
              const capacityValue = config?.capacity ?? item.capacity
              const isShared = config?.isShared ?? (item.category === 'gimnasio' || item.category === 'piscinas')
              const isSelected = selectedServiceId === item.id
              const categoryObj = categories.find((c) => c.slug === item.category)

              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--surface-soft)] font-medium' : ''
                  }`}
                  onClick={() => onSelectService(item.id)}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)] shrink-0" />}
                      <span className="font-semibold text-ink">{item.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs text-subtle">
                      {categoryObj?.name ?? item.category}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-subtle whitespace-nowrap">{item.sede}</span>
                  </td>
                  <td>
                    <span className="text-xs font-semibold text-ink whitespace-nowrap">
                      {formatMoney(item.price)} COP
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Badge variant={isShared ? 'success' : 'secondary'} className="text-[10px] font-semibold">
                          {isShared ? 'Compartido' : 'Exclusivo'}
                        </Badge>
                        <span className="text-xs text-subtle">
                          <b>{capacityValue}</b> {capacityValue === 1 ? 'cupo' : 'personas'}
                        </span>
                      </div>
                      {item.category === 'piscinas' && (
                        <span className="text-[10px] text-brand-accent font-semibold">
                          {item.poolType === 'PRIVADA' ? '🏊 Privada (Exclusiva)' : '🏊 Pública (Aforo)'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge
                      variant={item.status === 'Disponible' ? 'success' : 'warning'}
                      className="whitespace-nowrap"
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 py-1 px-2.5 rounded-md text-xs font-semibold border border-[var(--line)] bg-[var(--surface-soft)] text-ink hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] transition-all cursor-pointer"
                        title={`Editar aforo y franjas de ${item.name}`}
                        onClick={() => onEditSchedule(item)}
                      >
                        <SlidersHorizontal size={13} className="text-[var(--brand-accent)] shrink-0" />
                        <span>Aforo</span>
                      </button>

                      <button
                        type="button"
                        className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                          item.status === 'Disponible'
                            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'
                            : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10'
                        }`}
                        onClick={() => onToggleStatus(item)}
                      >
                        {item.status === 'Disponible' ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="icon-action size-7 min-w-7 min-h-7 flex items-center justify-center rounded-md border border-[var(--line)] hover:bg-[var(--surface-soft)] text-subtle hover:text-ink transition-colors cursor-pointer"
                        aria-label={`Editar ${item.name}`}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-action icon-danger size-7 min-w-7 min-h-7 flex items-center justify-center rounded-md border border-[var(--line)] hover:bg-red-500/15 text-subtle hover:text-red-500 transition-colors cursor-pointer"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
