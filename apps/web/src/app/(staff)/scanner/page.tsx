"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  Info,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  WifiOff,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@sportcomplex/ui";
import { parseTicketQr } from "@/lib/qr-client";
import {
  ConsultationResultCard,
  type TicketInfo,
} from "@/components/scanner/consultation-result-card";
import { QrCameraViewport } from "@/components/scanner/qr-camera-viewport";
import { ScannerHeader } from "@/components/scanner/scanner-header";
import { ShiftSelector } from "@/components/scanner/shift-selector";
import { TicketValidationModal } from "@/components/scanner/ticket-validation-modal";
import {
  type ScannerFlowState,
  type ScannedTicket,
  type ShiftOption,
  type RedeemTicketResponse,
  scannerService,
} from "@/components/scanner/scanner.service";
import { useAudioFeedback } from "@/components/scanner/use-audio-feedback";
import { useOptionalApp } from "@/components/app-provider";

interface VerifyResponseData {
  access: "GRANTED" | "DENIED";
  modo: "CONSULTA" | "TURNO";
  resultado: string;
  canjeado: boolean;
  lecturaId?: string;
  ticket: TicketInfo;
}

export default function ScannerPage() {
  // TSK-FE-15: Modo Consulta Informativo sin puesto asignado (activo por defecto)
  const [isConsultationMode, setIsConsultationMode] = useState<boolean>(true);
  const [ticketData, setTicketData] = useState<VerifyResponseData | null>(null);
  const [consultationLoading, setConsultationLoading] = useState<boolean>(false);
  const [consultationError, setConsultationError] = useState<string | null>(null);

  // Cámara para Modo Consulta
  const [consultationCameraActive, setConsultationCameraActive] = useState<boolean>(false);
  const [consultationCameraError, setConsultationCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  // Entrada manual para simulación / QA
  const [manualPayload, setManualPayload] = useState<string>("");
  const [manualTicketId, setManualTicketId] = useState<string>("");
  const [manualSignature, setManualSignature] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // TSK-FE-14: Modo Turno con selección de puesto y canje
  const [flowState, setFlowState] = useState<ScannerFlowState>("idle");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(true);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftOption | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [ticket, setTicket] = useState<ScannedTicket | null>(null);
  const [modalMessage, setModalMessage] = useState<string>(
    "Se debe validar el QR para confirmar acceso.",
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const [cameraToast, setCameraToast] = useState<string | null>(null);

  const { activateAudio, playSuccess, playError } = useAudioFeedback(audioEnabled);
  const app = useOptionalApp();
  const session = app?.session;

  // Cargar servicios / turnos para Modo Turno
  useEffect(() => {
    let isCurrent = true;

    scannerService
      .getShiftOptions()
      .then((options) => {
        if (isCurrent) setShiftOptions(options);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setShiftLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los servicios de acceso.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingShifts(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Funciones de Modo Consulta Informativo (TSK-FE-15)
  // --------------------------------------------------------------------------
  const detenerCamaraConsulta = useCallback(() => {
    if (html5QrCodeRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qrScanner = html5QrCodeRef.current as any;
      if (qrScanner.isScanning) {
        qrScanner
          .stop()
          .then(() => {
            setConsultationCameraActive(false);
          })
          .catch(() => {
            setConsultationCameraActive(false);
          });
      } else {
        setConsultationCameraActive(false);
      }
    }
  }, []);

  const consultarTicket = useCallback(
    async (ticketId: string, signature: string) => {
      setConsultationLoading(true);
      setConsultationError(null);

      detenerCamaraConsulta();

      try {
        const response = await fetch(
          `/api/tickets/verify/${encodeURIComponent(ticketId.trim())}`,
          {
            method: "GET",
            headers: {
              "x-ticket-signature": signature.trim(),
            },
          },
        );

        const json = await response.json();

        if (!response.ok || !json.success) {
          const errorMsg =
            json?.error?.message ||
            "Código no válido o no se pudo verificar la autenticidad del boleto.";
          setConsultationError(errorMsg);
          setTicketData(null);
          return;
        }

        setTicketData(json.data);
      } catch {
        setConsultationError("Error de conexión al consultar el servicio de accesos.");
        setTicketData(null);
      } finally {
        setConsultationLoading(false);
      }
    },
    [detenerCamaraConsulta],
  );

  const procesarTextoEscaneadoConsulta = useCallback(
    (rawText: string) => {
      const parsed = parseTicketQr(rawText);
      if (!parsed) {
        setConsultationError(
          "Formato de QR no reconocido. Debe contener el identificador y la firma HMAC autorizada.",
        );
        return;
      }
      void consultarTicket(parsed.ticketId, parsed.signature);
    },
    [consultarTicket],
  );

  const iniciarCamaraConsulta = async () => {
    setConsultationCameraError(null);
    setConsultationError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qrScanner = html5QrCodeRef.current as any;

      if (qrScanner.isScanning) {
        await qrScanner.stop();
      }

      await qrScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          procesarTextoEscaneadoConsulta(decodedText);
        },
        () => {},
      );

      setConsultationCameraActive(true);
    } catch (err: unknown) {
      console.warn("No se pudo iniciar la cámara web:", err);
      setConsultationCameraError(
        "No se pudo acceder a la cámara. Puedes utilizar el ingreso manual para consultar el boleto.",
      );
      setConsultationCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      detenerCamaraConsulta();
    };
  }, [detenerCamaraConsulta]);

  const handleResetConsulta = () => {
    setTicketData(null);
    setConsultationError(null);
    setManualPayload("");
    setManualTicketId("");
    setManualSignature("");
  };

  // --------------------------------------------------------------------------
  // Funciones de Modo Turno / Canje (TSK-FE-14)
  // --------------------------------------------------------------------------
  const setStateAndMessage = useCallback(
    (nextState: ScannerFlowState, nextMessage: string) => {
      setFlowState(nextState);
      setModalMessage(nextMessage);
    },
    [],
  );

  const handleSelectShift = useCallback((shift: ShiftOption) => {
    setSelectedShiftId(shift.id);
    setActiveShift(shift);
    setTicket(null);
    setIsModalOpen(false);
    setCameraToast(null);
    setFlowState("configuring-shift");
  }, []);

  const handleOpenCameraTurno = useCallback(() => {
    if (
      !activeShift ||
      !Number.isInteger(activeShift.postServiceId) ||
      activeShift.postServiceId <= 0
    ) {
      return;
    }

    setFlowState("starting-camera");
    setCameraToast("Preparando la cámara del puesto seleccionado...");
  }, [activeShift]);

  const handleChangeShift = useCallback(() => {
    setSelectedShiftId(null);
    setActiveShift(null);
    setTicket(null);
    setIsModalOpen(false);
    setFlowState("idle");
    setCameraToast(null);
    setModalMessage("Se debe validar el QR para confirmar acceso.");
  }, []);

  useEffect(() => {
    if (!activeShift) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (flowState === "configuring-shift" || flowState === "starting-camera") {
        setFlowState("starting-camera");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeShift, flowState]);

  const handleScanTurno = useCallback(
    (rawQr: string) => {
      if (
        !activeShift ||
        !Number.isInteger(activeShift.postServiceId) ||
        activeShift.postServiceId <= 0
      )
        return;

      setIsModalOpen(true);
      const parsed = scannerService.parseTicket(rawQr);
      if (!parsed) {
        setTicket(null);
        setStateAndMessage(
          "ticket-invalid",
          "El QR no contiene un ticket firmado válido (SC1, UUID y firma HMAC).",
        );
        if (audioEnabled) playError();
        return;
      }

      setTicket(parsed);
      setStateAndMessage(
        "ticket-valid",
        "Confirma el canje para validar el acceso con el servidor.",
      );
    },
    [activeShift, audioEnabled, playError, setStateAndMessage],
  );

  const handleRedeem = useCallback(async () => {
    if (
      !ticket ||
      !activeShift ||
      !Number.isInteger(activeShift.postServiceId) ||
      activeShift.postServiceId <= 0
    )
      return;

    setFlowState("redeeming");
    setIsRedeeming(true);
    setModalMessage("Registrando acceso y confirmando el paso del cliente...");

    try {
      const result: RedeemTicketResponse = await scannerService.redeemTicket(
        ticket,
        activeShift.postServiceId,
      );
      setTicket({ ...ticket, result });
      if (result.access === "DENIED") {
        const message =
          result.code === "ALREADY_USED"
            ? "Boleto ya utilizado anteriormente."
            : result.code === "SERVICE_MISMATCH"
              ? (result.message ?? "El ticket pertenece a otro escenario deportivo.")
              : result.code === "WINDOW_EXPIRED"
                ? (result.message ?? "Franja horaria vencida o no disponible.")
                : (result.message ?? "El acceso fue denegado.");
        setStateAndMessage("access-denied", message);
        if (audioEnabled) {
          playError();
        }
        return;
      }

      setStateAndMessage(
        "access-granted",
        result.message ?? "Acceso concedido y canje registrado.",
      );
      if (audioEnabled) {
        playSuccess();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? `No se pudo registrar el canje: ${error.message}`
          : "No se pudo registrar el canje por un error de conexión.";
      setStateAndMessage("redeem-error", message);
      if (audioEnabled) {
        playError();
      }
    } finally {
      setIsRedeeming(false);
    }
  }, [activeShift, audioEnabled, playError, playSuccess, setStateAndMessage, ticket]);

  const handleCameraErrorTurno = useCallback(
    (message: string) => {
      setCameraToast(message);
      setFlowState("camera-error");
      setStateAndMessage("camera-error", message);
    },
    [setStateAndMessage],
  );

  const handleScanNextTurno = useCallback(() => {
    setTicket(null);
    setIsModalOpen(false);
    setFlowState("scanning");
    setModalMessage("Escaneando siguiente QR...");
  }, []);

  const canStartCameraTurno = Boolean(
    activeShift &&
      Number.isInteger(activeShift.postServiceId) &&
      activeShift.postServiceId > 0 &&
      (flowState === "starting-camera" || flowState === "scanning"),
  );

  // --------------------------------------------------------------------------
  // Submit manual unificado (QA & Pruebas)
  // --------------------------------------------------------------------------
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = manualPayload.trim();
    const ticketId = manualTicketId.trim();
    const signature = manualSignature.trim();

    if (isConsultationMode) {
      if (payload) {
        procesarTextoEscaneadoConsulta(payload);
        return;
      }
      if (ticketId && signature) {
        void consultarTicket(ticketId, signature);
        return;
      }
      setConsultationError(
        "Por favor ingresa el payload QR o el Código y Firma correspondientes.",
      );
    } else {
      if (payload) {
        handleScanTurno(payload);
        return;
      }
      if (ticketId && signature) {
        handleScanTurno(`SC1:${ticketId}:${signature}`);
        return;
      }
      setStateAndMessage(
        "ticket-invalid",
        "Por favor ingresa el payload QR o el Código y Firma correspondientes.",
      );
      setIsModalOpen(true);
    }
  };

  return (
    <main
      data-scanner-theme={theme}
      className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] p-4 sm:p-6 lg:p-8"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Encabezado Principal */}
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#123e30]/10 text-[#123e30] dark:bg-[#d9f29f]/10 dark:text-[#d9f29f]">
                <QrCode className="size-6" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Control de Acceso
              </h1>
            </div>

            {/* Badge de rol / vista */}
            <Badge variant="admin">Staff Portería</Badge>
          </div>
          <p className="text-sm text-[var(--subtle)]">
            Consulta y verificación de boletos para el personal de acceso de AKROS Club.
          </p>
        </header>

        {/* Control del Modo Consulta (TSK-FE-15 / RF-13) */}
        <Card className="border-[var(--brand-border)] bg-[var(--surface)] shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Eye className="size-4 text-[#123e30] dark:text-[#c9ef75]" />
                  Modo Consulta Informativo
                </CardTitle>
                <CardDescription className="text-xs">
                  {isConsultationMode
                    ? "Sin puesto asignado: consulta informativa sin alterar el estado ni descontar boletos."
                    : "Modo Turno: requiere puesto asignado para registrar accesos."}
                </CardDescription>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => {
                  detenerCamaraConsulta();
                  setIsConsultationMode((prev) => !prev);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--brand-border)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
                aria-label="Alternar modo consulta"
              >
                {isConsultationMode ? (
                  <ToggleRight className="size-6 text-[#123e30] dark:text-[#c9ef75]" />
                ) : (
                  <ToggleLeft className="size-6 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold select-none">
                  {isConsultationMode ? "Activado" : "Desactivado"}
                </span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-0 text-xs">
            {isConsultationMode ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#123e30]/5 dark:bg-[#d9f29f]/5 border border-[#123e30]/10 dark:border-[#d9f29f]/10 text-[var(--subtle)]">
                <Info className="size-4 shrink-0 text-[#123e30] dark:text-[#c9ef75] mt-0.5" />
                <p>
                  <strong>Puesto asignado: Ninguno.</strong> En esta modalidad, las lecturas auditan{" "}
                  <code className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono text-[11px]">
                    CONSULTA
                  </code>{" "}
                  en el servidor. El boleto permanece en su estado original (
                  <strong>EMITIDO</strong>).
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p>
                  El modo turno requiere un puesto fijo asignado por el sistema. Si no cuentas con
                  un puesto asignado para este turno, activa el <strong>Modo Consulta</strong> para
                  verificar las reservas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* VISTA 1: MODO CONSULTA INFORMATIVO (TSK-FE-15)                             */}
        {/* ========================================================================= */}
        {isConsultationMode && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Vista de Resultado Informativo (Si hay ticket verificado) */}
            {ticketData && (
              <ConsultationResultCard
                ticket={ticketData.ticket}
                modo={ticketData.modo}
                onReset={handleResetConsulta}
              />
            )}

            {/* Mensaje de Error si la consulta falló */}
            {consultationError && !ticketData && (
              <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">No se pudo verificar el boleto</p>
                    <p>{consultationError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetConsulta}
                      className="mt-2 text-xs"
                    >
                      Intentar nuevamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sección del Escáner QR con Cámara (Visible si no hay ticket seleccionado) */}
            {!ticketData && (
              <div className="space-y-4">
                <Card className="border-[var(--brand-border)] bg-[var(--surface)] shadow-xs overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Camera className="size-4" />
                          Lector de Cámara
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Enfoca el código QR del cliente con la cámara de tu dispositivo.
                        </CardDescription>
                      </div>

                      <Button
                        variant={consultationCameraActive ? "destructive" : "default"}
                        size="sm"
                        onClick={
                          consultationCameraActive
                            ? detenerCamaraConsulta
                            : iniciarCamaraConsulta
                        }
                        disabled={consultationLoading}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {consultationCameraActive ? (
                          <>
                            <CameraOff className="size-3.5" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Camera className="size-3.5" />
                            Iniciar cámara
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Contenedor DOM para html5-qrcode */}
                    <div
                      id="qr-reader"
                      className={`w-full overflow-hidden rounded-xl border border-[var(--brand-border)] bg-black/5 dark:bg-black/40 min-h-[260px] flex items-center justify-center ${
                        consultationCameraActive ? "block" : "hidden"
                      }`}
                    />

                    {!consultationCameraActive && (
                      <div className="p-8 border border-dashed border-[var(--brand-border)] rounded-xl flex flex-col items-center justify-center text-center space-y-2 text-[var(--subtle)]">
                        <QrCode className="size-10 text-muted-foreground/60" />
                        <p className="text-xs">
                          La cámara se encuentra pausada. Haz clic en <strong>Iniciar cámara</strong> o usa
                          el ingreso manual.
                        </p>
                      </div>
                    )}

                    {consultationCameraError && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {consultationCameraError}
                      </p>
                    )}

                    {consultationLoading && (
                      <div className="p-4 rounded-lg bg-[var(--surface-soft)] text-xs flex items-center justify-center gap-2 text-[var(--subtle)]">
                        <RefreshCw className="size-4 animate-spin text-[#123e30] dark:text-[#c9ef75]" />
                        <span>Consultando información en el servidor...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Alternativa: Ingreso manual / Simulación de escaneo (QA & Testing) */}
                <Card className="border-[var(--brand-border)] bg-[var(--surface)] shadow-xs">
                  <CardHeader
                    className="py-3 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors rounded-t-xl"
                    onClick={() => setShowManualInput((prev) => !prev)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--subtle)]">
                        <Sparkles className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
                        <span>Ingreso manual / Simulación para pruebas (QA)</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {showManualInput ? "Ocultar" : "Mostrar"}
                      </span>
                    </div>
                  </CardHeader>

                  {showManualInput && (
                    <CardContent className="pt-2 pb-4 space-y-3">
                      <form onSubmit={handleManualSubmit} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[var(--subtle)]">
                            Payload QR completo (ej. SC1:&lt;uuid&gt;:&lt;firma&gt;)
                          </label>
                          <Input
                            placeholder="SC1:9f0d6f4e-0000-4000-8000-0000000000ff:..."
                            value={manualPayload}
                            onChange={(e) => setManualPayload(e.target.value)}
                            className="text-xs font-mono"
                          />
                        </div>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-[var(--brand-border)]" />
                          <span className="shrink mx-2 text-[10px] text-muted-foreground uppercase font-semibold">
                            o por campos separados
                          </span>
                          <div className="flex-grow border-t border-[var(--brand-border)]" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--subtle)]">
                              Código UUID del Ticket
                            </label>
                            <Input
                              placeholder="9f0d6f4e-0000-4000-8000-0000000000ff"
                              value={manualTicketId}
                              onChange={(e) => setManualTicketId(e.target.value)}
                              className="text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--subtle)]">
                              Firma HMAC (64 caracteres hex)
                            </label>
                            <Input
                              placeholder="64 caracteres hexadecimales"
                              value={manualSignature}
                              onChange={(e) => setManualSignature(e.target.value)}
                              className="text-xs font-mono"
                            />
                          </div>
                        </div>

                        <Button
                          type="submit"
                          variant="default"
                          size="sm"
                          disabled={consultationLoading}
                          className="w-full text-xs"
                        >
                          {consultationLoading ? "Consultando..." : "Consultar Tiquete"}
                        </Button>
                      </form>
                    </CardContent>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA 2: MODO TURNO / CANJE DE ACCESOS (TSK-FE-14)                         */}
        {/* ========================================================================= */}
        {!isConsultationMode && (
          <div className="space-y-6">
            <ScannerHeader
              activeShift={activeShift}
              audioEnabled={audioEnabled}
              theme={theme}
              onToggleAudio={() => {
                if (!audioEnabled) activateAudio();
                setAudioEnabled((current) => !current);
              }}
              onToggleTheme={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
              onChangeShift={handleChangeShift}
            />

            {!activeShift ? (
              <section className="px-4 pb-10 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                  <ShiftSelector
                    options={shiftOptions}
                    selectedId={selectedShiftId}
                    isLoading={isLoadingShifts}
                    loadError={shiftLoadError}
                    onSelect={handleSelectShift}
                  />
                </div>
              </section>
            ) : (
              <section className="px-4 pb-10 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                  <div className="mb-5 flex flex-col gap-3 rounded-[26px] border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                        Puesto confirmado
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-brand-text">
                        {activeShift.label} · {activeShift.courtName}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFacingMode((current) =>
                            current === "environment" ? "user" : "environment",
                          )
                        }
                        className="rounded-full border border-brand-border bg-brand-control px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                      >
                        Cambiar cámara
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCameraTurno}
                        disabled={
                          !Number.isInteger(activeShift.postServiceId) ||
                          activeShift.postServiceId <= 0
                        }
                        className="rounded-full bg-brand-accent px-4 py-2 text-xs font-bold text-brand-on-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                      >
                        {flowState === "scanning" ? "Cámara activa" : "Iniciar cámara"}
                      </button>
                    </div>
                  </div>

                  {cameraToast ? (
                    <div
                      role="alert"
                      className="mb-4 flex items-center gap-2 rounded-2xl border border-brand-danger-border bg-brand-danger-bg px-4 py-3 text-sm text-brand-danger-text"
                    >
                      <WifiOff className="h-4 w-4" />
                      {cameraToast}
                    </div>
                  ) : null}

                  <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
                    <div>
                      <QrCameraViewport
                        enabled={canStartCameraTurno}
                        facingMode={facingMode}
                        onScan={handleScanTurno}
                        onCameraError={handleCameraErrorTurno}
                      />
                    </div>

                    <motion.aside
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-[28px] border border-brand-border bg-brand-surface p-5"
                    >
                      <div className="mb-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                          Estado del turno
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-brand-text">
                          {activeShift.courtName}
                        </h3>
                      </div>

                      <div className="space-y-3 text-sm text-brand-muted">
                        <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                          <span>ID del puesto/servicio</span>
                          <span className="font-semibold text-brand-text">
                            {activeShift.postServiceId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                          <span>Validación</span>
                          <span className="font-semibold text-brand-accent">
                            {flowState}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                          {flowState === "scanning" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <ShieldAlert className="h-4 w-4" />
                          )}
                          {flowState === "scanning" ? "Escaneando activo" : "Esperando QR"}
                        </div>
                        <p className="mt-2 text-sm text-brand-text">
                          {flowState === "scanning"
                            ? "Apunte al QR firmado del ticket para confirmar el canje."
                            : "Seleccione un puesto/servicio válido para habilitar la lectura."}
                        </p>
                      </div>
                    </motion.aside>
                  </div>
                </div>
              </section>
            )}

            <TicketValidationModal
              isOpen={isModalOpen}
              state={flowState}
              ticket={ticket}
              message={modalMessage}
              employeeName={session?.name ?? ""}
              isRedeeming={isRedeeming}
              onClose={handleScanNextTurno}
              onRedeem={handleRedeem}
              onScanNext={handleScanNextTurno}
              postServiceName={activeShift?.courtName}
            />
          </div>
        )}
      </div>
    </main>
  );
}
