# TSK-FE-21: Administración de Empleados y Roles Operativos

## 1. Identificación y Alcance
- **Ticket Jira:** TSK-FE-21 / SCRUM-141 (Historia de Usuario HU-21 / Requerimiento RF-18 / RN-10)
- **Módulo:** Panel de Administración (`/admin/employees`)
- **Objetivo:** Gestión integral de personal interno (roles `ADMIN`, `VENDEDOR`, `LECTOR`), alta con credenciales seguras vía Argon2id y sincronización con Supabase Auth (`auth.users`), y baja lógica con revocación inmediata de accesos preservando historial transaccional e integridad referencial (`RESTRICT`).

---

## 2. Arquitectura de Componentes (Modularización ARC-01)
El panel monolítico original fue refactorizado en subcomponentes especializados bajo `apps/web/src/components/admin/employees/`:

1. **`AdminEmployeesPage` (`apps/web/src/app/(admin)/admin/employees/page.tsx`):**
   - Controlador de estado y orquestador principal.
   - Manejo de estados de carga, error con reintento explícito (cero fallbacks silenciosos a mocks, `SEC-01`), y filtros reactivos en tiempo real por búsqueda y roles.
2. **`EmployeeStats` (`employee-stats.tsx`):**
   - Métricas de plantilla: Total colaboradores, Activos, Inactivos (bajas lógicas) y desglose de personal de campo (Vendedores / Lectores).
3. **`EmployeeTable` (`employee-table.tsx`):**
   - Tabla reactiva con ordenamiento, badges semánticos por rol (`formatRoleBadge`), badges de estado (`ACTIVO` vs `INACTIVO`), y botón de acción condicional para baja lógica.
   - Oculta o inhabilita acciones de baja para cuentas con rol Administrador o sesión propia.
4. **`EmployeeCreateModal` (`employee-create-modal.tsx`):**
   - Modal accesible de alta con validación de nombre, correo, rol y contraseña temporal.
   - Prevención de doble submit con indicador `Loader2`.
5. **`EmployeeDeactivateModal` (`employee-deactivate-modal.tsx`):**
   - Diálogo de confirmación accesible con advertencia de la regla de negocio `RN-10` (integridad de cobros y canjes).

---

## 3. Seguridad y Backend
- **Hashing Argon2id (`RNF-02`):**
  - Creado mediante `hashSecret()` (`@sportcomplex/core/src/security/token`) con parámetros de seguridad reforzados (memoryCost: 19456 KiB, timeCost: 2, parallelism: 1).
  - Nunca se retorna `password_hash` en ninguna respuesta JSON ni vista de cliente.
- **Sincronización con Supabase Auth (`SEC-04`):**
  - El endpoint `POST /api/admin/employees` verifica `isSupabaseAdminConfigured()`. Si está habilitado, da de alta el usuario en `auth.users` mediante `supabaseAdmin.auth.admin.createUser`, asegurando que el nuevo colaborador pueda autenticarse inmediatamente tanto por Supabase como por fallback local.
- **Baja Lógica e Integridad (`RN-10` / `CA-01`):**
  - La desactivación marca `estado = 'INACTIVO'` y establece `deletedAt = NOW()`.
  - La base de datos mantiene cláusula `ON DELETE RESTRICT` impidiendo que un colaborador que haya cobrado en taquilla o canjeado tickets sea eliminado físicamente.
- **Paginación en Repositorio (`PERF-01`):**
  - `listEmployees({ limit, offset, page })` aplica `take` y `skip` para evitar lecturas masivas no acotadas.

---

## 4. Pruebas y Validación
- Validación de esquemas con Zod (`createEmployeeSchema`).
- Pruebas unitarias de repositorio en `packages/db/src/repositories/employees.test.ts`.
- Pruebas de integración frontend en `apps/web/src/app/(admin)/admin/employees/__tests__/employees-ui.test.ts`.
