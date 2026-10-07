// RNF-01: bloqueo transaccional SELECT ... FOR UPDATE para aforo/franja.
//
// TSK-BD-07 implementado en `./availability.ts:reserveDisponibilidad`.
// Este módulo se conserva por compatibilidad; no agregar aquí escrituras
// sobre `disponibilidad` — todo write debe pasar por el row-lock auditado.
export const CONCURRENCY_NOTE =
  "Usar reserveDisponibilidad (SELECT ... FOR UPDATE) en ./availability.";
export * from "./availability";
