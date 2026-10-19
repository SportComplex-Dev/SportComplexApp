import { test, expect } from "@playwright/test";

test.describe("Flujo 3: Seguridad Perimetral, Middleware y Rutas Protegidas (RBAC)", () => {
  test("3.1 Acceso anónimo a /portal debe redirigir a /login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("3.2 Acceso anónimo a /admin debe ser bloqueado y redirigido", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("3.3 Acceso anónimo a /pos (Taquilla Empleado) debe ser interceptado", async ({ page }) => {
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("3.4 Acceso anónimo a /scanner (Control Acceso Lector) debe ser interceptado", async ({ page }) => {
    await page.goto("/scanner");
    await expect(page).toHaveURL(/\/login/);
  });

  test("3.5 Acceso anónimo a subruta protegida /portal/book redirige a autenticación", async ({ page }) => {
    await page.goto("/portal/book");
    await expect(page).toHaveURL(/\/login/);
  });

  test("3.6 Subrutas administrativas y de cliente son interceptadas y redirigidas a /login", async ({ page }) => {
    const routes = [
      "/portal/tickets",
      "/admin/dashboard",
      "/admin/employees",
      "/admin/tournaments",
      "/admin/catalog",
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("3.7 Acceso anónimo a /portal/membership es público y no debe redirigir a /login", async ({ page }) => {
    await page.goto("/portal/membership");
    await expect(page).toHaveURL(/\/portal\/membership/);
    await expect(page.locator("h1")).toContainText(/Membresías/i);
  });

  test("3.8 Rutas de API protegidas devuelven status 401 JSON ante peticiones sin autenticación", async ({ request }) => {
    const protectedApis = [
      "/api/admin/employees",
      "/api/pos",
      "/api/access",
      "/api/tickets/verify",
      "/api/pdf/receipt",
      "/api/pdf/receipt/file",
      "/api/pos/tickets/lookup",
    ];

    for (const apiPath of protectedApis) {
      const response = await request.get(apiPath);
      expect(response.status()).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    }
  });
});
