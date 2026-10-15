import type { EstadoTorneoTipo, EstadoInscripcionTipo } from "../types";

export type { EstadoTorneoTipo, EstadoInscripcionTipo };

export const tournamentConfig: Record<
  EstadoTorneoTipo,
  { label: string; bg: string; text: string; dot: string }
> = {
  BORRADOR: {
    label: "Borrador",
    bg: "bg-slate-500/10 dark:bg-slate-400/10 border-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  },
  INSCRIPCIONES_ABIERTAS: {
    label: "Inscripciones Abiertas",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10 border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500 motion-safe:animate-pulse motion-reduce:animate-none",
  },
  EN_CURSO: {
    label: "En Curso",
    bg: "bg-blue-500/10 dark:bg-blue-400/10 border-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500 motion-safe:animate-pulse motion-reduce:animate-none",
  },
  FINALIZADO: {
    label: "Finalizado",
    bg: "bg-zinc-500/10 dark:bg-zinc-400/10 border-zinc-500/20",
    text: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  CANCELADO: {
    label: "Cancelado",
    bg: "bg-rose-500/10 dark:bg-rose-400/10 border-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

export function TournamentStatusBadge({
  status,
}: {
  status: EstadoTorneoTipo | string;
}) {
  const config =
    tournamentConfig[status as EstadoTorneoTipo] ?? tournamentConfig.BORRADOR;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export const inscripcionConfig: Record<
  EstadoInscripcionTipo,
  { label: string; bg: string; text: string }
> = {
  CONFIRMADA: {
    label: "Confirmada",
    bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  PENDIENTE_PAGO: {
    label: "Pendiente Pago",
    bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
  },
  CANCELADA: {
    label: "Cancelada",
    bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
  },
};

export function InscriptionStatusBadge({
  status,
}: {
  status: EstadoInscripcionTipo | string;
}) {
  const config =
    inscripcionConfig[status as EstadoInscripcionTipo] ??
    inscripcionConfig.CONFIRMADA;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}
    >
      {config.label}
    </span>
  );
}

