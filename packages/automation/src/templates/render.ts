import React from "react";
import { createRequire } from "node:module";
import {
  TicketEmailTemplate,
  type TicketEmailTemplateProps,
} from "./TicketEmailTemplate.js";

const req = createRequire(import.meta.url);

function getRenderToStaticMarkup(): (element: React.ReactElement) => string {
  const server = req("react-dom/server");
  return server.renderToStaticMarkup || server.default?.renderToStaticMarkup;
}

/**
 * Renderiza la plantilla TicketEmailTemplate a un string HTML listo para ser
 * enviado mediante cualquier proveedor de correo transaccional (Resend, SES, SendGrid, etc.).
 *
 * @param props Datos y atributos del tiquete deportivo
 * @returns Cadena HTML completa con doctype estándar
 */
export function renderTicketEmail(props: TicketEmailTemplateProps): string {
  const render = getRenderToStaticMarkup();
  const markup = render(React.createElement(TicketEmailTemplate, props));
  return `<!DOCTYPE html>${markup}`;
}
