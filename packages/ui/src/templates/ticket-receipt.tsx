// RNF-05 — comprobante optimizado para PDF / @media print, QR centrado.
export function TicketReceipt(props: {
  serviceName: string;
  holder: string;
  startTime: string;
  endTime: string;
  qrDataUrl: string;
}) {
  return (
    <article className="ticket-receipt mx-auto max-w-sm rounded border p-6 text-center">
      <h2>SportComplex — Comprobante</h2>
      <p>{props.serviceName}</p>
      <p>Titular: {props.holder}</p>
      <p>
        {props.startTime} → {props.endTime}
      </p>
      <img src={props.qrDataUrl} alt="QR de acceso" className="mx-auto h-48 w-48" />
      <p className="no-print">Usa Imprimir → Guardar como PDF (RN-14).</p>
    </article>
  );
}