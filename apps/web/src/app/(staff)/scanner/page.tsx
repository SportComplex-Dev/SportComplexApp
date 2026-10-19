"use client";

import React from "react";
import { AlertTriangle, QrCode } from "lucide-react";
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
  ExpiredSlotScreen,
} from "@sportcomplex/features-scanner";
import { useOptionalApp } from "@/components/layout/app-provider";

export default function ScannerPage() {
  const c = useScannerController();
  const app = useOptionalApp();
  const session = app?.session;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __scannerScanTurno?: (payload: string) => void }).__scannerScanTurno = c.handleScanTurno;
    }
  }, [c.handleScanTurno]);

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
              <Badge variant="admin">Staff Portería</Badge>
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
              onToggleAudio={c.toggleAudio} onToggleTheme={c.toggleTheme} onChangeShift={c.handleChangeShift}
            />
            <ShiftScannerView
              activeShift={c.activeShift} shiftOptions={c.shiftOptions} selectedShiftId={c.selectedShiftId}
              isLoadingShifts={c.isLoadingShifts} shiftLoadError={c.shiftLoadError} flowState={c.flowState}
              facingMode={c.facingMode} cameraToast={c.cameraToast} onSelectShift={c.handleSelectShift}
              onToggleFacingMode={c.toggleFacingMode} onOpenCamera={c.handleOpenCameraTurno}
              onScan={c.handleScanTurno} onCameraError={c.handleCameraErrorTurno}
            />
            <div className="max-w-4xl mx-auto">
              <ManualEntryCard
                showManualInput={c.showManualInput} setShowManualInput={c.setShowManualInput}
                manualPayload={c.manualPayload} setManualPayload={c.setManualPayload}
                manualTicketId={c.manualTicketId} setManualTicketId={c.setManualTicketId}
                manualSignature={c.manualSignature} setManualSignature={c.setManualSignature}
                consultationLoading={c.isRedeeming} onSubmit={c.handleManualSubmit}
              />
            </div>
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
            {c.expiredSlot && (
              <ExpiredSlotScreen
                userName={c.expiredSlot.userName}
                ticketId={c.expiredSlot.ticketId}
                reservationId={c.expiredSlot.reservationId}
                targetCourtName={c.expiredSlot.targetCourtName}
                expiredDetails={c.expiredSlot.expiredDetails}
                message={c.expiredSlot.message}
                onContinue={() => {
                  c.setExpiredSlot(null);
                  c.handleScanNextTurno();
                }}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
