import type { MockState, MockReserva, MockDisponibilidad } from "./estado.js";

export function pickDisponibilidad(
  disp: (MockDisponibilidad & { franja?: { horaInicio: Date; horaFin: Date } }) | undefined,
  shape: Record<string, any>,
): Record<string, any> | undefined {
  if (!disp) return undefined;
  const picked: Record<string, any> = {};
  for (const key of Object.keys(shape)) {
    if (!shape[key]) continue;
    if (key === "franja") {
      const franjaShape = shape[key].select ?? shape[key].include;
      picked[key] = franjaShape
        ? Object.fromEntries(
            Object.keys(franjaShape)
              .filter((fk) => franjaShape[fk])
              .map((fk) => [fk, (disp.franja as any)?.[fk]]),
          )
        : disp.franja;
    } else {
      picked[key] = (disp as any)[key];
    }
  }
  return picked;
}

export function reservaEnriquecida(
  state: MockState,
  reserva: MockReserva,
): Record<string, unknown> {
  const disponibilidad = state.disponibilidades.find((d) => d.id === reserva.disponibilidadId);
  return {
    ...reserva,
    disponibilidad: disponibilidad
      ? {
          ...disponibilidad,
          franja: state.franjas.find((f) => f.id === disponibilidad.franjaId),
          servicio: state.servicios.find((s) => s.id === disponibilidad.servicioId),
        }
      : null,
    titular: state.usuarios.find((u) => u.id === reserva.titularId) ?? null,
    ticketQr: state.tickets.find((t) => t.reservaId === reserva.id) ?? null,
  };
}
