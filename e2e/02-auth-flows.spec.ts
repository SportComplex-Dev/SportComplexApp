import { test, expect } from "@playwright/test";

test.describe("Flujo 2: Autenticación, Registro y Validaciones de Entrada", () => {
  test("2.1 Formulario de Login renderiza campos y botón de Google", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    // Encabezado
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Input de Correo
    const emailInput = page.getByPlaceholder(/nombre@correo.com|correo/i);
    await expect(emailInput).toBeVisible();

    // Input de Contraseña
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Botón Google OAuth
    const googleBtn = page.getByRole("button", { name: /Google/i });
    await expect(googleBtn).toBeVisible();

    // Botón submit
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test("2.2 Formulario de Login valida credenciales incompletas en cliente", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByPlaceholder(/nombre@correo.com|correo/i);
    await emailInput.fill("correo-invalido-sin-arroba");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Debe mostrar mensaje de error en #login-error
    const errorMessage = page.locator("#login-error");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/correo|email|válido/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("2.3 Formulario de Registro renderiza campos Zod y casilla Habeas Data", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register/);

    // Campos de registro
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Checkbox de consentimiento obligatorio (Ley 1581)
    const policyCheckbox = page.locator('input[type="checkbox"]');
    await expect(policyCheckbox).toBeVisible();
    await expect(policyCheckbox).not.toBeChecked();

    // Enlace legal hacia política de privacidad en pestaña nueva
    const legalLink = page.getByRole("link", { name: /Política de Tratamiento/i });
    await expect(legalLink).toBeVisible();
    await expect(legalLink).toHaveAttribute("href", "/rules");
    await expect(legalLink).toHaveAttribute("target", "_blank");

    // Enlace a login existente
    const loginLink = page.getByRole("link", { name: /Inicia sesión|¿Ya tienes cuenta\?|Ingresar/i }).first();
    await expect(loginLink).toBeVisible();
  });

  test("2.4 Registro exige consentimiento expreso de Habeas Data antes de enviar", async ({ page }) => {
    await page.goto("/register");

    // Llenar datos válidos en los campos
    await page.locator('input[placeholder="Tu nombre"]').fill("Usuario Prueba E2E");
    await page.locator('input[type="email"]').fill("prueba-e2e@akros.co");
    await page.locator('input[type="password"]').fill("ClaveSegura123*");

    // Dejar casilla de Habeas Data desmarcada y pulsar enviar
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Debe mostrar error específico de Habeas Data
    const errorAlert = page.locator("#register-error");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Política de Tratamiento de Datos Personales/i);
  });

  test("2.5 Navegación bidireccional fluida entre login y register", async ({ page }) => {
    await page.goto("/login");
    
    // Ir a registro
    const toRegister = page.getByRole("link", { name: /Regístrate|Crea una cuenta|Hazte socio/i }).first();
    if (await toRegister.isVisible()) {
      await toRegister.click();
      await expect(page).toHaveURL(/\/register/);
    }

    // Volver a login o home
    const backBtn = page.getByRole("link", { name: /Volver|Inicio|Ingresar/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
  });

  test("2.6 Pantalla de verificación OTP (/verify) valida presencia de correo", async ({ page }) => {
    // Si se accede sin parámetro email, debe alertar que falta el correo
    await page.goto("/verify");
    await expect(page.getByText(/Falta el correo|registro/i)).toBeVisible();

    // Si se accede con parámetro email, carga layout de verificación
    await page.goto("/verify?email=socio%40sportcomplex.co");
    await expect(page.getByText(/socio@sportcomplex\.co/i)).toBeVisible();
  });
});
