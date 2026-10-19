import { randomUUID } from "node:crypto";
import type { MockState } from "../estado.js";
import { crearMockCategoria } from "../fabricas/servicio.js";
import { crearMockUsuario } from "../fabricas/usuario.js";

export function sembrarEscenarioInscripcionTorneo(state: MockState) {
  const categoria = crearMockCategoria(state, { id: 2, nombre: "Torneos Pádel", tipo: "CANCHA" });
  const admin = crearMockUsuario(state, {
    id: "admin-1",
    nombre: "Administrador Torneos",
    rolId: 1,
    rolNombre: "ADMIN",
  });
  const jugador = crearMockUsuario(state, {
    id: "jugador-1",
    nombre: "Jugador Torneo",
    correo: "jugador@sportcomplex.test",
  });

  const torneo = {
    id: `torneo-${randomUUID()}`,
    adminId: admin.id,
    categoriaId: categoria.id,
    titulo: "Torneo Apertura Pádel 2026",
    descripcion: "Torneo oficial de pádel",
    nivel: "INTERMEDIO",
    fechaInicio: new Date("2026-11-01T08:00:00Z"),
    fechaFin: new Date("2026-11-03T18:00:00Z"),
    cuposTotales: 16,
    cuposOcupados: 1,
    precioInscripcion: 80000,
    estado: "PUBLICADO",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
  state.torneos.push(torneo);

  return { categoria, admin, jugador, torneo };
}
