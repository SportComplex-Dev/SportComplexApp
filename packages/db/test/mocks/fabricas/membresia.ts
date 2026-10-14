import type { MockState, MockMembresia, MockPlanMembresia } from "../estado.js";

export function crearMockMembresia(state: MockState, overrides: Partial<MockMembresia> = {}): MockMembresia {
  const m: MockMembresia = {
    id: overrides.id ?? state.seq.membresiaIdSeq++,
    usuarioId: overrides.usuarioId ?? "user-1",
    planId: overrides.planId ?? 1,
    estado: overrides.estado ?? "VIGENTE",
    fechaInicio: overrides.fechaInicio ?? new Date(),
    proximaRenovacion: overrides.proximaRenovacion ?? new Date(Date.now() + 30 * 86400000),
  };
  state.membresias.push(m);
  return m;
}

export function crearMembresiaHandler(state: MockState) {
  return {
    membresia: {
      async findUnique({ where, include }: any) {
        const m = state.membresias.find((item) => {
          if (where.id !== undefined && item.id !== where.id) return false;
          if (where.stripeSubscriptionId !== undefined && item.stripeSubscriptionId !== where.stripeSubscriptionId) return false;
          return true;
        });
        if (!m) return null;
        if (include?.plan) {
          const plan = state.planesMembresia.find((p) => p.id === m.planId) ?? null;
          return { ...m, plan };
        }
        return { ...m };
      },
      async findFirst({ where, include }: any) {
        const m = state.membresias.find((item) => {
          if (where?.id !== undefined && item.id !== where.id) return false;
          if (where?.usuarioId !== undefined && item.usuarioId !== where.usuarioId) return false;
          if (where?.estado !== undefined) {
            if (typeof where.estado === "string" && item.estado !== where.estado) return false;
            if (where.estado?.not !== undefined && item.estado === where.estado.not) return false;
          }
          if (where?.stripeSubscriptionId !== undefined && item.stripeSubscriptionId !== where.stripeSubscriptionId) return false;
          return true;
        });
        if (!m) return null;
        if (include?.plan) {
          const plan = state.planesMembresia.find((p) => p.id === m.planId) ?? null;
          return { ...m, plan };
        }
        return { ...m };
      },
      async findMany({ where, include }: any) {
        return state.membresias
          .filter((item) => {
            if (where?.usuarioId !== undefined && item.usuarioId !== where.usuarioId) return false;
            if (where?.estado !== undefined && item.estado !== where.estado) return false;
            return true;
          })
          .map((m) => {
            if (include?.plan) {
              const plan = state.planesMembresia.find((p) => p.id === m.planId) ?? null;
              return { ...m, plan };
            }
            return { ...m };
          });
      },
      async create({ data, include }: any) {
        if (data.estado === "VIGENTE") {
          const existing = state.membresias.find((m) => m.usuarioId === data.usuarioId && m.estado === "VIGENTE");
          if (existing) {
            const err = new Error("Unique constraint failed on the fields: (`usuario_id`)") as Error & { code: string };
            err.code = "P2002";
            throw err;
          }
        }
        if (data.stripeSubscriptionId) {
          const existingSub = state.membresias.find((m) => m.stripeSubscriptionId === data.stripeSubscriptionId);
          if (existingSub) {
            const err = new Error("Unique constraint failed on the fields: (`stripe_subscription_id`)") as Error & { code: string };
            err.code = "P2002";
            throw err;
          }
        }
        const item: MockMembresia = {
          id: state.seq.membresiaIdSeq++,
          usuarioId: data.usuarioId,
          planId: data.planId,
          estado: data.estado,
          fechaInicio: data.fechaInicio ?? new Date(),
          proximaRenovacion: data.proximaRenovacion ?? new Date(),
          stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        };
        state.membresias.push(item);
        if (include?.plan) {
          const plan = state.planesMembresia.find((p) => p.id === item.planId) ?? null;
          return { ...item, plan };
        }
        return { ...item };
      },
      async update({ where, data, include }: any) {
        const m = state.membresias.find((item) => item.id === where.id);
        if (!m) throw new Error("Not found");
        if (data.estado !== undefined) m.estado = data.estado;
        if (data.proximaRenovacion !== undefined) m.proximaRenovacion = data.proximaRenovacion;
        if (data.stripeSubscriptionId !== undefined) m.stripeSubscriptionId = data.stripeSubscriptionId;
        if (include?.plan) {
          const plan = state.planesMembresia.find((p) => p.id === m.planId) ?? null;
          return { ...m, plan };
        }
        return { ...m };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const membresia of state.membresias) {
          if (where?.id !== undefined && membresia.id !== where.id) continue;
          if (where?.estado?.not !== undefined && membresia.estado === where.estado.not) {
            continue;
          }
          if (where?.estado !== undefined && typeof where.estado === "string") {
            if (membresia.estado !== where.estado) continue;
          }
          if (data.estado !== undefined) membresia.estado = data.estado;
          if (data.proximaRenovacion !== undefined) membresia.proximaRenovacion = data.proximaRenovacion;
          count++;
        }
        return { count };
      },
    },
    planMembresia: {
      async findUnique({ where }: any) {
        return state.planesMembresia.find((p) => {
          if (where.id !== undefined && p.id !== where.id) return false;
          if (where.stripePriceId !== undefined && p.stripePriceId !== where.stripePriceId) return false;
          return true;
        }) ?? null;
      },
      async findFirst({ where }: any) {
        return state.planesMembresia.find((p) => {
          if (where?.id !== undefined && p.id !== where.id) return false;
          if (where?.nombre !== undefined && p.nombre !== where.nombre) return false;
          if (where?.activo !== undefined && p.activo !== where.activo) return false;
          if (where?.stripePriceId !== undefined && p.stripePriceId !== where.stripePriceId) return false;
          return true;
        }) ?? null;
      },
      async findMany({ where }: any) {
        return state.planesMembresia.filter((p) => {
          if (where?.activo !== undefined && p.activo !== where.activo) return false;
          return true;
        });
      },
      async create({ data }: any) {
        const item: MockPlanMembresia = {
          id: state.seq.planIdSeq++,
          nombre: data.nombre,
          periodicidad: data.periodicidad,
          precio: data.precio,
          descuentoPct: data.descuentoPct ?? 30.0,
          stripePriceId: data.stripePriceId ?? null,
          activo: data.activo ?? true,
        };
        state.planesMembresia.push(item);
        return item;
      },
    },
  };
}
