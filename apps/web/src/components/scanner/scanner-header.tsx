"use client";

import { motion } from "framer-motion";
import { CameraOff, MicOff, RefreshCcw, Volume2 } from "lucide-react";

import type { ShiftOption } from "@/components/scanner/mock-access";

type ScannerHeaderProps = {
  activeShift: ShiftOption | null;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onChangeShift: () => void;
};

export function ScannerHeader({ activeShift, audioEnabled, onToggleAudio, onChangeShift }: ScannerHeaderProps) {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-20 border-b border-white/10 bg-brand-dark/80 px-4 py-3 backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent shadow-[0_0_35px_rgba(201,239,117,0.2)]">
            <CameraOff className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent/80">AKROS Club</p>
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">
              {activeShift ? `${activeShift.label} · ${activeShift.courtName}` : "Sin turno activo"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label={audioEnabled ? "Silenciar audio" : "Activar audio"}
            onClick={onToggleAudio}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-brand-surface/90 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-brand-accent/50 hover:text-brand-accent"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{audioEnabled ? "Audio ON" : "Audio OFF"}</span>
          </button>

          <button
            type="button"
            aria-label="Cambiar de puesto"
            onClick={onChangeShift}
            className="inline-flex items-center gap-2 rounded-full border border-brand-accent/40 bg-brand-emerald/20 px-3 py-2 text-xs font-semibold text-brand-limeSoft transition hover:border-brand-accent hover:bg-brand-emerald/30"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Cambiar puesto</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
