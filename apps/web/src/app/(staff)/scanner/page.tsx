"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import ExpiredSlotScreen from "@/components/scanner/ExpiredSlotScreen";
import {
  parseTicketQr,
  ScannerServiceError,
  validateTicket,
  type TicketValidationResponse,
} from "@/components/scanner/scanner.service";

const CAMERA_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
};

export default function ScannerPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const serviceIdRef = useRef("");
  const [serviceId, setServiceId] = useState("");
  const [result, setResult] = useState<TicketValidationResponse | null>(null);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const processDecodedText = useCallback(
    async (decodedText: string, scanner: Html5Qrcode) => {
      if (processingRef.current || scannerRef.current !== scanner) return;
      processingRef.current = true;
      setCameraReady(false);
      setError("");

      try {
        await scanner.stop();
        const { ticketId, signature } = parseTicketQr(decodedText);
        const selectedServiceId = Number(serviceIdRef.current);
        if (!Number.isInteger(selectedServiceId) || selectedServiceId < 1) {
          throw new ScannerServiceError("Ingresa un ID de servicio válido antes de escanear.");
        }
        const validation = await validateTicket(
          ticketId,
          signature,
          selectedServiceId,
        );
        setResult(validation);
      } catch (scanError) {
        setError(
          scanError instanceof ScannerServiceError
            ? scanError.message
            : "No fue posible procesar el código escaneado.",
        );
        processingRef.current = false;
        try {
          await scanner.start(
            { facingMode: "environment" },
            CAMERA_CONFIG,
            (nextDecodedText) => void processDecodedText(nextDecodedText, scanner),
            () => undefined,
          );
          setCameraReady(true);
        } catch (restartError) {
          setCameraError(
            restartError instanceof Error
              ? `No se pudo reactivar la cámara: ${restartError.message}`
              : "No se pudo reactivar la cámara.",
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    let scanner: Html5Qrcode | null = null;

    async function startCamera() {
      try {
        const instance = new Html5Qrcode("scanner-camera");
        scanner = instance;
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          CAMERA_CONFIG,
          (decodedText) => {
            if (mounted) void processDecodedText(decodedText, instance);
          },
          () => undefined,
        );
        if (!mounted) {
          await instance.stop();
          return;
        }
        setCameraReady(true);
      } catch (startError) {
        if (mounted) {
          setCameraError(
            startError instanceof Error
              ? `No se pudo iniciar la cámara: ${startError.message}`
              : "No se pudo iniciar la cámara.",
          );
        }
      }
    }

    void startCamera();
    return () => {
      mounted = false;
      if (scanner?.isScanning) void scanner.stop();
      scannerRef.current = null;
    };
  }, [processDecodedText]);

  const continueScanning = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    setError("");
    setCameraError("");
    try {
      await scanner.start(
        { facingMode: "environment" },
        CAMERA_CONFIG,
        (decodedText) => void processDecodedText(decodedText, scanner),
        () => undefined,
      );
      setResult(null);
      setCameraReady(true);
      processingRef.current = false;
      setCameraError("");
    } catch (startError) {
      setCameraError(
        startError instanceof Error
          ? `No se pudo reactivar la cámara: ${startError.message}`
          : "No se pudo reactivar la cámara.",
      );
    }
  }, [processDecodedText]);

  const handleServiceIdChange = (value: string) => {
    setServiceId(value);
    serviceIdRef.current = value;
  };

  if (result?.status === "EXPIRED" && result.expiredDetails) {
    return (
      <main>
        <ExpiredSlotScreen
          cameraError={cameraError}
          expiredDetails={result.expiredDetails}
          onContinue={() => void continueScanning()}
          targetCourtName={result.targetCourtName ?? "Servicio"}
          ticketId={result.ticketId ?? ""}
          userName={result.userName ?? "Cliente"}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl bg-slate-50 px-4 py-8 text-slate-900 dark:bg-[#111815] dark:text-white sm:px-6">
      <h1 className="text-2xl font-extrabold">Control de acceso móvil</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Escanea el QR para validar la reserva y su franja horaria.
      </p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="scanner-service-id">
        ID del servicio asignado
      </label>
      <input
        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-slate-900 outline-none focus:border-emerald-600 dark:border-white/20 dark:bg-[#1a2420] dark:text-white"
        id="scanner-service-id"
        min="1"
        onChange={(event) => handleServiceIdChange(event.target.value)}
        placeholder="Ej. 3"
        type="number"
        value={serviceId}
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">
        <div aria-label="Cámara para escanear códigos QR" id="scanner-camera" />
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="status">
        {cameraError || (cameraReady ? "Cámara activa. Centra el código QR en el recuadro." : "Iniciando cámara…")}
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}

      {result && (
        <section
          aria-live="assertive"
          className={`mt-5 rounded-2xl border p-5 ${
            result.isValid
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100"
          }`}
        >
          <h2 className="font-bold">{result.message}</h2>
          <p className="mt-2 text-sm">
            {result.userName} · {result.targetCourtName}
          </p>
          <button
            className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white dark:bg-white dark:text-slate-900"
            onClick={() => void continueScanning()}
            type="button"
          >
            Continuar escaneando
          </button>
        </section>
      )}
    </main>
  );
}
