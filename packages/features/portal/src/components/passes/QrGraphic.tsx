'use client'

import { useEffect, useState } from 'react'
import { generarQRDataUrl } from '../../utils/portal-utils'

/**
 * Gráfico QR estándar de alta definición renderizado desde data URL PNG (RF-10 / RF-13).
 * Decodificable directamente por torniquetes ópticos perimetrales y lectores de mano.
 * Extraído de QrModal: componente puro compartido por todos los modales de pase.
 */
export function QRGraphicHD({
  code,
  dataUrl: initialDataUrl,
}: {
  code: string
  dataUrl?: string | null | undefined
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(initialDataUrl ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (initialDataUrl) {
      setDataUrl(initialDataUrl)
      return
    }
    let isCurrent = true
    generarQRDataUrl(code, 300)
      .then((url) => {
        if (isCurrent) setDataUrl(url)
      })
      .catch(() => {
        if (isCurrent) setError(true)
      })
    return () => {
      isCurrent = false
    }
  }, [code, initialDataUrl])

  return (
    <div className="qr-modal-hd" aria-label={`Código QR de acceso para ticket ${code}`}>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Código QR de acceso ${code}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : error ? (
        <div style={{ color: 'var(--subtle)', fontSize: '13px' }}>Error al generar QR</div>
      ) : (
        <div style={{ color: 'var(--subtle)', fontSize: '12px' }}>Generando QR...</div>
      )}
    </div>
  )
}
