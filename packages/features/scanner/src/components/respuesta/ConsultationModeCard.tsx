"use client";

import { AlertTriangle, Eye, Info, ToggleLeft, ToggleRight, WifiOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sportcomplex/ui";

export interface ConsultationModeCardProps {
  isConsultationMode: boolean;
  onToggle: () => void;
}

export function ConsultationModeCard({
  isConsultationMode,
  onToggle,
}: ConsultationModeCardProps) {
  return (
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
            onClick={onToggle}
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
  );
}

export function OfflineBanner() {
  return (
    <div
      role="alert"
      data-testid="offline-connectivity-banner"
      className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
    >
      <WifiOff className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs sm:text-sm font-semibold">
        Sin conexión a internet. El canje de tickets está suspendido por seguridad.
      </p>
    </div>
  );
}

export default ConsultationModeCard;
