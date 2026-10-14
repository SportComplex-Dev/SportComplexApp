export type Rol = 'Administrador' | 'Empleado_Vendedor' | 'Empleado_Lector' | 'Cliente';
export type Role = Rol;

export type EstadoUsuario = 'PENDIENTE' | 'ACTIVO' | 'TEMP_INACTIVO' | 'INACTIVO';
export type UserStatus = EstadoUsuario;

export type EstadoCuenta = 'Pendiente' | 'Activo' | 'Inactivo' | 'Temporalmente_Inactivo';
export type AccountStatus = EstadoCuenta;

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  estado: EstadoUsuario;
  clienteStripeId?: string | null;
  creadoEn: Date;
}
export type User = Usuario;
