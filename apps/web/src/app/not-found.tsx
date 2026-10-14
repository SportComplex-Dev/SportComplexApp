'use client';

import Link from 'next/link';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Compass,
  FileText,
  Headphones,
  Home,
  Ticket,
} from 'lucide-react';

/**
 * Página oficial de error 404 — Diseño "Kinetic Apex Desktop & Mobile"
 * Complejo Deportivo AKROS.
 *
 * Directiva 'use client' requerida para microinteracciones fluidas y
 * detección de 'prefers-reduced-motion'. El contenedor respeta la jerarquía
 * del RootLayout sin duplicar cabeceras ni pies de página.
 */
export default function NotFound() {
  const shouldReduceMotion = useReducedMotion();

  const cardVariants = {
    initial: shouldReduceMotion
      ? { opacity: 0, y: 0, scale: 1 }
      : { opacity: 0, y: 14, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
  };

  const cardTransition: Transition = shouldReduceMotion
    ? { duration: 0.15 }
    : { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center px-4 sm:px-6 py-12">
      {/* ─────────────────────────────────────────────────────────────
          A. MARCADOR TÁCTICO DEPORTIVO (HERO)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-3xl flex flex-col items-center justify-center text-center mb-6">
        {/* Trazado SVG Cancha Atlética */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none stroke-[#123e30] dark:stroke-[#c9ef75] opacity-10 dark:opacity-20"
          viewBox="0 0 600 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Perímetro de cancha con línea discontinua */}
          <rect
            x="24"
            y="20"
            width="552"
            height="200"
            rx="20"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          {/* Línea divisoria central */}
          <line
            x1="300"
            y1="20"
            x2="300"
            y2="220"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          {/* Círculo central y punto de saque */}
          <circle cx="300" cy="120" r="48" strokeWidth="2" />
          <circle cx="300" cy="120" r="4" fill="currentColor" />
          {/* Áreas de meta */}
          <rect x="24" y="60" width="80" height="120" strokeWidth="2" />
          <rect x="496" y="60" width="80" height="120" strokeWidth="2" />
          <rect
            x="24"
            y="85"
            width="35"
            height="70"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <rect
            x="541"
            y="85"
            width="35"
            height="70"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Arcos de esquina */}
          <path d="M 24 44 A 24 24 0 0 0 48 20" strokeWidth="2" />
          <path d="M 576 44 A 24 24 0 0 1 552 20" strokeWidth="2" />
          <path d="M 24 196 A 24 24 0 0 1 48 220" strokeWidth="2" />
          <path d="M 576 196 A 24 24 0 0 0 552 220" strokeWidth="2" />
        </svg>

        {/* Cápsula de Estado Táctico */}
        <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#123e30]/15 dark:border-[#c9ef75]/30 bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-xs font-semibold uppercase tracking-wider text-[#123e30] dark:text-[#c9ef75] mb-2 backdrop-blur-sm">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-[#c9ef75] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9ef75]" />
          </span>
          <span>Saque de Fondo • Error 404</span>
        </div>

        {/* Número 404 Prominente */}
        <div
          className="text-8xl md:text-9xl font-black tracking-tighter text-[#123e30] dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-[#d9f29f] dark:via-[#9eaba3] dark:to-[#425248] select-none leading-none"
          aria-hidden="true"
        >
          404
        </div>
        <span className="sr-only">Error 404: Página no encontrada</span>

        {/* Subtítulo Táctico */}
        <p className="text-xs sm:text-sm font-mono tracking-widest text-[#526058] dark:text-[#9eaba3] uppercase mt-2">
          CANCHA SIN SEÑAL • FUERA DE LOS LÍMITES
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          B. TARJETA CENTRAL ELEVADA (DESKTOP & MOBILE)
          ───────────────────────────────────────────────────────────── */}
      <motion.section
        aria-labelledby="not-found-heading"
        className="w-full max-w-3xl rounded-3xl border border-[#e2e6df] dark:border-[#26352d] bg-white dark:bg-[#15201b] p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-md relative z-10"
        variants={cardVariants}
        initial="initial"
        animate="animate"
        transition={cardTransition}
      >
        {/* Chip Temático */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 mb-4">
          <AlertTriangle
            className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>Aviso Deportivo</span>
        </div>

        {/* Título Principal */}
        <h1
          id="not-found-heading"
          className="text-2xl md:text-3xl font-extrabold text-[#121a16] dark:text-[#f2f5f1] tracking-tight mb-3"
        >
          Esta jugada quedó fuera de la cancha
        </h1>

        {/* Párrafo Descriptivo */}
        <p className="text-sm md:text-base text-[#526058] dark:text-[#9eaba3] leading-relaxed mb-8">
          La página, servicio o franja horaria que buscas no existe, cambió de programación o fue
          retirada temporalmente del complejo deportivo AKROS.
        </p>

        {/* ─────────────────────────────────────────────────────────────
            C. BOTONES DE ACCIÓN PRINCIPAL (2 COLUMNAS EN ESCRITORIO)
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Link
              href="/"
              className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-[#c9ef75] hover:bg-[#d6f694] text-[#123e30] font-bold text-sm tracking-wide shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2 w-full text-center"
            >
              <Home className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span>VOLVER AL INICIO</span>
            </Link>
          </motion.div>

          <motion.div
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Link
              href="/portal/book"
              className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl border border-[#e2e6df] dark:border-[#26352d] text-[#121a16] dark:text-[#f2f5f1] hover:bg-[#f7f8f5] dark:hover:bg-[#1b2b24] font-bold text-xs tracking-wider uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2 w-full text-center"
            >
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>EXPLORAR CANCHAS E INSTALACIONES</span>
            </Link>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            D. RUTAS RÁPIDAS DE RESCATE (3 COLUMNAS EN ESCRITORIO)
            ───────────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-[#e2e6df] dark:border-[#26352d]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#526058] dark:text-[#9eaba3]">
              RUTAS DISPONIBLES EN EL CLUB
            </h2>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#f1f3ee] dark:bg-[#1c2721] text-[#526058] dark:text-[#9eaba3] border border-[#e2e6df] dark:border-[#26352d]">
              3 opciones inmediatas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Catálogo de Reservas */}
            <Link
              href="/portal/book"
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-[#e2e6df] dark:border-[#26352d] bg-[#f7f8f5]/60 dark:bg-[#111815]/50 hover:bg-white dark:hover:bg-[#1b2b24] hover:border-[#c9ef75]/60 dark:hover:border-[#c9ef75]/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75] group-hover:bg-[#c9ef75] group-hover:text-[#123e30] transition-colors">
                  <CalendarDays className="w-4 h-4" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="w-4 h-4 text-[#526058] dark:text-[#9eaba3] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#121a16] dark:text-[#f2f5f1] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-colors">
                  Catálogo de Reservas
                </h3>
                <p className="text-xs text-[#526058] dark:text-[#9eaba3] mt-1 leading-relaxed">
                  Canchas de pádel, tenis y fútbol
                </p>
              </div>
            </Link>

            {/* 2. Pase Digital y Tickets */}
            <Link
              href="/portal/tickets"
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-[#e2e6df] dark:border-[#26352d] bg-[#f7f8f5]/60 dark:bg-[#111815]/50 hover:bg-white dark:hover:bg-[#1b2b24] hover:border-[#c9ef75]/60 dark:hover:border-[#c9ef75]/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75] group-hover:bg-[#c9ef75] group-hover:text-[#123e30] transition-colors">
                  <Ticket className="w-4 h-4" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="w-4 h-4 text-[#526058] dark:text-[#9eaba3] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#121a16] dark:text-[#f2f5f1] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-colors">
                  Pase Digital y Tickets
                </h3>
                <p className="text-xs text-[#526058] dark:text-[#9eaba3] mt-1 leading-relaxed">
                  Credencial activa y accesos QR
                </p>
              </div>
            </Link>

            {/* 3. Reglamentos y Normativa */}
            <Link
              href="/rules"
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-[#e2e6df] dark:border-[#26352d] bg-[#f7f8f5]/60 dark:bg-[#111815]/50 hover:bg-white dark:hover:bg-[#1b2b24] hover:border-[#c9ef75]/60 dark:hover:border-[#c9ef75]/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75] group-hover:bg-[#c9ef75] group-hover:text-[#123e30] transition-colors">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="w-4 h-4 text-[#526058] dark:text-[#9eaba3] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#121a16] dark:text-[#f2f5f1] group-hover:text-[#123e30] dark:group-hover:text-[#c9ef75] transition-colors">
                  Reglamentos y Normativa
                </h3>
                <p className="text-xs text-[#526058] dark:text-[#9eaba3] mt-1 leading-relaxed">
                  Políticas del club y convivencia
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            E. ASISTENCIA Y SOPORTE
            ───────────────────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-[#e2e6df]/80 dark:border-[#26352d]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span className="text-xs text-[#526058] dark:text-[#9eaba3]">
            ¿Crees que se trata de un error del sistema?
          </span>
          <Link
            href="https://wa.me/573001234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#123e30] dark:text-[#c9ef75] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2 rounded-lg px-2.5 py-1.5 transition-all"
          >
            <Headphones className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>CONTACTAR A CONCIERGE DEPORTIVO</span>
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
