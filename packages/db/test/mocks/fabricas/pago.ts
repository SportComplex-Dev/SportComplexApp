import type { MockState, MockPago } from "../estado.js";

export function crearMockPago(state: MockState, overrides: Partial<MockPago> = {}): MockPago {
  const pago: MockPago = {
    id: overrides.id ?? `pago-${state.seq.pagoIdSeq++}`,
    usuarioId: overrides.usuarioId ?? "user-1",
    tipo: overrides.tipo ?? "RESERVA",
    stripePaymentIntentId: overrides.stripePaymentIntentId ?? `pi_mock_${Date.now()}`,
    monto: overrides.monto ?? 50000,
    estado: overrides.estado ?? "APROBADO",
    creadoEn: overrides.creadoEn ?? new Date(),
  };
  state.pagos.push(pago);
  return pago;
}

export function crearPagoHandler(state: MockState) {
  return {
    async findUnique({ where }: any) {
      if (where.id !== undefined) {
        return state.pagos.find((p) => p.id === where.id) ?? null;
      }
      if (where.stripePaymentIntentId !== undefined) {
        return (
          state.pagos.find((p) => p.stripePaymentIntentId === where.stripePaymentIntentId) ?? null
        );
      }
      return null;
    },
    async findFirst({ where }: any = {}) {
      return (
        state.pagos.find((p) => {
          if (where?.id !== undefined && p.id !== where.id) return false;
          if (
            where?.stripePaymentIntentId !== undefined &&
            p.stripePaymentIntentId !== where.stripePaymentIntentId
          )
            return false;
          if (where?.usuarioId !== undefined && p.usuarioId !== where.usuarioId) return false;
          if (where?.estado !== undefined && p.estado !== where.estado) return false;
          return true;
        }) ?? null
      );
    },
    async create({ data }: any) {
      // Respeta el UNIQUE "pago_stripe_payment_intent_id_key" (TSK-BD-06).
      if (
        state.pagos.some((p) => p.stripePaymentIntentId === data.stripePaymentIntentId)
      ) {
        const err = new Error(
          "Unique constraint failed on the fields: (`stripe_payment_intent_id`)",
        ) as Error & { code: string };
        err.code = "P2002";
        throw err;
      }
      const item: MockPago = {
        id: `payment-${state.seq.pagoIdSeq++}`,
        usuarioId: data.usuarioId,
        membresiaId: data.membresiaId ?? null,
        tipo: data.tipo,
        stripePaymentIntentId: data.stripePaymentIntentId,
        monto: data.monto,
        estado: data.estado,
        creadoEn: new Date(),
      };
      state.pagos.push(item);
      return item;
    },
    async update({ where, data }: any) {
      const pago = state.pagos.find((p) => p.id === where.id || (where.stripePaymentIntentId && p.stripePaymentIntentId === where.stripePaymentIntentId));
      if (!pago) throw new Error("Not found");
      if (data.estado !== undefined) pago.estado = data.estado;
      if (data.monto !== undefined) pago.monto = data.monto;
      return pago;
    },
    async upsert({ where, create, update }: any) {
      const existing = state.pagos.find((p) => {
        if (where.id !== undefined && p.id === where.id) return true;
        if (where.stripePaymentIntentId !== undefined && p.stripePaymentIntentId === where.stripePaymentIntentId) return true;
        return false;
      });
      if (existing) {
        if (update) {
          if (update.estado !== undefined) existing.estado = update.estado;
          if (update.monto !== undefined) existing.monto = update.monto;
        }
        return existing;
      }
      return (this as any).create({ data: create });
    },
  };
}
