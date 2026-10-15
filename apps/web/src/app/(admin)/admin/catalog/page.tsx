'use client'

import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Tag } from 'lucide-react'
import type { CatalogItem, OperatingScheduleConfig } from '@sportcomplex/core'
import { ActionButton } from '@sportcomplex/ui'
import { ConfirmDialog } from '@sportcomplex/ui'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { SlotCapacityEditor } from '@/components/admin/slot-capacity-editor'

import { blankCatalogItem } from '@/app/(admin)/admin/catalog/types'
import { useAdminCatalog } from '@/app/(admin)/admin/catalog/hooks/use-admin-catalog'
import { CatalogFilters } from '@/app/(admin)/admin/catalog/components/catalog-filters'
import { CatalogTable } from '@/app/(admin)/admin/catalog/components/catalog-table'
import { CatalogScheduleView } from '@/app/(admin)/admin/catalog/components/catalog-schedule-view'
import { CategoryFormModal } from '@/app/(admin)/admin/catalog/components/category-form-modal'
import { CatalogFormModal } from '@/app/(admin)/admin/catalog/components/catalog-form-modal'

export default function AdminCatalogPage() {
  const { notify } = useApp()
  const {
    catalog, categories, schedules, loading, fetchError, selectedServiceId,
    setSelectedServiceId, loadData, saveService, saveSchedule, saveCategory,
    toggleStatus, deleteService,
  } = useAdminCatalog(notify)

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<CatalogItem | null>(null)
  const [deleting, setDeleting] = useState<CatalogItem | null>(null)

  const filteredServices = useMemo(() => {
    return catalog.filter((item) => {
      const matchCat = selectedCategoryFilter === 'todas' || item.category === selectedCategoryFilter
      const matchStat = statusFilter === 'todos' || item.status === statusFilter
      const matchQuery = !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sede.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchStat && matchQuery
    })
  }, [catalog, selectedCategoryFilter, statusFilter, searchQuery])

  const selectedService = catalog.find((item) => item.id === selectedServiceId) ?? filteredServices[0] ?? catalog[0]
  const selectedConfig: OperatingScheduleConfig = selectedService ? (schedules[selectedService.id] ?? {
    serviceId: selectedService.id, serviceName: selectedService.name, categorySlug: selectedService.category,
    capacity: selectedService.capacity > 0 ? selectedService.capacity : 25,
    isShared: selectedService.category === 'gimnasio' || selectedService.category === 'piscinas',
    startHour: 6, endHour: 22, slotDurationMinutes: 60, disabledSlots: [],
  }) : {
    serviceId: 'default', serviceName: 'Servicio', categorySlug: 'canchas',
    capacity: 4, isShared: false, startHour: 6, endHour: 22, slotDurationMinutes: 60, disabledSlots: [],
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="ADMINISTRACIÓN DE CATÁLOGO" title="Catálogo & Aforo"
        description="Gestión integral de categorías, instancias independientes y parametrización de turnos operativos con BD (RF-03, RF-04)."
        action={
          <div className="flex items-center gap-2">
            <ActionButton secondary onClick={() => setCreatingCategory(true)}><Tag size={15} /> Nueva Categoría</ActionButton>
            <ActionButton onClick={() => setEditing(blankCatalogItem)}><Plus size={16} /> Agregar Servicio</ActionButton>
          </div>
        }
      />
      {fetchError && (
        <div className="demo-card mb-6 p-4 border border-destructive/30 bg-destructive/10 rounded-lg flex items-center justify-between gap-4">
          <div className="text-xs text-destructive"><strong>Error:</strong> {fetchError}.</div>
          <ActionButton size="sm" secondary onClick={loadData}><RefreshCw size={13} /> Reintentar</ActionButton>
        </div>
      )}
      <CatalogFilters
        catalog={catalog} categories={categories} selectedCategoryFilter={selectedCategoryFilter}
        setSelectedCategoryFilter={setSelectedCategoryFilter} searchQuery={searchQuery}
        setSearchQuery={setSearchQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      />
      {loading ? (
        <section className="demo-card p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-32 bg-[var(--surface-soft)] rounded" />
            <div className="h-4 w-64 bg-[var(--surface-soft)] rounded" />
          </div>
          <p className="text-xs text-subtle font-medium">Sincronizando instancias y categorías...</p>
        </section>
      ) : (
        <>
          <CatalogTable
            services={filteredServices} categories={categories} schedules={schedules}
            selectedServiceId={selectedService?.id ?? ''} onSelectService={setSelectedServiceId}
            onEditSchedule={setEditingSchedule} onToggleStatus={toggleStatus}
            onEdit={setEditing} onDelete={setDeleting}
          />
          {selectedService && (
            <CatalogScheduleView selectedService={selectedService} selectedConfig={selectedConfig} onEditSchedule={setEditingSchedule} />
          )}
        </>
      )}
      {creatingCategory && (
        <CategoryFormModal onSave={async (c) => { if (await saveCategory(c)) setCreatingCategory(false) }} onClose={() => setCreatingCategory(false)} />
      )}
      {editing && (
        <CatalogFormModal initial={editing} categories={categories} onSave={async (i) => { if (await saveService(i)) setEditing(null) }} onClose={() => setEditing(null)} />
      )}
      {editingSchedule && (
        <SlotCapacityEditor
          service={editingSchedule} initialConfig={schedules[editingSchedule.id]}
          onSave={async (item, config) => { await saveSchedule(item, config); setEditingSchedule(null) }}
          onClose={() => setEditingSchedule(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar servicio / instancia" message={`¿Eliminar «${deleting.name}» de la base de datos?`}
          onCancel={() => setDeleting(null)} onConfirm={async () => { await deleteService(deleting); setDeleting(null) }}
        />
      )}
    </div>
  )
}
