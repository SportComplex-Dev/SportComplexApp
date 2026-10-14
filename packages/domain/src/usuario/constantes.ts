import type { Rol } from "./tipos.js";

export const hogarPorRol: Record<Rol, string> = {
  Administrador: "/admin/dashboard",
  Empleado_Vendedor: "/pos",
  Empleado_Lector: "/scanner",
  Cliente: "/portal",
};

export const roleHome = hogarPorRol;
