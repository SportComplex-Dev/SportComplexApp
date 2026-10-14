"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseTicketQr } from "@/lib/qr-client";
import {
  type ScannerFlowState,
  type ScannedTicket,
  type ShiftOption,
  type RedeemTicketResponse,
  scannerService,
} from "@/components/scanner/scanner.service";
import { useAudioFeedback } from "@/components/scanner/use-audio-feedback";
import {
  HttpError,
  isTransientNetworkError,
  useNetworkResilience,
} from "@/hooks/use-network-resilience";
import type { VerifyResponseData } from "@/app/(staff)/scanner/types";

export function useScannerController() {
  const { isOnline, executeWithRetry, getCachedTicket, setCachedTicket } =
    useNetworkResilience();

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

  // TSK-FE-16: alerta roja de discrepancia de zona (403 SERVICE_MISMATCH)
  const [zoneMismatch, setZoneMismatch] = useState<{
    message: string;
    ticketId: string;
  } | null>(null);

  const { activateAudio, playSuccess, playError } = useAudioFeedback(audioEnabled);

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
      const cleanId = ticketId.trim();
      const cleanSig = signature.trim();

      setConsultationLoading(true);
      setConsultationError(null);

      detenerCamaraConsulta();

      try {
        const json = await executeWithRetry(async () => {
          const res = await fetch(
            `/api/tickets/verify/${encodeURIComponent(cleanId)}`,
            {
              method: "GET",
              headers: {
                "x-ticket-signature": cleanSig,
              },
            },
          );

          if (!res.ok) {
            const errorPayload = await res.json().catch(() => null);
            throw new HttpError(
              errorPayload?.error?.message ||
                "Código no válido o no se pudo verificar la autenticidad del boleto.",
              res.status,
            );
          }

          return await res.json();
        });

        if (!json.success || !json.data) {
          const errorMsg =
            json?.error?.message ||
            "Código no válido o no se pudo verificar la autenticidad del boleto.";
          setConsultationError(errorMsg);
          setTicketData(null);
          return;
        }

        const verifiedTicket = json.data.ticket;
        setCachedTicket(cleanId, {
          ticketId: verifiedTicket.id,
          titularNombre: verifiedTicket.titularNombre,
          servicioNombre: verifiedTicket.servicioNombre,
          fecha: verifiedTicket.fecha,
          horaInicio: verifiedTicket.horaInicio,
          horaFin: verifiedTicket.horaFin,
          cachedAt: new Date().toISOString(),
        });

        setTicketData(json.data);
      } catch (err: unknown) {
        const isNetworkFailure =
          !isOnline ||
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          isTransientNetworkError(err);

        const cached = isNetworkFailure ? getCachedTicket(cleanId) : null;
        if (cached) {
          setTicketData({
            access: "GRANTED",
            modo: "CONSULTA",
            resultado: "CONSULTA",
            canjeado: false,
            isCached: true,
            ticket: {
              id: cached.ticketId,
              reservaId: "CONSULTA-LOCAL",
              estado: "EMITIDO",
              servicioId: 0,
              servicioNombre: cached.servicioNombre,
              fecha: cached.fecha,
              horaInicio: cached.horaInicio,
              horaFin: cached.horaFin,
              titularId: "CACHED-USER",
              titularNombre: cached.titularNombre,
            },
          });
          setConsultationError(null);
        } else {
          setTicketData(null);
          if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
            setConsultationError(
              "Sin conexión a internet. No hay datos en caché para este boleto.",
            );
          } else {
            setConsultationError(
              err instanceof Error
                ? err.message
                : "Código no válido o no se pudo verificar la autenticidad del boleto.",
            );
          }
        }
      } finally {
        setConsultationLoading(false);
      }
    },
    [
      detenerCamaraConsulta,
      executeWithRetry,
      getCachedTicket,
      isOnline,
      setCachedTicket,
    ],
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

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setStateAndMessage(
        "redeem-error",
        "Sin conexión a internet. El canje de tickets está suspendido por seguridad.",
      );
      return;
    }

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
        if (result.code === "SERVICE_MISMATCH") {
          setZoneMismatch({
            message:
              result.message ?? "El ticket pertenece a otro escenario deportivo.",
            ticketId: ticket.ticketId,
          });
          setIsModalOpen(false);
        }
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
    } catch {
      const message =
        "Resultado de canje incierto debido a un error de comunicación. Verifique el estado del boleto mediante el Modo Consulta antes de intentar nuevamente.";
      setStateAndMessage("redeem-error", message);
      if (audioEnabled) {
        playError();
      }
    } finally {
      setIsRedeeming(false);
    }
  }, [
    activeShift,
    audioEnabled,
    isOnline,
    playError,
    playSuccess,
    setStateAndMessage,
    ticket,
  ]);

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
    setZoneMismatch(null);
    setFlowState("scanning");
    setModalMessage("Escaneando siguiente QR...");
  }, []);

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

  const toggleConsultationMode = () => {
    detenerCamaraConsulta();
    setIsConsultationMode((prev) => !prev);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const toggleAudio = () => {
    if (!audioEnabled) activateAudio();
    setAudioEnabled((current) => !current);
  };

  const toggleFacingMode = () => {
    setFacingMode((current) =>
      current === "environment" ? "user" : "environment",
    );
  };

  return {
    isOnline,
    isConsultationMode,
    toggleConsultationMode,
    ticketData,
    consultationLoading,
    consultationError,
    consultationCameraActive,
    consultationCameraError,
    iniciarCamaraConsulta,
    detenerCamaraConsulta,
    handleResetConsulta,
    manualPayload,
    setManualPayload,
    manualTicketId,
    setManualTicketId,
    manualSignature,
    setManualSignature,
    showManualInput,
    setShowManualInput,
    handleManualSubmit,
    flowState,
    theme,
    toggleTheme,
    shiftOptions,
    isLoadingShifts,
    shiftLoadError,
    selectedShiftId,
    activeShift,
    audioEnabled,
    toggleAudio,
    facingMode,
    toggleFacingMode,
    ticket,
    modalMessage,
    isModalOpen,
    isRedeeming,
    cameraToast,
    zoneMismatch,
    handleSelectShift,
    handleOpenCameraTurno,
    handleChangeShift,
    handleScanTurno,
    handleRedeem,
    handleCameraErrorTurno,
    handleScanNextTurno,
  };
}
