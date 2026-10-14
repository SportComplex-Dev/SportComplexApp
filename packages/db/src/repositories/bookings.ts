/**
 * Proxy retrocompatible para `bookings.ts`.
 * El módulo ha sido dividido en subarchivos especializados dentro de `./bookings/`:
 * - `tipos.ts`: Tipos e interfaces de datos de reservas.
 * - `errores.ts`: Clases de error (BookingError) y constantes contractuales.
 * - `mapeadores.ts`: Formateo de fechas, cursores y comparadores de franjas.
 * - `consultas.ts`: Lecturas de disponibilidad e historial.
 * - `mutaciones.ts`: Creación transaccional de holds y bloqueos concurrentes.
 */

export * from "./bookings/index";
