import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "@sportcomplex/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

import {
  ConsultationResultCard,
  type TicketInfo,
} from "../ConsultationResultCard";
import { ConsultationModeCard } from "../ConsultationModeCard";
import { ScannerCameraView } from "../ScannerCameraView";
import { ManualEntryCard } from "../ManualEntryCard";

// TSK-FE-15: Test de la Visual / Renderizado de Componentes UI
// Verifica la renderización HTML de los componentes visuales según DESIGN.md y SRS RF-13.

const mockTicketEmitido: TicketInfo = {
  id: "ticket-uuid-100",
  reservaId: "reserva-uuid-200",
  estado: "EMITIDO",
  servicioId: 1,
  servicioNombre: "Piscina Semiolímpica",
  fecha: "2026-10-10",
  horaInicio: "08:00:00",
  horaFin: "09:00:00",
  titularId: "user-uuid-300",
  titularNombre: "Leonardo Perez",
};

const mockTicketUsado: TicketInfo = {
  ...mockTicketEmitido,
  id: "ticket-uuid-101",
  estado: "USADO",
};

function ConsultationViewInitial() {
  return (
    <main>
      <header>
        <h1>Control de Acceso</h1>
        <Badge variant="admin">Staff Portería</Badge>
      </header>
      <ConsultationModeCard isConsultationMode={true} onToggle={() => {}} />
      <ScannerCameraView
        consultationCameraActive={false}
        consultationLoading={false}
        consultationCameraError={null}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
      <ManualEntryCard
        showManualInput={false}
        setShowManualInput={() => {}}
        manualPayload=""
        setManualPayload={() => {}}
        manualTicketId=""
        setManualTicketId={() => {}}
        manualSignature=""
        setManualSignature={() => {}}
        consultationLoading={false}
        onSubmit={() => {}}
      />
    </main>
  );
}

test("VISUAL TSK-FE-15: ConsultationResultCard renderiza los 4 campos y el estado EMITIDO", () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard
      ticket={mockTicketEmitido}
      modo="CONSULTA"
      onReset={() => {}}
    />
  );

  // 1. Verificación visual del título y badge
  assert.ok(html.includes("Información del Boleto"), "Debe mostrar el título de información");
  assert.ok(html.includes("EMITIDO"), "Debe renderizar el badge EMITIDO");

  // 2. Verificación visual de los 4 campos obligatorios del alcance técnico
  assert.ok(html.includes("Piscina Semiolímpica"), "Debe mostrar el nombre del servicio");
  assert.ok(html.includes("Leonardo Perez"), "Debe mostrar el titular de la reserva");
  assert.ok(html.includes("2026-10-10"), "Debe mostrar la fecha programada");
  assert.ok(html.includes("08:00:00 – 09:00:00"), "Debe mostrar la franja horaria");

  // 3. Verificación visual del banner de seguridad y garantía de no consumo
  assert.ok(
    html.includes("no se realizan gastos ni canjes"),
    "Debe mostrar la leyenda explícita de que no se realizan gastos ni canjes"
  );
  assert.ok(
    html.includes("El boleto permanece en estado <strong>EMITIDO</strong>"),
    "Debe confirmar visualmente que el boleto permanece en EMITIDO"
  );

  // 4. Verificación de acción permitida
  assert.ok(html.includes("Consultar otro boleto"), "Debe incluir el botón para consultar otro boleto");
});

test("VISUAL TSK-FE-15 (INVARIANTE CRÍTICO): La vista NO contiene ningún botón ni acción de canje", () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard
      ticket={mockTicketEmitido}
      modo="CONSULTA"
      onReset={() => {}}
    />
  );

  // Prohibición absoluta de botones o textos de consumo
  assert.ok(!html.includes("Dar acceso"), "NO debe contener el texto 'Dar acceso'");
  assert.ok(!html.includes("Canjear"), "NO debe contener el texto 'Canjear'");
  assert.ok(!html.includes("Consumir"), "NO debe contener el texto 'Consumir'");
  assert.ok(!html.includes("Gastar"), "NO debe contener el texto 'Gastar'");
  assert.ok(!html.includes("Validar entrada"), "NO debe contener el texto 'Validar entrada'");
});

test("VISUAL TSK-FE-15: ConsultationResultCard renderiza correctamente un ticket en estado USADO", () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard
      ticket={mockTicketUsado}
      modo="CONSULTA"
      onReset={() => {}}
    />
  );

  assert.ok(html.includes("USADO"), "Debe renderizar el badge USADO");
  assert.ok(html.includes("Piscina Semiolímpica"), "Debe seguir mostrando el servicio");
  assert.ok(!html.includes("Dar acceso"), "Aún en estado USADO, no debe existir botón de canje");
});

test("VISUAL TSK-FE-15: ScannerPage renderiza el estado inicial de Modo Consulta sin puesto asignado", () => {
  const html = renderToStaticMarkup(<ConsultationViewInitial />);

  // Título y encabezado de la página
  assert.ok(html.includes("Control de Acceso"), "Debe renderizar el título de la página");
  assert.ok(html.includes("Staff Portería"), "Debe renderizar el badge de rol");

  // Toggle y banner de modo consulta
  assert.ok(html.includes("Modo Consulta Informativo"), "Debe renderizar la sección de modo consulta");
  assert.ok(html.includes("Puesto asignado: Ninguno"), "Debe explicitar que no hay puesto asignado");
  assert.ok(html.includes("Activado"), "El toggle de modo consulta debe estar activado por defecto");

  // Sección de cámara y simulación QA
  assert.ok(html.includes("Lector de Cámara"), "Debe renderizar la sección del lector de cámara");
  assert.ok(html.includes("Iniciar cámara"), "Debe mostrar el botón para iniciar la cámara");
  assert.ok(
    html.includes("Ingreso manual / Simulación para pruebas (QA)"),
    "Debe mostrar el acordeón de simulación manual"
  );
});
