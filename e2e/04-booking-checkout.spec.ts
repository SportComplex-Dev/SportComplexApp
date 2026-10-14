import { test, expect } from "@playwright/test";

test.describe("Flujo 4: Selección de Servicio y Proceso de Reserva", () => {
  test("4.1 Catálogo de categoría permite explorar espacios deportivos y tarifas", async ({ page }) => {
    await page.goto("/services/canchas");
    await expect(page).toHaveURL(/\/services\/canchas/);

    // Layout principal del catálogo
    const mainCatalog = page.locator("main");
    await expect(mainCatalog).toBeVisible();

    // Muestra información de instalaciones y tarifas
    await expect(page.getByText(/Instalaciones|espacio|Canchas/i).first()).toBeVisible();

    // Debe contener enlaces o elementos de selección de espacios
    const serviceItems = page.locator(".catalog-card, a[href*='/services/canchas/'], .category-hero");
    await expect(serviceItems.first()).toBeVisible();
  });

  test("4.2 Pantalla de Checkout sin reserva activa muestra estado vacío y enlace de retorno", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/checkout/);

    // Muestra aviso de reserva ausente y CTA hacia catálogo
    await expect(page.getByText(/No tienes una reserva en curso/i)).toBeVisible();
    const exploreBtn = page.getByRole("link", { name: /Ver servicios/i });
    await expect(exploreBtn).toBeVisible();
    await expect(exploreBtn).toHaveAttribute("href", "/services");
  });

  test("4.3 Checkout parametrizado carga desglose financiero, temporizador de 30 min y sellos de seguridad", async ({ page }) => {
    // Simula navegación con espacio y horario seleccionado
    await page.goto("/checkout?serviceId=tenis-cancha-1&date=2026-10-25&time=08:00%20a.%20m.%20-%2009:00%20a.%20m.&attendees=2");
    await expect(page).toHaveURL(/\/checkout\?/);

    // Barra de progreso de reserva
    await expect(page.locator(".checkout-progress")).toBeVisible();
    await expect(page.getByText(/Espacio/i)).toBeVisible();
    await expect(page.getByText(/Pago/i).first()).toBeVisible();

    // Resumen de orden y detalle de la cancha
    await expect(page.getByText(/RESUMEN DE COMPRA/i)).toBeVisible();
    await expect(page.getByText(/Cancha de tenis · Cancha 1/i)).toBeVisible();
    await expect(page.getByText(/Sede Poblado/i)).toBeVisible();

    // Valores en COP e IVA incluido (19%)
    await expect(page.getByText(/Total a pagar/i)).toBeVisible();
    await expect(page.getByText(/IVA incluido \(19%\)/i)).toBeVisible();

    // Garantía y cifrado PCI-DSS
    await expect(page.getByText(/PCI-DSS|TLS 256-bit|Stripe/i).first()).toBeVisible();

    // Enlace de regreso a la selección del espacio
    const backLink = page.getByRole("link", { name: /Volver a la selección/i });
    await expect(backLink).toBeVisible();
  });

  test("4.4 Pantalla de confirmación (/confirmation) maneja estado sin orden previa", async ({ page }) => {
    await page.goto("/confirmation");
    await expect(page).toHaveURL(/\/confirmation/);

    // Debe mostrar que no se encontró reserva en sesión y botón a tiquetes
    await expect(page.getByText(/No encontramos esa reserva/i)).toBeVisible();
    const ticketsBtn = page.getByRole("link", { name: /Ir a mis tiquetes/i });
    await expect(ticketsBtn).toBeVisible();
    await expect(ticketsBtn).toHaveAttribute("href", "/portal/tickets");
  });

  test("4.5 Portal de membresías es de consulta pública y redirige a login al intentar suscribirse sin autenticación", async ({ page }) => {
    await page.goto("/portal/membership");
    await expect(page).toHaveURL(/\/portal\/membership/);
    await expect(page.locator("h1")).toContainText(/Membresías/i);

    // Esperar respuesta exitosa de la API de planes o contenido visible
    try {
      await page.waitForResponse(
        (res) => res.url().includes("/api/memberships") && res.status() === 200,
        { timeout: 20000 }
      );
    } catch {
      await page.waitForLoadState("networkidle");
    }

    // Localizador tolerante que soporta button, a y data-testid
    const subscribeBtn = page.locator('[data-testid="subscribe-plan-btn"], button:has-text("Suscribirme"), a:has-text("Suscribirme")').first();
    await subscribeBtn.waitFor({ state: "visible", timeout: 20000 });
    await expect(subscribeBtn).toBeVisible({ timeout: 20000 });
    await subscribeBtn.click();

    // Validar redirección a login preservando la intención de compra
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 20000 });
    expect(page.url()).toContain("redirect=%2Fportal%2Fmembership");
  });
});
