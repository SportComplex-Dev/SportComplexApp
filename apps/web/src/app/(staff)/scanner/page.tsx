"use client";

import React from "react";
import { AlertTriangle, LogOut, QrCode, User } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@sportcomplex/ui";
import {
  ConsultationResultCard,
  ScannerHeader,
  TicketValidationModal,
  ZoneMismatchScreen,
  useScannerController,
  ConsultationModeCard,
  OfflineBanner,
  ScannerCameraView,
  ManualEntryCard,
  ShiftScannerView,
} from "@sportcomplex/features-scanner";
import { useOptionalApp } from "@/components/layout/app-provider";

export default function ScannerPage() {
  const c = useScannerController();
  const app = useOptionalApp();
  const session = app?.session;
  const logout = app?.logout;

  return (
    <main data-scanner-theme={c.theme} className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#123e30]/10 text-[#123e30] dark:bg-[#d9f29f]/10 dark:text-[#d9f29f]">
                <QrCode className="size-6" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Control de Acceso</h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                role="status" aria-live="polite" data-testid="network-status-indicator"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  c.isOnline
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                <span className={`size-2 rounded-full ${c.isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                {c.isOnline ? "En línea" : "Sin conexión"}
              </span>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                <User className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
                <span>{session?.name || "Lector Portería"}</span>
              </div>
              <Badge variant="admin">Staff Portería</Badge>
              {logout && (
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                  data-testid="scanner-logout-button"
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--subtle)]">
            Consulta y verificación de boletos para el personal de acceso de AKROS Club.
          </p>
        </header>

        {!c.isOnline && <OfflineBanner />}

        <ConsultationModeCard isConsultationMode={c.isConsultationMode} onToggle={c.toggleConsultationMode} />

        {c.isConsultationMode ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {c.ticketData && (
              <ConsultationResultCard
                ticket={c.ticketData.ticket} modo={c.ticketData.modo}
                isCached={Boolean(c.ticketData.isCached)} onReset={c.handleResetConsulta}
              />
            )}
            {c.consultationError && !c.ticketData && (
              <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">No se pudo verificar el boleto</p>
                    <p>{c.consultationError}</p>
                    <Button variant="outline" size="sm" onClick={c.handleResetConsulta} className="mt-2 text-xs">
                      Intentar nuevamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {!c.ticketData && (
              <div className="space-y-4">
                <ScannerCameraView
                  consultationCameraActive={c.consultationCameraActive}
                  consultationLoading={c.consultationLoading}
                  consultationCameraError={c.consultationCameraError}
                  onStartCamera={c.iniciarCamaraConsulta}
                  onStopCamera={c.detenerCamaraConsulta}
                />
                <ManualEntryCard
                  showManualInput={c.showManualInput} setShowManualInput={c.setShowManualInput}
                  manualPayload={c.manualPayload} setManualPayload={c.setManualPayload}
                  manualTicketId={c.manualTicketId} setManualTicketId={c.setManualTicketId}
                  manualSignature={c.manualSignature} setManualSignature={c.setManualSignature}
                  consultationLoading={c.consultationLoading} onSubmit={c.handleManualSubmit}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <ScannerHeader
              activeShift={c.activeShift} audioEnabled={c.audioEnabled} theme={c.theme}
              employeeName={session?.name || "Lector Portería"} onLogout={logout}
              onToggleAudio={c.toggleAudio} onToggleTheme={c.toggleTheme} onChangeShift={c.handleChangeShift}
            />
            <ShiftScannerView
              activeShift={c.activeShift} shiftOptions={c.shiftOptions} selectedShiftId={c.selectedShiftId}
              isLoadingShifts={c.isLoadingShifts} shiftLoadError={c.shiftLoadError} flowState={c.flowState}
              facingMode={c.facingMode} cameraToast={c.cameraToast} onSelectShift={c.handleSelectShift}
              onToggleFacingMode={c.toggleFacingMode} onOpenCamera={c.handleOpenCameraTurno}
              onScan={c.handleScanTurno} onCameraError={c.handleCameraErrorTurno}
            />
            <TicketValidationModal
              isOpen={c.isModalOpen} state={c.flowState} ticket={c.ticket} message={c.modalMessage}
              employeeName={session?.name ?? ""} isRedeeming={c.isRedeeming} isOnline={c.isOnline}
              onClose={c.handleScanNextTurno} onRedeem={c.handleRedeem} onScanNext={c.handleScanNextTurno}
            />
            {c.zoneMismatch && c.activeShift && (
              <ZoneMismatchScreen
                message={c.zoneMismatch.message} ticketId={c.zoneMismatch.ticketId}
                postServiceName={c.activeShift.courtName} onContinue={c.handleScanNextTurno}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
