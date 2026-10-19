'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  AdminMembershipsView,
  type AdminMembershipOverviewData,
} from '@sportcomplex/features-admin'
import { useApp } from '@/components/layout/app-provider'

export default function AdminMembershipsPage() {
  const { notify } = useApp()
  const [data, setData] = useState<AdminMembershipOverviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMemberships = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/memberships')
      const json = await res.json()

      if (res.ok && json.success && json.data) {
        setData(json.data)
      } else {
        const errorMsg =
          json.error?.message ||
          'No fue posible obtener la información de las membresías.'
        setError(errorMsg)
        notify(errorMsg, 'error')
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Error de conexión al cargar las membresías.'
      setError(errorMsg)
      notify(errorMsg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchMemberships()
  }, [fetchMemberships])

  if (error && !data) {
    return (
      <div
        data-testid="admin-memberships-error"
        className="p-8 rounded-2xl border border-destructive/20 bg-destructive/5 text-center max-w-lg mx-auto my-12"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          No se pudieron cargar las membresías
        </h2>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
        <button
          type="button"
          onClick={fetchMemberships}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 transition-colors cursor-pointer"
        >
          <RefreshCw size={16} />
          <span>Reintentar</span>
        </button>
      </div>
    )
  }

  return (
    <div className="py-2">
      <AdminMembershipsView
        data={data}
        isLoading={isLoading}
        onRefresh={fetchMemberships}
      />
    </div>
  )
}
