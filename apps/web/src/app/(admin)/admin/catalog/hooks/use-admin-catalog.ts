'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  serviceCategories,
  type CatalogItem,
  type OperatingScheduleConfig,
} from '@sportcomplex/core'
import type { ToastKind } from '@/components/feedback/toast-message'
import {
  type CustomCategory,
  type DbCategory,
  type DbService,
  mapDbCategory,
  mapDbSchedule,
  mapDbService,
} from '@/app/(admin)/admin/catalog/types'

export function useAdminCatalog(notify: (msg: string, type?: ToastKind) => void) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<CustomCategory[]>(() =>
    serviceCategories.map((c) => ({
      slug: c.slug,
      name: c.name,
      unit: c.unit,
      tipo: c.slug === 'piscinas' ? 'PISCINA' : c.slug === 'gimnasio' ? 'GIMNASIO' : c.slug === 'zona-humeda' ? 'ZONA_HUMEDA' : 'CANCHA',
      description: c.description,
    }))
  )
  const [schedules, setSchedules] = useState<Record<string, OperatingScheduleConfig>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/services')
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo consultar el catálogo en el servidor`)
      }
      const json = await res.json()
      if (!json.success || !json.data) {
        throw new Error(json.error?.message || 'Error en respuesta de la API')
      }

      const dbCategories = (json.data.categories || []) as DbCategory[]
      const dbServices = (json.data.services || []) as DbService[]

      let mappedCategories: CustomCategory[] = dbCategories.map(mapDbCategory)
      if (mappedCategories.length === 0) {
        mappedCategories = serviceCategories.map((c) => ({
          slug: c.slug,
          name: c.name,
          unit: c.unit,
          tipo: c.slug === 'piscinas' ? 'PISCINA' : c.slug === 'gimnasio' ? 'GIMNASIO' : c.slug === 'zona-humeda' ? 'ZONA_HUMEDA' : 'CANCHA',
          description: c.description,
        }))
      }
      setCategories(mappedCategories)

      const mappedServices: CatalogItem[] = dbServices.map((s) => mapDbService(s, mappedCategories))
      const scheduleMap: Record<string, OperatingScheduleConfig> = {}

      dbServices.forEach((s) => {
        const strId = String(s.id)
        scheduleMap[strId] = mapDbSchedule(s, mappedCategories)
      })

      // Sin fallback a initialCatalog: si está vacío o falla, setCatalog([])
      setCatalog(mappedServices)
      setSchedules(scheduleMap)
      if (mappedServices[0]) {
        setSelectedServiceId(mappedServices[0].id)
      } else {
        setSelectedServiceId('')
      }
    } catch (err: unknown) {
      console.error('Error al cargar datos del catálogo:', err)
      const msg = err instanceof Error ? err.message : 'Error al conectar con la base de datos'
      setFetchError(msg)
      setCategories(
        serviceCategories.map((c) => ({
          slug: c.slug,
          name: c.name,
          unit: c.unit,
          tipo: c.slug === 'piscinas' ? 'PISCINA' : c.slug === 'gimnasio' ? 'GIMNASIO' : c.slug === 'zona-humeda' ? 'ZONA_HUMEDA' : 'CANCHA',
          description: c.description,
        }))
      )
      setCatalog([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveService = async (item: CatalogItem) => {
    try {
      const categoryObj = categories.find((c) => c.slug === item.category)
      let categoriaId = categoryObj?.id
      if (!categoriaId) {
        categoriaId = 1
      }

      const isPool = categoryObj?.tipo === 'PISCINA' || item.category === 'piscinas'
      const poolType = isPool
        ? (item.poolType ?? (item.capacity > 1 ? 'PUBLICA' : 'PRIVADA'))
        : null
      const modalidad = isPool
        ? (poolType === 'PRIVADA' ? 'EXCLUSIVA' : 'AFORO')
        : (item.capacity > 1 || categoryObj?.tipo === 'GIMNASIO' || item.category === 'gimnasio' ? 'AFORO' : 'EXCLUSIVA')

      if (item.id && !isNaN(Number(item.id))) {
        const numId = Number(item.id)
        const res = await fetch(`/api/admin/services/${numId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: item.name,
            categoriaId,
            capacidadMaxima: item.capacity,
            tarifa: item.price,
            modalidad,
            tipoPiscina: poolType,
            estado: item.status === 'Disponible' ? 'ACTIVO' : 'INHABILITADO',
          }),
        })

        const json = await res.json()
        if (!res.ok || !json.success) {
          notify(json.error?.message || 'Error al actualizar el servicio en la BD', 'error')
          return false
        }

        const updated = mapDbService(json.data, categories)
        setCatalog((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)))
        notify(`Servicio «${updated.name}» actualizado en BD con éxito.`, 'success')
        return true
      } else {
        const defaultFranjas: { diaSemana: number; horaInicio: string; horaFin: string }[] = []
        for (let dia = 1; dia <= 7; dia++) {
          for (let h = 6; h < 22; h++) {
            defaultFranjas.push({
              diaSemana: dia,
              horaInicio: `${String(h).padStart(2, '0')}:00`,
              horaFin: `${String(h + 1).padStart(2, '0')}:00`,
            })
          }
        }

        const res = await fetch('/api/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: item.name,
            categoriaId,
            capacidadMaxima: item.capacity,
            tarifa: item.price,
            modalidad,
            tipoPiscina: poolType,
            estado: item.status === 'Disponible' ? 'ACTIVO' : 'INHABILITADO',
            franjasHorarias: defaultFranjas,
          }),
        })

        const json = await res.json()
        if (!res.ok || !json.success) {
          notify(json.error?.message || 'Error al crear servicio en BD', 'error')
          return false
        }

        const created = mapDbService(json.data, categories)
        const createdSchedule = mapDbSchedule(json.data, categories)

        setCatalog((prev) => [...prev, created])
        setSchedules((prev) => ({
          ...prev,
          [created.id]: createdSchedule,
        }))
        setSelectedServiceId(created.id)
        notify(`Instancia «${created.name}» creada en BD con calendario independiente.`, 'success')
        return true
      }
    } catch (err: unknown) {
      console.error('Error al guardar servicio:', err)
      notify('Error de red al guardar servicio en base de datos.', 'error')
      return false
    }
  }

  const saveSchedule = async (
    updatedService: CatalogItem,
    updatedConfig: OperatingScheduleConfig
  ) => {
    const numId = Number(updatedService.id)

    const franjasHorarias: { diaSemana: number; horaInicio: string; horaFin: string }[] = []
    for (let dia = 1; dia <= 7; dia++) {
      for (let h = updatedConfig.startHour; h < updatedConfig.endHour; h++) {
        const timeStr = `${String(h).padStart(2, '0')}:00`
        if (!updatedConfig.disabledSlots.includes(timeStr)) {
          const nextHourStr = `${String(h + 1).padStart(2, '0')}:00`
          franjasHorarias.push({
            diaSemana: dia,
            horaInicio: timeStr,
            horaFin: nextHourStr,
          })
        }
      }
    }

    if (!isNaN(numId)) {
      const res = await fetch(`/api/admin/services/${numId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacidadMaxima: updatedConfig.capacity,
          modalidad: updatedConfig.isShared ? 'AFORO' : 'EXCLUSIVA',
          franjasHorarias,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        const errorMsg =
          json.error?.message ||
          'Error al guardar los parámetros de aforo y franjas en la base de datos.'
        throw new Error(errorMsg)
      }

      const updated = mapDbService(json.data, categories)
      const updatedSched = mapDbSchedule(json.data, categories)

      setCatalog((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSchedules((prev) => ({
        ...prev,
        [updatedConfig.serviceId]: updatedSched,
      }))
    } else {
      setCatalog((prev) =>
        prev.map((item) => (item.id === updatedService.id ? updatedService : item))
      )
      setSchedules((prev) => ({
        ...prev,
        [updatedConfig.serviceId]: updatedConfig,
      }))
    }

    setSelectedServiceId(updatedConfig.serviceId)
    notify(
      `Aforo (${updatedConfig.capacity} pers.) y franjas horarias guardados en BD para "${updatedService.name}".`,
      'success'
    )
  }

  const saveCategory = async (newCat: CustomCategory) => {
    try {
      const res = await fetch('/api/admin/services/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newCat.name,
          tipo: newCat.tipo || 'CANCHA',
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        const errorMsg = json.error?.message || `Error al crear la categoría "${newCat.name}"`
        notify(errorMsg, 'error')
        return false
      }

      const createdCat = mapDbCategory(json.data)
      setCategories((prev) => [...prev, createdCat])
      notify(`Categoría «${createdCat.name}» persistida en base de datos.`, 'success')
      return true
    } catch (err: unknown) {
      console.error('Error al crear categoría:', err)
      notify('Error al conectar con la API de categorías.', 'error')
      return false
    }
  }

  const toggleStatus = async (item: CatalogItem) => {
    const nextStatus = item.status === 'Disponible' ? 'Mantenimiento' : 'Disponible'
    const nextEstado = nextStatus === 'Disponible' ? 'ACTIVO' : 'INHABILITADO'
    const numId = Number(item.id)

    if (!isNaN(numId)) {
      try {
        const res = await fetch(`/api/admin/services/${numId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nextEstado }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          notify(json.error?.message || 'Error al actualizar estado en BD', 'error')
          return
        }
      } catch (err) {
        console.error('Error al actualizar estado:', err)
        notify('Error de red al actualizar estado.', 'error')
        return
      }
    }

    setCatalog((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, status: nextStatus } : entry))
    )
    notify(nextStatus === 'Disponible' ? 'Instancia activada en BD.' : 'Instancia pausada en BD.', 'success')
  }

  const deleteService = async (item: CatalogItem) => {
    const numId = Number(item.id)
    if (!isNaN(numId)) {
      try {
        const res = await fetch(`/api/admin/services/${numId}`, {
          method: 'DELETE',
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          if (res.status === 409) {
            notify(json.error?.message || 'El servicio tiene reservas activas. Debe inhabilitarse en su lugar.', 'error')
          } else {
            notify(json.error?.message || 'Error al eliminar el servicio de la BD.', 'error')
          }
          return false
        }
        notify(json.data?.message || 'Servicio eliminado exitosamente de la base de datos.', 'success')
      } catch (err: unknown) {
        console.error('Error al eliminar servicio:', err)
        notify('Error de conexión al eliminar servicio.', 'error')
        return false
      }
    }

    setCatalog((prev) => prev.filter((entry) => entry.id !== item.id))
    return true
  }

  return {
    catalog,
    categories,
    schedules,
    loading,
    fetchError,
    selectedServiceId,
    setSelectedServiceId,
    loadData,
    saveService,
    saveSchedule,
    saveCategory,
    toggleStatus,
    deleteService,
  }
}
