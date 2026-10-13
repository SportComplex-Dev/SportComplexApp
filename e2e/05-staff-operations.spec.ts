import { test, expect } from "@playwright/test";

test.describe("Flujo 5: Operaciones del Personal (Taquilla POS, Scanner QR y Gestión)", () => {
  test("5.1 Taquilla POS (/pos) protegida por middleware ante usuarios no autenticados", async ({ page }) => {
    await page.goto("/pos");
    // Al no haber sesión de Empleado_Vendedor o Admin, debe redirigir
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.2 Control de acceso (/scanner) protegido por middleware ante anónimos", async ({ page }) => {
    await page.goto("/scanner");
    // Al no haber sesión de Empleado_Lector o Admin, debe redirigir
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.3 Administración de incidencias (/admin/incident) protegida por middleware", async ({ page }) => {
    await page.goto("/admin/incident");
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.4 Administración de torneos (/admin/tournaments) protegida por middleware", async ({ page }) => {
    await page.goto("/admin/tournaments");
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.5 Catálogo administrativo (/admin/catalog) y gestión de empleados (/admin/employees) protegidos", async ({ page }) => {
    await page.goto("/admin/catalog");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin/employees");
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.6 Inyección maliciosa de cabeceras internas de rol es neutralizada por el middleware", async ({ request }) => {
    // Intento de spoofing enviando roles elevados como cabecera HTTP cruda
    const spoofedResponse = await request.get("/api/admin/employees", {
      headers: {
        "x-sc-authenticated-user-id": "hacker-uuid",
        "x-sc-authenticated-role": "Administrador",
      },
    });

    // El middleware debe descartar las cabeceras del cliente y retornar 401 UNAUTHORIZED
    expect(spoofedResponse.status()).toBe(401);
    const body = await spoofedResponse.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
