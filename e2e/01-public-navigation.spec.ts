import { test, expect } from "@playwright/test";

test.describe("Flujo 1: Navegación Pública y Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    // Descartar splash screen para evitar tiempos de espera y bloqueos de click
    await page.addInitScript(() => {
      sessionStorage.setItem("akros_splash_dismissed", "true");
    });
  });

  test("1.1 Landing page carga con Hero, propuesta de valor y CTA principal", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AKROS|SportComplex/i);

    // Encabezado principal de la landing
    const heroTitle = page.locator("h1");
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText("Tu");

    // Botones de acción en el hero
    const heroCta = page.locator(".hero-wrap .action-button").first();
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute("href", "/services");

    // Navegación hacia catálogo desde el menú principal (visible en desktop)
    if (!isMobile) {
      const servicesNavLink = page.getByRole("navigation").getByRole("link", { name: "Servicios" });
      await expect(servicesNavLink).toBeVisible();
      await expect(servicesNavLink).toHaveAttribute("href", "/services");
    }

    await page.goto("/services");
    await expect(page).toHaveURL(/\/services/);
  });

  test("1.2 Catálogo general de servicios muestra categorías oficiales", async ({ page }) => {
    await page.goto("/services");
    await expect(page).toHaveURL(/\/services/);

    // Grid de categorías principales del complejo deportivo
    const categoryGrid = page.locator(".dashboard-category-grid");
    await expect(categoryGrid).toBeVisible();

    const canchaCategory = page.getByRole("link", { name: /Canchas/i }).first();
    await expect(canchaCategory).toBeVisible();

    // Muestra indicador de precio en COP
    await expect(page.getByText(/Desde \$|COP/i).first()).toBeVisible();
  });

  test("1.3 Navegación a categoría Canchas filtra espacios y muestra detalle", async ({ page }) => {
    await page.goto("/services/canchas");
    await expect(page).toHaveURL(/\/services\/canchas/);

    // Muestra hero de la categoría o instalaciones oficiales
    await expect(page.getByText(/Instalaciones|Canchas|espacio/i).first()).toBeVisible();

    // Enlace de retorno al catálogo completo
    const backLink = page.getByRole("link", { name: /Todos los servicios/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/services/);
  });

  test("1.4 Navegación profunda hacia detalle de espacio deportivo", async ({ page }) => {
    await page.goto("/services/canchas/tenis-cancha-1");
    await expect(page).toHaveURL(/\/services\/canchas\/tenis-cancha-1/);

    // Título del espacio y sede
    await expect(page.locator("h1")).toContainText(/Cancha de tenis/i);
    await expect(page.getByText(/Poblado/i).first()).toBeVisible();

    // Muestra especificaciones y precio
    await expect(page.getByText(/Polvo de ladrillo/i).first()).toBeVisible();
    await expect(page.getByText(/48\.000/i).first()).toBeVisible();

    // Botón o enlace de regreso a la categoría
    const backToCategory = page.getByRole("link", { name: /Volver a canchas/i });
    await expect(backToCategory).toBeVisible();
    await backToCategory.click();
    await expect(page).toHaveURL(/\/services\/canchas/);
  });

  test("1.5 Catálogos de las cuatro categorías oficiales cargan correctamente", async ({ page }) => {
    const categories = [
      { slug: "canchas", name: /Canchas/i },
      { slug: "piscinas", name: /Piscinas/i },
      { slug: "gimnasio", name: /Gimnasio/i },
      { slug: "zona-humeda", name: /Zona húmeda/i },
    ];

    for (const cat of categories) {
      await page.goto(`/services/${cat.slug}`);
      await expect(page).toHaveURL(new RegExp(`/services/${cat.slug}`));
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText(/espacio|instalaciones|deportiv|todas|oficiales/i).first()).toBeVisible();
    }
  });

  test("1.6 Categoría inexistente despacha página 404 sin romper la aplicación", async ({ page }) => {
    const response = await page.goto("/services/categoria-inexistente");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|No encontrada|no existe/i).first()).toBeVisible();
  });

  test("1.7 Página de reglamentos legales carga contenido institucional SSG", async ({ page }) => {
    await page.goto("/legal");
    await expect(page).toHaveURL(/\/legal/);

    // Contenido legal presente
    await expect(page.locator("h1")).toContainText(/Reglamentos/i);
    await expect(page.getByText(/Contenido estático institucional/i)).toBeVisible();
  });

  test("1.8 Carrusel interactivo del Hero permite pausar y navegar diapositivas", async ({ page, isMobile }) => {
    await page.goto("/");
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await expect(carousel).toBeVisible();

    // Controles de diapositivas (tabs)
    const tabs = carousel.getByRole("tab");
    await expect(tabs).toHaveCount(5);

    // Primer tab activo por defecto
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    // Click en la segunda diapositiva
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    // Botón de pausa / reanudación
    const pauseButton = carousel.getByRole("button", { name: /Pausar carrusel|Reanudar carrusel/i });
    await expect(pauseButton).toBeVisible();
    await pauseButton.click();
    await expect(pauseButton).toHaveAttribute("aria-label", "Reanudar carrusel");
  });
});

