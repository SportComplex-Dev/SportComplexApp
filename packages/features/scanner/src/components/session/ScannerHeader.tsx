"use client";

import { motion } from "framer-motion";
import { CameraOff, LogOut, MicOff, Moon, RefreshCcw, Sun, User, Volume2 } from "lucide-react";

import type { ShiftOption } from "../../types";

export type ScannerHeaderProps = {
  activeShift: ShiftOption | null;
  audioEnabled: boolean;
  theme: "dark" | "light";
  employeeName?: string;
  onToggleAudio: () => void;
  onToggleTheme: () => void;
  onChangeShift: () => void;
  onLogout?: () => void;
};

export function ScannerHeader({
  activeShift,
  audioEnabled,
  theme,
  employeeName,
  onToggleAudio,
  onToggleTheme,
  onChangeShift,
  onLogout,
}: ScannerHeaderProps) {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-20 border-b border-brand-border bg-brand-dark/90 px-4 py-3 backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent shadow-[0_0_35px_rgba(201,239,117,0.2)]">
            <CameraOff className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">AKROS Club</p>
            <h1 className="truncate text-sm font-semibold text-brand-text sm:text-base">
              {activeShift ? `${activeShift.label} · ${activeShift.courtName}` : "Sin turno activo"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {employeeName && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-text">
              <User className="h-3.5 w-3.5 text-brand-accent" />
              <span className="truncate max-w-[120px]">{employeeName}</span>
            </div>
          )}

          <button
            type="button"
            aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
            aria-pressed={theme === "dark"}
            onClick={onToggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-text transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label={audioEnabled ? "Silenciar audio" : "Activar audio"}
            onClick={onToggleAudio}
            className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{audioEnabled ? "Audio ON" : "Audio OFF"}</span>
          </button>

          <button
            type="button"
            aria-label="Cambiar de puesto"
            onClick={onChangeShift}
            className="inline-flex items-center gap-2 rounded-full border border-brand-accent/40 bg-brand-emerald px-3 py-2 text-xs font-semibold text-brand-accent-soft transition hover:border-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Cambiar puesto</span>
          </button>

          {onLogout && (
            <button
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 cursor-pointer"
              data-testid="scanner-header-logout-button"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

export default ScannerHeader;
