import type { MockState } from "../estado.js";
import { crearMockCategoria, crearMockServicio, crearMockFranja } from "../fabricas/servicio.js";
import { crearMockDisponibilidad } from "../fabricas/disponibilidad.js";
import { crearMockUsuario } from "../fabricas/usuario.js";

export function sembrarEscenarioFlujoReserva(state: MockState) {
  const categoria = crearMockCategoria(state, { id: 1, nombre: "Canchas", tipo: "CANCHA" });
  const servicio = crearMockServicio(state, {
    id: 1,
    categoriaId: categoria.id,
    nombre: "Cancha de Fútbol 5",
    tarifa: 60000,
    capacidadMaxima: 10,
    modalidad: "EXCLUSIVA",
  });
  const franja = crearMockFranja(state, {
    id: 1,
    servicioId: servicio.id,
    diaSemana: 1,
    horaInicio: new Date("1970-01-01T10:00:00Z"),
    horaFin: new Date("1970-01-01T11:00:00Z"),
  });
  const disponibilidad = crearMockDisponibilidad(state, {
    id: 1n,
    servicioId: servicio.id,
    franjaId: franja.id,
    fecha: new Date("2026-10-20T00:00:00Z"),
    cuposTotales: 10,
    cuposOcupados: 0,
  });
  const titular = crearMockUsuario(state, {
    id: "titular-1",
    nombre: "Cliente Reserva",
    correo: "cliente@sportcomplex.test",
  });

  return { categoria, servicio, franja, disponibilidad, titular };
}
