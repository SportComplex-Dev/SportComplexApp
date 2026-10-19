import type { TicketComprobanteInput } from '@sportcomplex/printing'

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/** Estados en los que la reserva ya no se va a pagar. */
const ESTADOS_FINALES = ['EXPIRADA', 'CANCELADA', 'CANCELADA_PAGO', 'CANCELADA_ADMINISTRATIVA']

export class PagoNoCompletadoError extends Error {
  constructor(readonly estado: string) {
    super(
      estado === 'SIN_CONFIRMACION'
        ? 'Stripe aún no confirma el pago. Cuando se confirme, imprima el ticket desde "Imprimir ticket de una reserva".'
        : estado === 'EXPIRADA'
          ? 'El cliente no pagó a tiempo: la reserva expiró y el cupo se liberó.'
          : `El pago no se completó (reserva ${estado}).`,
    )
    this.name = 'PagoNoCompletadoError'
  }
}

export interface EsperarPagoOptions {
  fetchImpl?: FetchLike
  intervaloMs?: number
  /** 30 min de hold (`CHECKOUT_TTL_MINUTES`) / 3 s ≈ 600 consultas. */
  maxIntentos?: number
  signal?: AbortSignal
}

function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

/**
 * Cobro con QR en taquilla: espera a que el webhook de Stripe confirme la
 * reserva y emita el pase. Devuelve el comprobante de taquilla (con el QR
 * firmado) listo para imprimir.
 */
export async function esperarPagoTaquilla(
  reservaId: string,
  { fetchImpl = fetch, intervaloMs = 3000, maxIntentos = 600, signal }: EsperarPagoOptions = {},
): Promise<TicketComprobanteInput> {
  for (let intento = 0; intento < maxIntentos; intento++) {
    if (signal?.aborted) throw signal.reason
    try {
      const res = await fetchImpl(`/api/pdf/receipt?reservaId=${encodeURIComponent(reservaId)}&destinatario=POS`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json().catch(() => null)) as any
      const comprobante = json?.data as TicketComprobanteInput | undefined
      if (res.ok && comprobante?.qr) return comprobante
      const estado = comprobante?.reserva?.estado
      if (estado && ESTADOS_FINALES.includes(estado)) throw new PagoNoCompletadoError(estado)
    } catch (e) {
      if (e instanceof PagoNoCompletadoError) throw e
      // Error de red puntual: se reintenta en el siguiente ciclo.
    }
    await esperar(intervaloMs, signal)
  }
  throw new PagoNoCompletadoError('SIN_CONFIRMACION')
}
