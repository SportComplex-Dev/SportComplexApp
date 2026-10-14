'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'
import { Modal } from '@/components/modal'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import {
  formatIncidentDate,
  formatIncidentHour,
  isIncidentReasonValid,
} from './incident-utils'

interface ServiceOption {
  id: number
  nombre: string
  estado: string
  capacidadMaxima: number
  categoria?: {
    nombre: string
  }
}

interface AffectedReservation {
  reservaId: string
  usuarioId: string
  nombre: string
  correo: string
  fecha: string | Date
  horaInicio: string | Date
  horaFin: string | Date
  cantidadCupos: number
  estado?: string
}

interface ContingencyPreview {
  servicio: {
    id: number
    nombre: string
    estado: string
  }
  totalReservas: number
  totalCupos: number
  totalClientesAfectados: number
  reservasAfectadas: AffectedReservation[]
}

interface ContingencySuccessResult {
  servicio: { id: number; nombre: string; estado: string }
  inhabilitacion: {
    id: number
    servicioId: number
    motivo: string
    fechaInicio: string
  }
  reservasCanceladas: AffectedReservation[]
  webhook: { sent: boolean; error?: string }
  webhookEnviadoRegistrado: boolean
  reembolsoAutomatico: boolean
}

export default function AdminIncidentPage() {
  const { notify } = useApp()

  // Lista de servicios disponibles
  const [services, setServices] = useState<ServiceOption[]>([])
  const [loadingServices, setLoadingServices] = useState<boolean>(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  // Campo de motivo
  const [motivo, setMotivo] = useState<string>('')
  const [motivoTouched, setMotivoTouched] = useState<boolean>(false)

  // Resumen previo (Preview de reservas / clientes afectados)
  const [preview, setPreview] = useState<ContingencyPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Confirmación explícita & Ejecución
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Resultado post-ejecución
  const [result, setResult] = useState<ContingencySuccessResult | null>(null)

  // Cargar servicios
  const loadServices = useCallback(async () => {
    setLoadingServices(true)
    try {
      const res = await fetch('/api/admin/services?entity=services')
      if (!res.ok) throw new Error('No se pudo cargar el listado de servicios.')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setServices(json.data)
      } else {
        setServices([])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar servicios'
      notify(msg)
    } finally {
      setLoadingServices(false)
    }
  }, [notify])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  const abortControllerRef = useRef<AbortController | null>(null)

  // Cargar preview cuando cambia el servicio seleccionado
  const fetchPreview = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const res = await fetch(`/api/admin/incident?serviceId=${encodeURIComponent(serviceId)}`, {
        signal: controller.signal,
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al obtener el impacto de contingencia.')
      }
      setPreview(json.data)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Error al obtener el impacto de contingencia'
      setPreviewError(msg)
      setPreview(null)
    } finally {
      if (abortControllerRef.current === controller) {
        setLoadingPreview(false)
      }
    }
  }, [])

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedServiceId(val)
    setResult(null)
    if (val) {
      fetchPreview(val)
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      setPreview(null)
      setPreviewError(null)
    }
  }

  // Validación de formulario
  const isReasonValid = isIncidentReasonValid(motivo)
  const canSubmit = Boolean(selectedServiceId) && isReasonValid && !loadingPreview && !submitting

  // Disparo de inhabilitación (POST /api/admin/incident)
  const executeContingency = async () => {
    if (!selectedServiceId || !isReasonValid || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: parseInt(selectedServiceId, 10),
          motivo: motivo.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'No fue posible registrar la contingencia.')
      }

      setResult(json.data)
      setShowConfirmModal(false)
      notify('Inhabilitación por contingencia aplicada con éxito.')
      // Recargar lista de servicios y limpiar selección
      loadServices()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la contingencia'
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedService = services.find((s) => String(s.id) === selectedServiceId)
  const isAlreadyDisabled = selectedService?.estado === 'INHABILITADO'

  const formatHour = formatIncidentHour
  const formatDateString = formatIncidentDate

  return (
    <div className="demo-page p-6 max-w-6xl mx-auto space-y-6">
      <PageHeading
        eyebrow="Operaciones Críticas · RF-19"
        title="Inhabilitación por Contingencia"
        description="Gestión de incidentes mayores para inhabilitar temporalmente servicios deportivos, cancelar reservas activas y disparar el webhook de notificación a n8n."
        action={
          <Badge variant="destructive" className="flex items-center gap-1.5 py-1 px-3">
            <AlertOctagon size={14} />
            Protocolo de Emergencia
          </Badge>
        }
      />

      {/* Alerta de Protocolo y Criterios */}
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={20} />
        <div className="text-sm space-y-1">
          <p className="font-semibold">
            Cancelación administrativa inmediata y liberación de cupos (RN-12)
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            Al aplicar la inhabilitación, todas las reservas activas (pendientes o confirmadas) pasan inmediatamente a estado <code className="font-mono font-bold">CANCELADA_ADMINISTRATIVA</code>, se liberan los cupos de las franjas y se notifica vía webhook a los clientes afectados. No se emiten reembolsos bancarios automáticos; deben gestionarse por el canal administrativo correspondiente.
          </p>
        </div>
      </div>

      {result ? (
        /* Reporte de Contingencia Exitosa */
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={28} />
              <div>
                <h2 className="text-lg font-bold">Inhabilitación Procesada Exitosamente</h2>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  El servicio <span className="font-bold underline">{result.servicio.nombre}</span> ha sido inhabilitado correctamente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-emerald-500/20">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 block">Reservas Canceladas</span>
                <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                  {result.reservasCanceladas.length}
                </span>
              </div>
              <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-emerald-500/20">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 block">Notificación n8n</span>
                <span className="text-sm font-bold flex items-center gap-1.5 mt-1 text-emerald-900 dark:text-emerald-100">
                  {result.webhook.sent ? (
                    <>
                      <Send size={15} className="text-emerald-600 dark:text-emerald-400" />
                      Despachada con éxito
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={15} className="text-amber-500" />
                      Pendiente en outbox
                    </>
                  )}
                </span>
              </div>
              <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-emerald-500/20">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 block">Reembolso Automático</span>
                <span className="text-sm font-bold block mt-1 text-emerald-900 dark:text-emerald-100">
                  No aplica (Proceso manual)
                </span>
              </div>
            </div>

            {result.reservasCanceladas.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 mb-2">
                  Detalle de Reservas y Clientes Afectados
                </h3>
                <div className="max-h-60 overflow-y-auto rounded-xl border border-emerald-500/20 bg-white/70 dark:bg-zinc-900/60 divide-y divide-emerald-500/10 text-xs">
                  {result.reservasCanceladas.map((reserva) => (
                    <div key={reserva.reservaId} className="p-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {reserva.nombre} <span className="text-zinc-500 font-normal">({reserva.correo})</span>
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Fecha: {formatDateString(reserva.fecha)} · Horario: {formatHour(reserva.horaInicio)} - {formatHour(reserva.horaFin)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap font-mono text-[11px]">
                        {reserva.cantidadCupos} cupo{reserva.cantidadCupos > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <ActionButton
                onClick={() => {
                  setResult(null)
                  setSelectedServiceId('')
                  setMotivo('')
                  setPreview(null)
                }}
              >
                Inhabilitar Otro Servicio
              </ActionButton>
            </div>
          </div>
        </div>
      ) : (
        /* Formulario y Resumen Previo */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Formulario de Configuración de Incidente */}
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            <h2 className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Building2 size={18} className="text-zinc-500" />
              Parámetros de Inhabilitación
            </h2>

            {/* Selector de Servicio */}
            <div className="space-y-1.5">
              <label htmlFor="service-select" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Servicio a inhabilitar <span className="text-red-500">*</span>
              </label>
              {loadingServices ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                  <Loader2 size={15} className="animate-spin" />
                  Cargando catálogo de servicios...
                </div>
              ) : (
                <select
                  id="service-select"
                  value={selectedServiceId}
                  onChange={handleServiceChange}
                  className="w-full text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                >
                  <option value="">-- Seleccionar servicio deportivo --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.estado === 'INHABILITADO'}>
                      {s.nombre} {s.categoria ? `(${s.categoria.nombre})` : ''} — [{s.estado}]
                    </option>
                  ))}
                </select>
              )}

              {selectedService && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">Estado actual:</span>
                  <Badge variant={isAlreadyDisabled ? 'destructive' : 'success'}>
                    {selectedService.estado}
                  </Badge>
                  {isAlreadyDisabled && (
                    <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                      Este servicio ya se encuentra inhabilitado.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Motivo de la contingencia */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="incident-reason" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Motivo de contingencia <span className="text-red-500">*</span>
                </label>
                <span className={`text-[11px] ${motivo.trim().length > 255 ? 'text-red-500 font-bold' : 'text-zinc-400'}`}>
                  {motivo.trim().length}/255 caracteres
                </span>
              </div>
              <textarea
                id="incident-reason"
                rows={4}
                maxLength={255}
                value={motivo}
                onBlur={() => setMotivoTouched(true)}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explica la causa técnica o ambiental del incidente (ej. Daño crítico en sistema de bombeo, filtración o tormenta eléctrica)..."
                className="w-full text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
              />
              {motivoTouched && !isReasonValid && (
                <p className="text-xs text-red-500">
                  El motivo debe contener entre 3 y 255 caracteres.
                </p>
              )}
            </div>

            {/* Botón de acción */}
            <div className="pt-2">
              <ActionButton
                danger
                disabled={!canSubmit || isAlreadyDisabled}
                onClick={() => setShowConfirmModal(true)}
                className="w-full justify-center py-2.5 font-bold"
              >
                <ShieldAlert size={16} />
                Continuar a Confirmación de Inhabilitación
              </ActionButton>
            </div>
          </div>

          {/* Columna Derecha: Resumen Previo de Afectación (Criterio Clave) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <Users size={18} className="text-zinc-500" />
                  Impacto y Resumen Previo
                </h2>
                {selectedServiceId && (
                  <button
                    type="button"
                    onClick={() => fetchPreview(selectedServiceId)}
                    disabled={loadingPreview}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition"
                  >
                    <RefreshCw size={12} className={loadingPreview ? 'animate-spin' : ''} />
                    Actualizar
                  </button>
                )}
              </div>

              {!selectedServiceId ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
                  <Info size={28} className="mx-auto mb-2 opacity-50" />
                  Selecciona un servicio a la izquierda para calcular en tiempo real las reservas y los clientes que se verían afectados.
                </div>
              ) : loadingPreview ? (
                <div className="p-8 text-center rounded-xl border border-zinc-100 dark:border-zinc-800 text-zinc-500 text-xs space-y-2">
                  <Loader2 size={24} className="animate-spin mx-auto text-emerald-600" />
                  <p>Consultando reservas activas en la base de datos...</p>
                </div>
              ) : previewError ? (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 text-xs flex items-center gap-2">
                  <XCircle size={16} />
                  <span>{previewError}</span>
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {/* Tarjetas de métricas de impacto */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-500 block">Clientes Afectados</span>
                      <span className="text-2xl font-black text-red-600 dark:text-red-400">
                        {preview.totalClientesAfectados}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-500 block">Reservas Activas</span>
                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                        {preview.totalReservas}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-500 block">Cupos a Liberar</span>
                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                        {preview.totalCupos}
                      </span>
                    </div>
                  </div>

                  {/* Lista de reservas en riesgo */}
                  <div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                      Listado previo de reservas en riesgo de cancelación:
                    </span>
                    {preview.reservasAfectadas.length === 0 ? (
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                        No hay reservas activas en este momento. El servicio se inhabilitará sin cancelar compromisos previos.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                        {preview.reservasAfectadas.map((reserva) => (
                          <div key={reserva.reservaId} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {reserva.nombre}
                              </p>
                              <p className="text-[11px] text-zinc-500 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} /> {formatDateString(reserva.fecha)}
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {formatHour(reserva.horaInicio)} - {formatHour(reserva.horaFin)}
                                </span>
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <Badge variant={reserva.estado === 'CONFIRMADA' ? 'success' : 'warning'} className="text-[10px]">
                                {reserva.estado}
                              </Badge>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {reserva.cantidadCupos} cupo{reserva.cantidadCupos > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Explícita (Requisito Clave) */}
      {showConfirmModal && preview && selectedService && (
        <Modal
          title="Confirmar Inhabilitación por Contingencia"
          description="Por favor verifica los detalles antes de aplicar esta acción destructiva e irreversible."
          onClose={() => !submitting && setShowConfirmModal(false)}
          maxWidth="520px"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-900 dark:text-red-200 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <AlertOctagon size={16} />
                Acción Inmediata e Irreversible
              </p>
              <p className="leading-relaxed">
                Estás a punto de inhabilitar <span className="font-bold">{selectedService.nombre}</span>. Se cancelarán automáticamente <span className="font-bold">{preview.totalReservas} reservas</span> afectando a <span className="font-bold">{preview.totalClientesAfectados} clientes</span>.
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
              <span className="text-zinc-400 block text-[11px]">Motivo registrado:</span>
              <p className="font-medium text-zinc-800 dark:text-zinc-200 italic">
                &ldquo;{motivo.trim()}&rdquo;
              </p>
            </div>

            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
              Al confirmar, el sistema registrará la inhabilitación, liberará los cupos y enviará la notificación con firma HMAC al webhook de n8n.
            </p>

            <div className="form-actions pt-2 flex justify-end gap-2">
              <ActionButton
                secondary
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                danger
                disabled={submitting}
                onClick={executeContingency}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Procesando contingencia...
                  </>
                ) : (
                  'Confirmar e Inhabilitar Servicio'
                )}
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
