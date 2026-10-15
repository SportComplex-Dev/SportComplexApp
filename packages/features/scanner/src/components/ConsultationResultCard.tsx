"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
} from "@sportcomplex/ui";

import type { TicketInfo } from "../types";

export type { TicketInfo };

export interface ConsultationResultCardProps {
  ticket: TicketInfo;
  modo: "CONSULTA" | "TURNO";
  isCached?: boolean;
  onReset: () => void;
}

export function ConsultationResultCard({
  ticket,
  modo,
  isCached = false,
  onReset,
}: ConsultationResultCardProps) {
  return (
    <Card
      data-testid="consultation-result-card"
      className="border-[var(--brand-border)] bg-[var(--surface)] shadow-md overflow-hidden animate-in fade-in-50 duration-200"
    >
      {/* Barra superior de estado */}
      <div className="bg-[#123e30] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-[#c9ef75]" />
          <h2 className="font-semibold text-sm">Información del Boleto</h2>
        </div>
        <div className="flex items-center gap-2">
          {isCached ? (
            <Badge
              data-testid="cached-status-badge"
              variant="outline"
              className="border-amber-400 bg-amber-400/20 text-amber-200 font-semibold text-xs"
            >
              [Datos locales en caché - Sin conexión]
            </Badge>
          ) : null}
          <Badge
            data-testid="ticket-status-badge"
            variant={ticket.estado === "EMITIDO" ? "success" : "warning"}
            className="font-mono text-xs"
          >
            {ticket.estado}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Cuadrícula de los 4 campos obligatorios (HU-15 / RF-13) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Servicio */}
          <div
            data-testid="field-service"
            className="p-3.5 rounded-xl border border-[var(--brand-border)] bg-[var(--surface-soft)] space-y-1"
          >
            <span className="text-xs font-semibold text-[var(--subtle)] flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
              Servicio / Instalación
            </span>
            <p className="text-base font-bold text-[var(--ink)]">
              {ticket.servicioNombre}
            </p>
          </div>

          {/* 2. Titular */}
          <div
            data-testid="field-holder"
            className="p-3.5 rounded-xl border border-[var(--brand-border)] bg-[var(--surface-soft)] space-y-1"
          >
            <span className="text-xs font-semibold text-[var(--subtle)] flex items-center gap-1.5">
              <User className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
              Titular de la Reserva
            </span>
            <p className="text-base font-bold text-[var(--ink)]">
              {ticket.titularNombre}
            </p>
          </div>

          {/* 3. Fecha */}
          <div
            data-testid="field-date"
            className="p-3.5 rounded-xl border border-[var(--brand-border)] bg-[var(--surface-soft)] space-y-1"
          >
            <span className="text-xs font-semibold text-[var(--subtle)] flex items-center gap-1.5">
              <Calendar className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
              Fecha Programada
            </span>
            <p className="text-base font-mono font-semibold text-[var(--ink)]">
              {ticket.fecha}
            </p>
          </div>

          {/* 4. Franja Horaria */}
          <div
            data-testid="field-time-slot"
            className="p-3.5 rounded-xl border border-[var(--brand-border)] bg-[var(--surface-soft)] space-y-1"
          >
            <span className="text-xs font-semibold text-[var(--subtle)] flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
              Franja Horaria
            </span>
            <p className="text-base font-mono font-semibold text-[var(--ink)]">
              {ticket.horaInicio} – {ticket.horaFin}
            </p>
          </div>
        </div>

        {/* Banner de datos en caché cuando no hay conexión */}
        {isCached ? (
          <div
            data-testid="cached-warning-banner"
            role="status"
            className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-700 dark:text-amber-300">
              <RefreshCw className="size-4 shrink-0" />
              <span>[Datos locales en caché - Sin conexión]</span>
            </div>
            <p className="text-xs leading-relaxed">
              Atención: Esta información fue recuperada de la memoria caché local del dispositivo. Los datos pueden estar desactualizados y no representan una validación actual del backend. No autorizan acceso ni canje transaccional.
            </p>
          </div>
        ) : null}

        {/* Garantía y Criterio de Aceptación Clave */}
        <div
          data-testid="informative-guarantee-banner"
          className="p-4 rounded-xl border border-[#5e8b48]/30 bg-[#edf5e2] text-[#4b7652] dark:border-[#9ee285]/30 dark:bg-[#1f3524] dark:text-[#9ee285] space-y-1"
        >
          <div className="flex items-center gap-2 font-semibold text-xs">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Modo Consulta Informativo (RF-13)</span>
          </div>
          <p className="text-xs leading-relaxed">
            El boleto permanece en estado <strong>{ticket.estado}</strong> tras esta
            consulta. En esta vista informativa <strong>no se realizan gastos ni canjes</strong> de
            accesos.
          </p>
        </div>

        {/* Metadatos técnicos */}
        <div className="text-[11px] font-mono text-[var(--subtle)] flex flex-wrap justify-between gap-2 pt-2 border-t border-[var(--brand-border)]">
          <span>ID Ticket: {ticket.id}</span>
          <span>Modo: {modo}</span>
        </div>
      </CardContent>

      {/* Footer: ÚNICAMENTE botón para nueva consulta. NINGÚN BOTÓN DE CANJE */}
      <CardFooter className="p-5 pt-0 flex justify-end">
        <Button
          data-testid="btn-reset-consultation"
          variant="accent"
          onClick={onReset}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <RefreshCw className="size-4" />
          Consultar otro boleto
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ConsultationResultCard;
