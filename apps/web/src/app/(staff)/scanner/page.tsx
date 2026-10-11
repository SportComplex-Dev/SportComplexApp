"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Eye,
  Info,
  QrCode,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
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

interface VerifyResponseData {
  access: "GRANTED" | "DENIED";
  modo: "CONSULTA" | "TURNO";
  resultado: string;
  canjeado: boolean;
  lecturaId?: string;
  ticket: TicketInfo;
}

export default function ScannerPage() {
  // TSK-FE-15: Modo Consulta Informativo sin puesto asignado
  const [isConsultationMode, setIsConsultationMode] = useState<boolean>(true);
  const [ticketData, setTicketData] = useState<VerifyResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cámara y escáner
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  // Entrada manual para simulación / QA
  const [manualPayload, setManualPayload] = useState<string>("");
  const [manualTicketId, setManualTicketId] = useState<string>("");
  const [manualSignature, setManualSignature] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Ejecutar verificación informativa (GET /api/tickets/verify/[code])
  const consultarTicket = async (ticketId: string, signature: string) => {
    setLoading(true);
    setErrorMessage(null);

    // Pausar o detener cámara mientras se evalúa
    detenerCamara();

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
        setErrorMessage(errorMsg);
        setTicketData(null);
        return;
      }

      setTicketData(json.data);
    } catch {
      setErrorMessage("Error de conexión al consultar el servicio de accesos.");
      setTicketData(null);
    } finally {
      setLoading(false);
    }
  };

  // Procesar texto capturado (por cámara o ingreso manual)
  const procesarTextoEscaneado = (rawText: string) => {
    const parsed = parseTicketQr(rawText);
    if (!parsed) {
      setErrorMessage(
        "Formato de QR no reconocido. Debe contener el identificador y la firma HMAC autorizada.",
      );
      return;
    }
    void consultarTicket(parsed.ticketId, parsed.signature);
  };

  // Manejo de la cámara con html5-qrcode
  const iniciarCamara = async () => {
    setCameraError(null);
    setErrorMessage(null);

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
          procesarTextoEscaneado(decodedText);
        },
        () => {
          // Frame sin QR, ignorar
        },
      );

      setCameraActive(true);
    } catch (err: unknown) {
      console.warn("No se pudo iniciar la cámara web:", err);
      setCameraError(
        "No se pudo acceder a la cámara. Puedes utilizar el ingreso manual para consultar el boleto.",
      );
      setCameraActive(false);
    }
  };

  const detenerCamara = () => {
    if (html5QrCodeRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qrScanner = html5QrCodeRef.current as any;
      if (qrScanner.isScanning) {
        qrScanner
          .stop()
          .then(() => {
            setCameraActive(false);
          })
          .catch(() => {
            setCameraActive(false);
          });
      } else {
        setCameraActive(false);
      }
    }
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      detenerCamara();
    };
  }, []);

  const handleReset = () => {
    setTicketData(null);
    setErrorMessage(null);
    setManualPayload("");
    setManualTicketId("");
    setManualSignature("");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPayload.trim()) {
      procesarTextoEscaneado(manualPayload.trim());
      return;
    }
    if (manualTicketId.trim() && manualSignature.trim()) {
      void consultarTicket(manualTicketId.trim(), manualSignature.trim());
      return;
    }
    setErrorMessage("Por favor ingresa el payload QR o el Código y Firma correspondientes.");
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
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
                onClick={() => setIsConsultationMode((prev) => !prev)}
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

        {/* Vista de Resultado Informativo (Si hay ticket verificado) */}
        {ticketData && (
          <ConsultationResultCard
            ticket={ticketData.ticket}
            modo={ticketData.modo}
            onReset={handleReset}
          />
        )}

        {/* Mensaje de Error si la consulta falló */}
        {errorMessage && !ticketData && (
          <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold">No se pudo verificar el boleto</p>
                <p>{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
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
                    variant={cameraActive ? "destructive" : "default"}
                    size="sm"
                    onClick={cameraActive ? detenerCamara : iniciarCamara}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    {cameraActive ? (
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
                    cameraActive ? "block" : "hidden"
                  }`}
                />

                {!cameraActive && (
                  <div className="p-8 border border-dashed border-[var(--brand-border)] rounded-xl flex flex-col items-center justify-center text-center space-y-2 text-[var(--subtle)]">
                    <QrCode className="size-10 text-muted-foreground/60" />
                    <p className="text-xs">
                      La cámara se encuentra pausada. Haz clic en <strong>Iniciar cámara</strong> o usa
                      el ingreso manual.
                    </p>
                  </div>
                )}

                {cameraError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{cameraError}</p>
                )}

                {loading && (
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
                      disabled={loading}
                      className="w-full text-xs"
                    >
                      {loading ? "Consultando..." : "Consultar Tiquete"}
                    </Button>
                  </form>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
