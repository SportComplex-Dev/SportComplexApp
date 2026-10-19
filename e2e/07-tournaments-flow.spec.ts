import { test, expect } from "@playwright/test";

test.describe("Flujo 7: Auditoría y Experiencia de Torneos en Landing Page (SCRUM-182 / SCRUM-183 / SCRUM-184)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("7.1 La sección de torneos renderiza cards oficiales con metadatos y botones activos", async ({
    page,
  }) => {
    const torneosSection = page.locator("#torneos");
    await torneosSection.scrollIntoViewIfNeeded();
    await expect(torneosSection).toBeVisible();

    // Título y encabezado
    await expect(torneosSection.getByRole("heading", { level: 2 })).toContainText(
      /Torneos, clínicas y/i
    );

    // Cards de torneos
    const cards = torneosSection.locator(".tournament-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // La primera card tiene botones de 'Detalles' e 'Inscribirme'
    const firstCard = cards.first();
    await expect(firstCard.locator(".event-detail-btn")).toBeVisible();
    await expect(firstCard.locator(".event-register-btn, .event-registered-badge")).toBeVisible();
  });

  test("7.2 El botón 'Detalles' abre el modal con aforo, horario y especificaciones", async ({
    page,
  }) => {
    const torneosSection = page.locator("#torneos");
    await torneosSection.scrollIntoViewIfNeeded();

    const firstCard = torneosSection.locator(".tournament-card").first();
    await expect(firstCard).toBeVisible();
    const tournamentTitle = await firstCard.locator(".event-title").textContent();

    // Click en 'Detalles'
    await firstCard.locator(".event-detail-btn").click();

    // Modal de detalle visible - usar role="dialog" del Modal de @sportcomplex/ui
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { level: 2 })).toContainText(
      /Información Oficial del Torneo/i
    );

    // Muestra el título del torneo y métricas de ocupación
    await expect(modal.locator("h3")).toContainText(tournamentTitle?.trim() || "");
    await expect(modal.getByText(/completado|cupos disponibles/i).first()).toBeVisible();

    // Botones de acción en el modal
    const registerCta = modal.getByRole("button", { name: /Inscribirme al Torneo/i });
    await expect(registerCta).toBeVisible();

    // Click en 'Inscribirme al Torneo' desde el modal de detalle abre el modal de inscripción
    await registerCta.click();

    const regModal = page.locator('[role="dialog"]').first();
    await expect(regModal).toBeVisible();
    await expect(regModal.getByRole("heading", { level: 2 })).toContainText(
      /Inscripción a Torneo Deportivo/i
    );
  });

  test("7.3 El botón 'Inscribirme' en la card abre directamente el flujo de registro", async ({
    page,
  }) => {
    const torneosSection = page.locator("#torneos");
    await torneosSection.scrollIntoViewIfNeeded();

    const firstCard = torneosSection.locator(".tournament-card").first();
    await expect(firstCard).toBeVisible();
    const registerBtn = firstCard.locator(".event-register-btn").first();

    await registerBtn.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { level: 2 })).toContainText(
      /Inscripción a Torneo Deportivo/i
    );
  });
});
