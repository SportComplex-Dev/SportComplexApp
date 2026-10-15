import { formatMoney } from "@sportcomplex/core";

export interface DesgloseComprobante {
  subtotal: number;
  iva: number;
  total: number;
  subtotalFormateado: string;
  ivaFormateado: string;
  totalFormateado: string;
}

export function calcularDesgloseComprobante(amount: number): DesgloseComprobante {
  const subtotal = Math.round(amount / 1.19);
  const iva = amount - subtotal;
  return {
    subtotal,
    iva,
    total: amount,
    subtotalFormateado: formatMoney(subtotal),
    ivaFormateado: formatMoney(iva),
    totalFormateado: formatMoney(amount),
  };
}
