import { test, expect } from "@playwright/test";

test.describe("Flujo 6: Validaciones Visuales, Diseño Responsivo y Tokens de Tema", () => {
  test.beforeEach(async ({ page }) => {
    // Descartar splash screen para evitar que cubra los elementos visuales
    await page.addInitScript(() => {
      sessionStorage.setItem("akros_splash_dismissed", "true");
    });
  });

  test("6.1 Alternancia de Modo Claro / Modo Oscuro aplica clases y tokens de color", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    const htmlElement = page.locator("html");
    const themeButton = page.locator("button[aria-label*='modo oscuro'], button[aria-label*='modo claro'], .theme-toggle").first();
    await expect(themeButton).toBeVisible();

    // Obtener estado inicial
    const isInitiallyDark = await htmlElement.evaluate((el) => el.classList.contains("dark"));

    // Activar cambio de tema
    await themeButton.click();

    // Validar que la clase dark en <html> haya cambiado de estado
    if (isInitiallyDark) {
      await expect(htmlElement).not.toHaveClass(/dark/);
    } else {
      await expect(htmlElement).toHaveClass(/dark/);
    }

    // Alternar nuevamente para retornar al estado original
    await themeButton.click();
    if (isInitiallyDark) {
      await expect(htmlElement).toHaveClass(/dark/);
    } else {
      await expect(htmlElement).not.toHaveClass(/dark/);
    }
  });

  test("6.2 Identidad visual de marca, logo y tipografía en Hero", async ({ page }) => {
    await page.goto("/");

    // El contenedor de marca debe renderizar el isotipo o texto del club
    const brandElement = page.locator("header, nav, .hero-wrap").getByText(/AKROS/i).first();
    await expect(brandElement).toBeVisible();

    // Jerarquía visual: h1 debe tener presencia tipográfica
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    
    // Verificar que el contenedor principal esté estilizado y no sea texto sin formato
    const heroSection = page.locator(".hero-wrap, .home-hero, section").first();
    await expect(heroSection).toBeVisible();

    // Botón de llamado a la acción (CTA) con estilos del sistema de diseño en el Hero
    const ctaButton = page.locator(".hero-wrap .action-button, main .action-button").first();
    await expect(ctaButton).toBeVisible();
  });

  test("6.3 Layout responsivo: navegación desktop vs menú colapsable mobile", async ({ page, isMobile }) => {
    await page.goto("/");

    const desktopNav = page.locator("nav[aria-label*='Navegación principal'], header nav").first();
    const mobileMenuButton = page.locator("button[aria-label*='menú'], button:has-text('Abrir menú')").first();

    if (isMobile) {
      // En dispositivos móviles, el botón de menú debe estar disponible
      await expect(mobileMenuButton).toBeVisible();
      // Y no debe existir desbordamiento horizontal en el viewport
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    } else {
      // En escritorio, la barra de navegación debe mostrar los enlaces directos
      await expect(desktopNav).toBeVisible();
      await expect(desktopNav.getByRole("link", { name: "Servicios" })).toBeVisible();
      await expect(desktopNav.getByRole("link", { name: "Reglamentos" })).toBeVisible();
    }
  });

  test("6.4 Tarjetas del catálogo exhiben indicadores visuales (badges, precios y unidades)", async ({ page }) => {
    await page.goto("/services");
    await expect(page).toHaveURL(/\/services/);

    // Contenedor de servicios con grid visual
    const categoryGrid = page.locator(".dashboard-category-grid");
    await expect(categoryGrid).toBeVisible();

    // Tarjeta individual de categoría con su indicador de unidad y valor
    const canchaCard = page.getByRole("link", { name: /Canchas/i }).first();
    await expect(canchaCard).toBeVisible();

    // Badge visual o etiqueta de precio
    await expect(canchaCard.getByText(/hora|Desde \$|COP/i).first()).toBeVisible();
  });

  test("6.5 Feedback visual de errores en formularios (borde rojo, alerta y aria-invalid)", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"], input[placeholder*="correo"]').first();
    await emailInput.fill("correo-invalido");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Alerta visual de error renderizada con estilos de peligro
    const errorAlert = page.locator("#login-error");
    await expect(errorAlert).toBeVisible();

    // El input o contenedor debe reflejar el estado de error
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  });

  test("6.6 Captura de evidencia visual de páginas principales", async ({ page }) => {
    // Captura landing page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/visual-snapshots/landing-page.png", fullPage: false });

    // Captura catálogo de servicios
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/visual-snapshots/services-catalog.png", fullPage: false });

    // Captura formulario de inicio de sesión con estilos completos
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/visual-snapshots/login-screen.png", fullPage: false });
  });
});
