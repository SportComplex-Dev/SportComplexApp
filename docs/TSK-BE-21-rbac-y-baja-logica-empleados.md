# TSK-BE-21 — RBAC perimetral y baja lógica de empleados

## Autorización

- El middleware conserva la defensa perimetral: `/admin` solo ADMIN; `/pos` ADMIN o VENDEDOR; `/scanner` ADMIN o LECTOR; `/portal` únicamente clientes activos.
- Los Route Handlers administrativos, de reservas, historial, acceso y PDF vuelven a validar la sesión, el estado y el rol contra el usuario actual en la base de datos.
- Los layouts de las páginas protegidas revalidan el estado y el rol actuales; una sesión antigua no mantiene acceso a una cuenta inactiva.

## Baja de empleado

`PATCH /api/admin/employees/<uuid>` requiere ADMIN y cambia una cuenta VENDEDOR/LECTOR a `estado = INACTIVO`, registrando `deletedAt`. No se elimina al empleado ni se alteran sus ventas, pagos, reservas o lecturas. No existe endpoint `DELETE` para empleados.

## Límite de esquema pendiente

No se modificó `schema.prisma` ni se creó/aplicó una migración, según el límite de esta tarea. La baja lógica y la protección de las relaciones existentes pueden implementarse con el esquema actual, pero la exigencia literal de imponer `ON DELETE RESTRICT` en todas las claves foráneas no queda garantizada: el esquema conserva relaciones `CASCADE` y `SET NULL`. Se requiere autorización para una tarea/migración de BD antes de declarar ese criterio completo.
