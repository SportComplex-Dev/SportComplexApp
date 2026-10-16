import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TicketEmailTemplate,
  type TicketEmailTemplateProps,
} from "./TicketEmailTemplate.js";

/**
 * Renderiza la plantilla TicketEmailTemplate a un string HTML listo para ser
 * enviado mediante cualquier proveedor de correo transaccional (Resend, SES, SendGrid, etc.).
 *
 * @param props Datos y atributos del tiquete deportivo
 * @returns Cadena HTML completa con doctype estándar
 */
export function renderTicketEmail(props: TicketEmailTemplateProps): string {
  const markup = renderToStaticMarkup(
    React.createElement(TicketEmailTemplate, props),
  );
  return `<!DOCTYPE html>${markup}`;
}
