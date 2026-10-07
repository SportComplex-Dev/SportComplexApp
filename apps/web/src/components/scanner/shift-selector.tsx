"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, MapPin, TimerReset } from "lucide-react";

import type { ShiftOption } from "@/components/scanner/mock-access";

type ShiftSelectorProps = {
  options: ShiftOption[];
  selectedId: string | null;
  onSelect: (shift: ShiftOption) => void;
};

export function ShiftSelector({ options, selectedId, onSelect }: ShiftSelectorProps) {
  return (
    <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-brand-surface/90 p-5 shadow-[0_30px_80px_rgba(10,18,13,0.62)] backdrop-blur sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-accent/90">Turno activo</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-[2rem]">Abrir puesto de escaneo</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1.5 text-xs font-semibold text-brand-accent">
          <TimerReset className="h-3.5 w-3.5" />
          Cámara apagada
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((shift) => {
          const isSelected = shift.id === selectedId;

          return (
            <motion.button
              key={shift.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(shift)}
              className={[
                "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
                isSelected
                  ? "border-brand-accent bg-brand-emerald/20 shadow-[0_0_0_1px_rgba(201,239,117,0.6)]"
                  : "border-white/10 bg-brand-surfaceSoft/70 hover:border-brand-accent/45 hover:bg-brand-surfaceSoft",
              ].join(" ")}
              aria-label={`Seleccionar ${shift.label} para ${shift.courtName}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-limeSoft">
                  {shift.label}
                </span>
                {isSelected ? (
                  <span className="rounded-full bg-brand-accent px-2 py-1 text-[10px] font-bold text-brand-dark">Activo</span>
                ) : null}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Instalación</p>
                  <p className="mt-1 text-base font-semibold text-white">{shift.courtName}</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin className="h-4 w-4 text-brand-accent" />
                  <span>{shift.venueName}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-200">
                  <span>{shift.startTime}</span>
                  <ArrowRight className="h-4 w-4 text-brand-accent" />
                  <span>{shift.endTime}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm font-medium text-brand-limeSoft">
                <span>Confirmar turno</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
