import { randomUUID } from "node:crypto";
import type { MockState, MockUsuario } from "../estado.js";

export function crearMockUsuario(state: MockState, overrides: Partial<MockUsuario> = {}): MockUsuario {
  const usuario: MockUsuario = {
    id: overrides.id ?? `user-${randomUUID()}`,
    nombre: overrides.nombre ?? "Usuario Prueba",
    correo: overrides.correo ?? "usuario@sportcomplex.test",
    estado: overrides.estado ?? "ACTIVO",
    deletedAt: overrides.deletedAt ?? null,
    rolId: overrides.rolId ?? 1,
    rolNombre: overrides.rolNombre ?? "CLIENTE",
    creadoEn: overrides.creadoEn ?? new Date(),
    passwordHash: overrides.passwordHash ?? "hash_test",
  };
  state.usuarios.push(usuario);
  return usuario;
}

export function crearUsuarioHandler(state: MockState) {
  const rolesMap: Record<number, string> = {
    1: "ADMIN",
    2: "VENDEDOR",
    3: "LECTOR",
    4: "CLIENTE",
  };

  return {
    async findFirst({ where, select }: any = {}) {
      if (!where) return state.usuarios[0] ?? null;
      const usuario = state.usuarios.find((u) => {
        if (where.id !== undefined && u.id !== where.id) return false;
        if (where.correo !== undefined && u.correo !== where.correo) return false;
        return true;
      }) ?? null;
      if (!usuario) return null;
      if (!select) return usuario;

      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(select)) {
        if (!select[key]) continue;
        if (key === "rol") {
          picked.rol = { id: usuario.rolId ?? 1, nombre: usuario.rolNombre };
        } else {
          picked[key] = (usuario as any)[key];
        }
      }
      return picked;
    },
    async findMany({ where, select, orderBy, take, skip }: any = {}) {
      let list = [...state.usuarios];
      if (where?.rol?.nombre?.in) {
        const allowedRoles = where.rol.nombre.in;
        list = list.filter((u) => allowedRoles.includes(u.rolNombre));
      }
      if (where?.estado) {
        list = list.filter((u) => u.estado === where.estado);
      }
      if (orderBy?.creadoEn === "desc") {
        list.sort((a, b) => ((b.creadoEn?.getTime() ?? 0) - (a.creadoEn?.getTime() ?? 0)));
      }
      if (skip !== undefined) {
        list = list.slice(skip);
      }
      if (take !== undefined) {
        list = list.slice(0, take);
      }
      if (!select) return list;
      return list.map((u) => {
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          if (!select[key]) continue;
          if (key === "rol") {
            picked.rol = { id: u.rolId ?? 1, nombre: u.rolNombre ?? "VENDEDOR" };
          } else {
            picked[key] = (u as any)[key];
          }
        }
        return picked;
      });
    },
    async findUnique({ where, select }: any) {
      const usuario = where.id !== undefined
        ? state.usuarios.find((u) => u.id === where.id)
        : where.correo !== undefined
          ? state.usuarios.find((u) => u.correo === where.correo)
          : undefined;
      if (!usuario) return null;
      if (!select) return usuario;

      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(select)) {
        if (!select[key]) continue;
        if (key === "rol") {
          picked.rol = { id: usuario.rolId ?? 1, nombre: usuario.rolNombre };
        } else {
          picked[key] = (usuario as any)[key];
        }
      }
      return picked;
    },
    async create({ data, select }: any) {
      const resolvedRolNombre = data.rolNombre || rolesMap[data.rolId] || "CLIENTE";
      const u: MockUsuario = {
        id: data.id || `user-${randomUUID()}`,
        nombre: data.nombre,
        correo: data.correo,
        estado: data.estado || "ACTIVO",
        deletedAt: null,
        rolId: data.rolId || 1,
        rolNombre: resolvedRolNombre,
        creadoEn: new Date(),
      };
      state.usuarios.push(u);
      if (!select) return u;
      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(select)) {
        if (!select[key]) continue;
        if (key === "rol") {
          picked.rol = { id: u.rolId ?? 1, nombre: u.rolNombre ?? resolvedRolNombre };
        } else {
          picked[key] = (u as any)[key];
        }
      }
      return picked;
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const usuario of state.usuarios) {
        if (where.id !== undefined && usuario.id !== where.id) continue;
        if (where.rolId !== undefined && usuario.rolId !== where.rolId) continue;
        if (where.estado !== undefined && usuario.estado !== where.estado) continue;
        if (
          where.deletedAt !== undefined &&
          usuario.deletedAt?.getTime() !== where.deletedAt?.getTime()
        ) continue;
        Object.assign(usuario, data);
        count++;
      }
      return { count };
    },
  };
}
