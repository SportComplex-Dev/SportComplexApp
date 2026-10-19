import React from "react";

export interface TicketEmailTemplateProps {
  customerName: string;
  ticketCode: string;
  facilityName: string;
  venueName: string; // ej. Sede El Poblado / Sede Laureles
  bookingDate: string;
  timeSlot: string; // ej. 18:00 - 19:30
  qrCodeSrc: string; // Data URI (data:image/png;base64,...) o Content-ID embebido (cid:ticket-qr)
  totalPaid: string;
  paymentStatus?: string; // ej. PAGADO (Stripe Cashless)
}

/**
 * Plantilla de correo electrónico transaccional responsiva para confirmación
 * de reserva y pase deportivo con código QR de acceso integrado (RNF-05 / HU-39).
 *
 * Utiliza tablas HTML seguras con estilos inline puros para máxima compatibilidad
 * con clientes estrictos de correo (Gmail, Outlook Windows/Web, Apple Mail, Yahoo).
 */
export function TicketEmailTemplate({
  customerName,
  ticketCode,
  facilityName,
  venueName,
  bookingDate,
  timeSlot,
  qrCodeSrc,
  totalPaid,
  paymentStatus = "PAGADO (Stripe Cashless)",
}: TicketEmailTemplateProps): React.JSX.Element {
  const fontStack =
    "'Plus Jakarta Sans', Arial, Helvetica, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const monoStack =
    "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace";

  return (
    <html lang="es">
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>Pase Deportivo Oficial - AKROS Active Lifestyle Club</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          width: "100%",
          backgroundColor: "#f7f8f5",
          fontFamily: fontStack,
          WebkitFontSmoothing: "antialiased",
          color: "#18221c",
        }}
      >
        {/* Contenedor Exterior Centrado */}
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width="100%"
          style={{
            backgroundColor: "#f7f8f5",
            padding: "24px 12px",
            margin: "0 auto",
          }}
        >
          <tbody>
            <tr>
              <td align="center">
                {/* Tarjeta Principal de Ancho Máximo 600px */}
                <table
                  role="presentation"
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  width="100%"
                  style={{
                    maxWidth: "600px",
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e2e6df",
                    overflow: "hidden",
                    margin: "0 auto",
                    boxShadow: "0 4px 20px rgba(18, 62, 48, 0.05)",
                  }}
                >
                  <tbody>
                    {/* 1. Membrete Superior: Marca AKROS y Badge */}
                    <tr>
                      <td
                        style={{
                          backgroundColor: "#123e30",
                          padding: "36px 32px 30px 32px",
                          textAlign: "center",
                        }}
                      >
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          width="100%"
                        >
                          <tbody>
                            <tr>
                              <td align="center">
                                {/* Isotipo / Logotipo Tipográfico */}
                                <div
                                  style={{
                                    fontSize: "24px",
                                    fontWeight: 800,
                                    letterSpacing: "4px",
                                    color: "#ffffff",
                                    textTransform: "uppercase",
                                    margin: "0 0 4px 0",
                                  }}
                                >
                                  AKROS
                                </div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    letterSpacing: "2.5px",
                                    color: "#c9ef75",
                                    textTransform: "uppercase",
                                    margin: "0 0 20px 0",
                                  }}
                                >
                                  ACTIVE LIFESTYLE CLUB
                                </div>

                                {/* Badge de Confirmación */}
                                <div
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#c9ef75",
                                    color: "#123e30",
                                    padding: "6px 16px",
                                    borderRadius: "9999px",
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    letterSpacing: "0.5px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Reserva Confirmada • Pase Oficial
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 2. Saludo y Mensaje Personalizado */}
                    <tr>
                      <td style={{ padding: "32px 32px 12px 32px" }}>
                        <h1
                          style={{
                            margin: "0 0 12px 0",
                            fontSize: "22px",
                            fontWeight: 700,
                            color: "#123e30",
                            lineHeight: "1.3",
                          }}
                        >
                          ¡Hola, {customerName}!
                        </h1>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            lineHeight: "1.6",
                            color: "#46544c",
                          }}
                        >
                          Tu reserva deportiva ha sido procesada exitosamente. A
                          continuación encontrarás los detalles de tu turno y tu
                          código QR oficial para el acceso ágil en los
                          torniquetes y portería.
                        </p>
                      </td>
                    </tr>

                    {/* 3. Contenedor del Código QR de Acceso (RNF-05) */}
                    <tr>
                      <td style={{ padding: "12px 32px 24px 32px" }} align="center">
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          style={{
                            backgroundColor: "#f7f8f5",
                            borderRadius: "14px",
                            border: "1px dashed #c4ccc0",
                            padding: "24px 20px",
                            width: "100%",
                            maxWidth: "340px",
                            textAlign: "center",
                          }}
                        >
                          <tbody>
                            <tr>
                              <td align="center">
                                {/* Marco blanco de seguridad (Quiet Zone) */}
                                <div
                                  style={{
                                    backgroundColor: "#ffffff",
                                    padding: "16px",
                                    borderRadius: "12px",
                                    border: "1px solid #e2e6df",
                                    display: "inline-block",
                                    boxShadow:
                                      "0 2px 8px rgba(18, 62, 48, 0.06)",
                                  }}
                                >
                                  <img
                                    src={qrCodeSrc}
                                    alt="Código QR de Acceso Deportivo"
                                    width={220}
                                    height={220}
                                    style={{
                                      display: "block",
                                      width: "220px",
                                      height: "220px",
                                      margin: "0 auto",
                                      border: "0",
                                      outline: "none",
                                      textDecoration: "none",
                                    }}
                                  />
                                </div>

                                <div
                                  style={{
                                    marginTop: "16px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "#123e30",
                                    lineHeight: "1.4",
                                  }}
                                >
                                  Presenta este código directamente en los
                                  torniquetes o al personal de portería para
                                  ingresar a las instalaciones.
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 4. Tarjeta de Detalles del Turno (Ticket Summary) */}
                    <tr>
                      <td style={{ padding: "0 32px 28px 32px" }}>
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          width="100%"
                          style={{
                            backgroundColor: "#f7f8f5",
                            borderRadius: "12px",
                            border: "1px solid #e2e6df",
                            padding: "20px",
                          }}
                        >
                          <tbody>
                            {/* Código de Tiquete */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Código de Tiquete:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "14px",
                                  color: "#123e30",
                                  fontWeight: 700,
                                  fontFamily: monoStack,
                                  letterSpacing: "0.5px",
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                {ticketCode}
                              </td>
                            </tr>

                            {/* Escenario / Cancha */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Escenario Deportivo:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "14px",
                                  color: "#18221c",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                {facilityName}
                              </td>
                            </tr>

                            {/* Sede */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Sede:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "14px",
                                  color: "#18221c",
                                  fontWeight: 600,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                {venueName}
                              </td>
                            </tr>

                            {/* Fecha */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Fecha de Turno:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "14px",
                                  color: "#18221c",
                                  fontWeight: 600,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                {bookingDate}
                              </td>
                            </tr>

                            {/* Franja Horaria */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Franja Horaria:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "14px",
                                  color: "#123e30",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                {timeSlot}
                              </td>
                            </tr>

                            {/* Estado de Pago */}
                            <tr>
                              <td
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#5c6f64",
                                  fontWeight: 500,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                Estado de Pago:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "8px 0",
                                  fontSize: "13px",
                                  color: "#123e30",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #e7ebe4",
                                }}
                              >
                                <span
                                  style={{
                                    backgroundColor: "rgba(201, 239, 117, 0.4)",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  {paymentStatus}
                                </span>
                              </td>
                            </tr>

                            {/* Importe Pagado */}
                            <tr>
                              <td
                                style={{
                                  padding: "10px 0 2px 0",
                                  fontSize: "14px",
                                  color: "#123e30",
                                  fontWeight: 700,
                                }}
                              >
                                Total Pagado:
                              </td>
                              <td
                                align="right"
                                style={{
                                  padding: "10px 0 2px 0",
                                  fontSize: "16px",
                                  color: "#123e30",
                                  fontWeight: 800,
                                }}
                              >
                                {totalPaid}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 5. Normas Rápidas de Ingreso (Alineadas con /rules) */}
                    <tr>
                      <td
                        style={{
                          padding: "0 32px 28px 32px",
                        }}
                      >
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          width="100%"
                          style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            border: "1px solid #e2e6df",
                            padding: "20px",
                          }}
                        >
                          <tbody>
                            <tr>
                              <td
                                colSpan={2}
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  color: "#123e30",
                                  paddingBottom: "12px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                Normas esenciales de acceso
                              </td>
                            </tr>
                            {/* Regla 1: 10 min de gracia */}
                            <tr>
                              <td
                                style={{
                                  width: "24px",
                                  verticalAlign: "top",
                                  paddingBottom: "10px",
                                  fontSize: "14px",
                                }}
                              >
                                •
                              </td>
                              <td
                                style={{
                                  fontSize: "13px",
                                  lineHeight: "1.5",
                                  color: "#3d4b43",
                                  paddingBottom: "10px",
                                }}
                              >
                                <strong>10 minutos de tiempo de gracia:</strong>{" "}
                                Te recomendamos llegar 10 minutos antes del
                                inicio de tu franja horaria para el registro y
                                alistamiento deportivo.
                              </td>
                            </tr>

                            {/* Regla 2: Calzado deportivo */}
                            <tr>
                              <td
                                style={{
                                  width: "24px",
                                  verticalAlign: "top",
                                  paddingBottom: "10px",
                                  fontSize: "14px",
                                }}
                              >
                                •
                              </td>
                              <td
                                style={{
                                  fontSize: "13px",
                                  lineHeight: "1.5",
                                  color: "#3d4b43",
                                  paddingBottom: "10px",
                                }}
                              >
                                <strong>Calzado deportivo adecuado:</strong> Es
                                de uso estricto y obligatorio el calzado
                                reglamentario según la superficie del escenario
                                asignado.
                              </td>
                            </tr>

                            {/* Regla 3: Acceso personal */}
                            <tr>
                              <td
                                style={{
                                  width: "24px",
                                  verticalAlign: "top",
                                  fontSize: "14px",
                                }}
                              >
                                •
                              </td>
                              <td
                                style={{
                                  fontSize: "13px",
                                  lineHeight: "1.5",
                                  color: "#3d4b43",
                                }}
                              >
                                <strong>Acceso personal e intransferible:</strong>{" "}
                                Este código QR es único y valida exclusivamente
                                la entrada para el titular de la reserva y su
                                franja confirmada.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 6. Pie Institucional */}
                    <tr>
                      <td
                        style={{
                          backgroundColor: "#f7f8f5",
                          borderTop: "1px solid #e2e6df",
                          padding: "24px 32px",
                          textAlign: "center",
                          fontSize: "12px",
                          lineHeight: "1.6",
                          color: "#6b7b71",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 8px 0",
                            fontWeight: 600,
                            color: "#123e30",
                          }}
                        >
                          AKROS Active Lifestyle Club • Medellín, Colombia
                        </p>
                        <p style={{ margin: "0 0 12px 0" }}>
                          Sede El Poblado: Cl. 10 # 32-15 • Sede Laureles:
                          Circular 4 # 71-30
                        </p>
                        <p style={{ margin: "0 0 16px 0" }}>
                          ¿Tienes dudas con tu acceso? Contáctanos vía{" "}
                          <a
                            href="https://wa.me/573000000000"
                            style={{
                              color: "#123e30",
                              fontWeight: 700,
                              textDecoration: "underline",
                            }}
                          >
                            WhatsApp Concierge Deportivo
                          </a>{" "}
                          o a soporte@sportcomplex.club
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            color: "#8c9b92",
                          }}
                        >
                          AKROS Club / SportComplex © 2026. Todos los derechos
                          reservados. Este mensaje transaccional certifica la
                          contratación de servicio bajo los términos y
                          condiciones del club.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
