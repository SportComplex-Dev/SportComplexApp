'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sportcomplex/ui'
import { formatMoney } from '@sportcomplex/core'
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Edit2,
  Footprints,
  Sparkles,
  User,
  Users,
  Waves,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'
import { PosCatalogSelector } from './PosCatalogSelector'
import { PosClientForm } from './PosClientForm'
import { PosPaymentStripe } from '../billing/PosPaymentStripe'
import { PosVoucherModal } from '../billing/PosVoucherModal'
import { PosAltLinkModal } from '../billing/PosAltLinkModal'
import type { usePosSession } from '../../hooks/usePosSession'

export interface PosSaleWizardProps {
  sellerName?: string
  pos: ReturnType<typeof usePosSession>
}

export type WizardStepId = 1 | 2 | 3

export function PosSaleWizard({ sellerName, pos }: PosSaleWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStepId>(1)

  // Validaciones de paso
  const isStep1Complete = Boolean(pos.currentService && pos.selectedSlot)
  const isStep2Complete = Boolean(
    pos.clientName.trim() && pos.clientDoc.trim() && pos.clientEmail.trim(),
  )

  const handleNextToStep2 = () => {
    if (isStep1Complete) {
      setCurrentStep(2)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 120, behavior: 'smooth' })
      }
    }
  }

  const handleNextToStep3 = () => {
    if (isStep2Complete) {
      setCurrentStep(3)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 120, behavior: 'smooth' })
      }
    }
  }

  const handleStepClick = (targetStep: WizardStepId) => {
    if (targetStep === 1) {
      setCurrentStep(1)
    } else if (targetStep === 2 && isStep1Complete) {
      setCurrentStep(2)
    } else if (targetStep === 3 && isStep1Complete && isStep2Complete) {
      setCurrentStep(3)
    }
  }

  const handleResetWizard = () => {
    pos.handleResetForNextSale()
    setCurrentStep(1)
  }

  const getCategoryIcon = (category?: string): LucideIcon => {
    switch (category) {
      case 'canchas':
        return Footprints
      case 'piscinas':
        return Waves
      case 'gym':
        return Dumbbell
      case 'wellness':
        return Sparkles
      default:
        return Footprints
    }
  }

  const ServiceIcon = getCategoryIcon(pos.currentService?.category)

  return (
    <div className="flex flex-col gap-6" data-testid="pos-sale-wizard">
      {/* =========================================================================
          STEPPER INTERACTIVO DE CABECERA
      ========================================================================= */}
      <nav
        aria-label="Progreso de la venta en taquilla"
        className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-3 sm:p-4 shadow-sm"
      >
        <ol className="grid grid-cols-3 gap-2 sm:gap-4 relative">
          {/* Paso 1: Servicio y Horario */}
          <li>
            <button
              type="button"
              onClick={() => handleStepClick(1)}
              data-testid="pos-step-tab-1"
              aria-current={currentStep === 1 ? 'step' : undefined}
              className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-[#123e30] text-white shadow-md ring-2 ring-[#c9ef75]/50'
                  : isStep1Complete
                    ? 'bg-[#c9ef75]/15 text-[var(--ink)] hover:bg-[#c9ef75]/25 border border-[#c9ef75]/40'
                    : 'bg-[var(--surface-soft)] text-[var(--subtle)] hover:bg-[var(--line)]/30'
              }`}
            >
              <span
                className={`flex items-center justify-center size-7 sm:size-8 rounded-lg text-xs font-black shrink-0 transition-colors ${
                  currentStep === 1
                    ? 'bg-[#c9ef75] text-[#123e30]'
                    : isStep1Complete
                      ? 'bg-[#123e30] text-[#c9ef75]'
                      : 'bg-[var(--line)] text-[var(--subtle)]'
                }`}
              >
                {isStep1Complete && currentStep !== 1 ? (
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                ) : (
                  '1'
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate opacity-80">
                  Paso 1
                </p>
                <p className="text-xs sm:text-sm font-black truncate leading-tight">
                  Servicio y Franja
                </p>
              </div>
            </button>
          </li>

          {/* Paso 2: Datos del Cliente */}
          <li>
            <button
              type="button"
              onClick={() => handleStepClick(2)}
              data-testid="pos-step-tab-2"
              disabled={!isStep1Complete}
              aria-current={currentStep === 2 ? 'step' : undefined}
              className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl text-left transition-all ${
                !isStep1Complete
                  ? 'opacity-50 cursor-not-allowed bg-[var(--surface-soft)] text-[var(--subtle)]'
                  : currentStep === 2
                    ? 'bg-[#123e30] text-white shadow-md ring-2 ring-[#c9ef75]/50 cursor-pointer'
                    : isStep2Complete
                      ? 'bg-[#c9ef75]/15 text-[var(--ink)] hover:bg-[#c9ef75]/25 border border-[#c9ef75]/40 cursor-pointer'
                      : 'bg-[var(--surface-soft)] text-[var(--subtle)] hover:bg-[var(--line)]/30 cursor-pointer'
              }`}
            >
              <span
                className={`flex items-center justify-center size-7 sm:size-8 rounded-lg text-xs font-black shrink-0 transition-colors ${
                  currentStep === 2
                    ? 'bg-[#c9ef75] text-[#123e30]'
                    : isStep2Complete
                      ? 'bg-[#123e30] text-[#c9ef75]'
                      : 'bg-[var(--line)] text-[var(--subtle)]'
                }`}
              >
                {isStep2Complete && currentStep !== 2 ? (
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                ) : (
                  '2'
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate opacity-80">
                  Paso 2
                </p>
                <p className="text-xs sm:text-sm font-black truncate leading-tight">
                  Cliente Taquilla
                </p>
              </div>
            </button>
          </li>

          {/* Paso 3: Cobro Cashless */}
          <li>
            <button
              type="button"
              onClick={() => handleStepClick(3)}
              data-testid="pos-step-tab-3"
              disabled={!isStep1Complete || !isStep2Complete}
              aria-current={currentStep === 3 ? 'step' : undefined}
              className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl text-left transition-all ${
                !isStep1Complete || !isStep2Complete
                  ? 'opacity-50 cursor-not-allowed bg-[var(--surface-soft)] text-[var(--subtle)]'
                  : currentStep === 3
                    ? 'bg-[#123e30] text-white shadow-md ring-2 ring-[#c9ef75]/50 cursor-pointer'
                    : 'bg-[var(--surface-soft)] text-[var(--subtle)] hover:bg-[var(--line)]/30 cursor-pointer'
              }`}
            >
              <span
                className={`flex items-center justify-center size-7 sm:size-8 rounded-lg text-xs font-black shrink-0 transition-colors ${
                  currentStep === 3
                    ? 'bg-[#c9ef75] text-[#123e30]'
                    : 'bg-[var(--line)] text-[var(--subtle)]'
                }`}
              >
                3
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate opacity-80">
                  Paso 3
                </p>
                <p className="text-xs sm:text-sm font-black truncate leading-tight">
                  Cobro Stripe
                </p>
              </div>
            </button>
          </li>
        </ol>
      </nav>

      {/* =========================================================================
          CONTENIDO SECUENCIAL POR PASO
      ========================================================================= */}
      <AnimatePresence mode="wait">
        {/* ==================== PASO 1: SERVICIO Y FRANJA ==================== */}
        {currentStep === 1 && (
          <motion.div
            key="pos-wizard-step-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 flex flex-col gap-5">
                <PosCatalogSelector
                  selectedCategory={pos.selectedCategory}
                  onSelectCategory={pos.setSelectedCategory}
                  selectedServiceId={pos.selectedServiceId}
                  onSelectServiceId={pos.setSelectedServiceId}
                  selectedDate={pos.selectedDate}
                  onSelectDate={pos.setSelectedDate}
                  selectedSlot={pos.selectedSlot}
                  onSelectSlot={pos.setSelectedSlot}
                  attendees={pos.attendees}
                  onSetAttendees={pos.setAttendees}
                  filteredServices={pos.filteredServices}
                  {...(pos.currentService ? { currentService: pos.currentService } : {})}
                  todayStr={pos.todayStr}
                  availableSlots={pos.availableSlots}
                  isLoadingSlots={pos.isLoadingSlots}
                />
              </div>

              {/* Panel lateral con previsualización del ticket */}
              <div className="lg:col-span-4 flex flex-col gap-4 sticky top-6">
                <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)] overflow-hidden">
                  <CardHeader className="bg-[var(--surface-soft)] border-b border-[var(--line)] py-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ServiceIcon size={16} className="text-[#5e8b48]" />
                      Resumen de Selección
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4 text-xs">
                    {pos.currentService ? (
                      <>
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--line)]">
                          <span className="text-[10px] uppercase font-bold text-[var(--subtle)]">
                            Instalación Deportiva
                          </span>
                          <span className="text-sm font-black text-[var(--ink)]">
                            {pos.currentService.name}
                          </span>
                          <span className="text-[11px] text-[var(--subtle)]">
                            Sede {pos.currentService.sede} · Capacidad {pos.currentService.capacity} personas
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                            <span className="text-[10px] text-[var(--subtle)] flex items-center gap-1">
                              <Calendar size={12} /> Fecha
                            </span>
                            <strong className="text-[11px] text-[var(--ink)] block mt-0.5">
                              {pos.selectedDate}
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                            <span className="text-[10px] text-[var(--subtle)] flex items-center gap-1">
                              <Clock size={12} /> Horario
                            </span>
                            <strong className="text-[11px] text-[#123e30] dark:text-[#c9ef75] block mt-0.5 truncate">
                              {pos.selectedSlot || 'Sin franja'}
                            </strong>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] flex justify-between items-center">
                          <span className="text-[11px] text-[var(--subtle)] flex items-center gap-1.5">
                            <Users size={13} /> Cupos a reservar:
                          </span>
                          <strong className="text-xs text-[var(--ink)] font-bold">
                            {pos.currentService.category === 'canchas' ? '1 Cancha' : `${pos.attendees} personas`}
                          </strong>
                        </div>

                        <div className="pt-2 border-t border-[var(--line)] flex justify-between items-baseline font-bold">
                          <span className="text-xs text-[var(--subtle)]">Tarifa estimada:</span>
                          <span className="text-sm text-[#123e30] dark:text-[#c9ef75]">
                            {formatMoney(pos.subtotalBruto)} COP
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-[var(--subtle)] flex flex-col items-center gap-2">
                        <Footprints size={28} className="opacity-30" />
                        <p>Selecciona una categoría e instalación para iniciar la reserva.</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        id="btn-pos-wizard-next-step1"
                        data-testid="pos-step1-next"
                        variant="brand"
                        size="lg"
                        type="button"
                        onClick={handleNextToStep2}
                        disabled={!isStep1Complete}
                        className="w-full text-xs font-bold gap-2 justify-center shadow-md"
                      >
                        {isStep1Complete ? (
                          <>
                            Continuar con Datos del Cliente <ArrowRight size={16} />
                          </>
                        ) : (
                          'Selecciona una franja horaria para continuar'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== PASO 2: DATOS DEL CLIENTE ==================== */}
        {currentStep === 2 && (
          <motion.div
            key="pos-wizard-step-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Formulario de cliente */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <PosClientForm
                clientDoc={pos.clientDoc}
                onClientDocChange={pos.setClientDoc}
                clientName={pos.clientName}
                onClientNameChange={pos.setClientName}
                clientEmail={pos.clientEmail}
                onClientEmailChange={pos.setClientEmail}
                clientPhone={pos.clientPhone}
                onClientPhoneChange={pos.setClientPhone}
                isMember={pos.isMember}
                onIsMemberChange={pos.setIsMember}
                onQuickWalkIn={pos.handleQuickWalkIn}
              />

              {/* Botones de navegación del Paso 2 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm">
                <Button
                  id="btn-pos-wizard-back-step2"
                  data-testid="pos-step2-back"
                  variant="outline"
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full sm:w-auto text-xs gap-2"
                >
                  <ArrowLeft size={15} /> Volver a Selección de Servicio
                </Button>

                <Button
                  id="btn-pos-wizard-next-step2"
                  data-testid="pos-step2-next"
                  variant="brand"
                  size="lg"
                  type="button"
                  onClick={handleNextToStep3}
                  disabled={!isStep2Complete}
                  className="w-full sm:w-auto text-xs font-bold gap-2 shadow-md"
                >
                  {isStep2Complete ? (
                    <>
                      Continuar al Cobro Cashless <ArrowRight size={16} />
                    </>
                  ) : (
                    'Completa nombre, documento y correo'
                  )}
                </Button>
              </div>
            </div>

            {/* Resumen lateral de lo seleccionado en Paso 1 */}
            <div className="lg:col-span-5 flex flex-col gap-4 sticky top-6">
              <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
                <CardHeader className="bg-[var(--surface-soft)] border-b border-[var(--line)] py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-[#5e8b48]" />
                      Instalación Confirmada
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      className="text-[11px] h-7 px-2 gap-1 text-[var(--subtle)] hover:text-[var(--ink)]"
                    >
                      <Edit2 size={12} /> Modificar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--line)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--subtle)] block">
                      Servicio Seleccionado
                    </span>
                    <strong className="text-sm text-[var(--ink)]">
                      {pos.currentService?.name}
                    </strong>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--subtle)]">
                      <span>Sede {pos.currentService?.sede}</span>
                      <span>•</span>
                      <span>
                        {pos.currentService?.category === 'canchas' ? '1 Cancha' : `${pos.attendees} cupos`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                      <span className="text-[10px] text-[var(--subtle)] flex items-center gap-1">
                        <Calendar size={12} /> Fecha
                      </span>
                      <strong className="text-[11px] text-[var(--ink)] block mt-0.5">
                        {pos.selectedDate}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                      <span className="text-[10px] text-[var(--subtle)] flex items-center gap-1">
                        <Clock size={12} /> Horario
                      </span>
                      <strong className="text-[11px] text-[#123e30] dark:text-[#c9ef75] block mt-0.5 truncate">
                        {pos.selectedSlot}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-[#c9ef75]/30 bg-[#c9ef75]/5 text-[11px] flex items-center justify-between">
                    <span className="text-[var(--ink)] font-medium">Tarifa del servicio:</span>
                    <strong className="text-xs text-[#123e30] dark:text-[#c9ef75]">
                      {formatMoney(pos.subtotalBruto)} COP
                    </strong>
                  </div>

                  {pos.isMember && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-2">
                      <Sparkles size={14} className="shrink-0" />
                      <span>Socio identificado: aplicará 30% de descuento en el paso final.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ==================== PASO 3: COBRO CASHLESS ==================== */}
        {currentStep === 3 && (
          <motion.div
            key="pos-wizard-step-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Resumen lateral consolidado de la reserva completa */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
                <CardHeader className="bg-[var(--surface-soft)] border-b border-[var(--line)] py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-[#5e8b48]" />
                      Orden Consolidada
                    </CardTitle>
                    <Badge variant="success" className="text-[10px]">
                      Listo para cobro
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-4 text-xs">
                  {/* Resumen de servicio */}
                  <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--line)] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[var(--subtle)]">
                        Instalación
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                        className="text-[10px] h-6 px-1.5 gap-1 text-[var(--subtle)] hover:text-[var(--ink)]"
                      >
                        <Edit2 size={11} /> Cambiar
                      </Button>
                    </div>
                    <strong className="text-sm text-[var(--ink)]">{pos.currentService?.name}</strong>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--subtle)]">
                      <span>{pos.selectedDate}</span>
                      <span>•</span>
                      <span className="font-semibold text-[#123e30] dark:text-[#c9ef75]">
                        {pos.selectedSlot}
                      </span>
                    </div>
                  </div>

                  {/* Resumen de cliente */}
                  <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--line)] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[var(--subtle)]">
                        Titular de Reserva
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                        className="text-[10px] h-6 px-1.5 gap-1 text-[var(--subtle)] hover:text-[var(--ink)]"
                      >
                        <Edit2 size={11} /> Editar
                      </Button>
                    </div>
                    <strong className="text-sm text-[var(--ink)] flex items-center gap-1.5">
                      <User size={14} className="text-[var(--subtle)]" />
                      {pos.clientName}
                    </strong>
                    <div className="text-[11px] text-[var(--subtle)] flex flex-col gap-0.5">
                      <span>C.C. / Doc: {pos.clientDoc}</span>
                      <span>Email: {pos.clientEmail}</span>
                      {pos.clientPhone && <span>Tel: {pos.clientPhone}</span>}
                    </div>
                    <div className="pt-1 mt-1 border-t border-[var(--line)]">
                      {pos.isMember ? (
                        <Badge variant="success" className="text-[10px]">
                          Socio Activo (Descuento 30%)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Cliente Ocasional / General
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Botón para regresar al paso 2 */}
                  <Button
                    id="btn-pos-wizard-back-step3"
                    data-testid="pos-step3-back"
                    variant="outline"
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full text-xs gap-2"
                  >
                    <ArrowLeft size={15} /> Modificar Datos del Cliente
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Módulo de cobro Stripe */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <PosPaymentStripe
                {...(pos.currentService ? { currentService: pos.currentService } : {})}
                subtotalBruto={pos.subtotalBruto}
                descuentoMonto={pos.descuentoMonto}
                subtotalNeto={pos.subtotalNeto}
                ivaMonto={pos.ivaMonto}
                totalFinal={pos.totalFinal}
                isMember={pos.isMember}
                isProcessing={pos.isProcessing}
                processStep={pos.processStep}
                onProcessPayment={pos.handleProcessStripePayment}
                onGenerateAltLink={pos.handleGenerateAltLink}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODALES DE COMPROBANTE Y ENLACE ALTERNATIVO
      ========================================================================= */}
      {pos.confirmedBooking && (
        <PosVoucherModal
          booking={pos.confirmedBooking}
          {...(sellerName ? { sellerName } : {})}
          receiptQrUrl={pos.receiptQrUrl}
          onPrint={() => window.print()}
          onNextSale={handleResetWizard}
        />
      )}

      <PosAltLinkModal
        isOpen={pos.isAltLinkModalOpen}
        onClose={() => pos.setIsAltLinkModalOpen(false)}
        altLinkUrl={pos.altLinkUrl}
        altLinkQrUrl={pos.altLinkQrUrl}
        copiedLink={pos.copiedLink}
        onCopyLink={pos.handleCopyLink}
      />
    </div>
  )
}
