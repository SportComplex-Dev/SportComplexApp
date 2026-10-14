import type { MockState } from "../estado.js";
import { sembrarEscenarioFlujoReserva } from "./flujo-reserva.js";
import { crearMockUsuario } from "../fabricas/usuario.js";
import { crearMockPago } from "../fabricas/pago.js";

export function sembrarEscenarioCobroPos(state: MockState) {
  const base = sembrarEscenarioFlujoReserva(state);
  const vendedor = crearMockUsuario(state, {
    id: "vendedor-1",
    nombre: "Cajero Principal",
    correo: "cajero@sportcomplex.test",
    rolId: 2,
    rolNombre: "VENDEDOR",
  });
  const pago = crearMockPago(state, {
    id: "pago-pos-1",
    usuarioId: base.titular.id,
    monto: 60000,
    estado: "APROBADO",
  });

  return { ...base, vendedor, pago };
}
