import type { TicketComprobanteInput } from '@sportcomplex/printing'

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: { message?: string }
}

async function leer<T>(res: Awaited<ReturnType<FetchLike>>, fallback: string): Promise<T> {
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success || json.data === undefined) {
    throw new Error(json?.error?.message || fallback)
  }
  return json.data
}

/**
 * Reimpresión en taquilla: código leído del QR del pase (o UUID) → reserva →
 * comprobante de taquilla (`destinatario=POS`, solo personal).
 */
export async function buscarComprobanteParaReimpresion(
  codigo: string,
  fetchImpl: FetchLike = fetch,
): Promise<TicketComprobanteInput> {
  const { reservaId } = await leer<{ reservaId: string }>(
    await fetchImpl(`/api/pos/tickets/lookup?codigo=${encodeURIComponent(codigo.trim())}`),
    'No se encontró la reserva.',
  )
  return leer<TicketComprobanteInput>(
    await fetchImpl(`/api/pdf/receipt?reservaId=${encodeURIComponent(reservaId)}&destinatario=POS`),
    'No se pudo cargar el comprobante.',
  )
}
