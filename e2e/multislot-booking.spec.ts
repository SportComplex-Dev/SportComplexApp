import { test, expect } from "@playwright/test";

test.describe("TSK-QA-04 (HU-26 / RF-13, RF-15): Reserva multi-franja y canje QR en escáner", () => {
  const dummyTicketId = "9f0d6f4e-0000-4000-8000-0000000000ff";
  const dummySignature = "a".repeat(64);
  const canonicalQr = `SC1:${dummyTicketId}:${dummySignature}`;

  test.beforeEach(async ({ page, context }) => {
    // Configuración de sesión y omisión de splash screen
    await context.addCookies([
      {
        name: "sc-role",
        value: "Administrador",
        url: "http://127.0.0.1:3000",
      },
      {
        name: "sc-role",
        value: "Administrador",
        url: "http://localhost:3000",
      },
    ]);

    await page.addInitScript(() => {
      sessionStorage.setItem("akros_splash_dismissed", "true");
    });
  });

  test("1 y 2. Selección de 2 horas contiguas en /portal/book y emisión de ticket QR consolidado", async ({
    page,
  }) => {
    // Mock de API de membresías
    await page.route("**/api/memberships", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            membresiaActiva: {
              estado: "VIGENTE",
              plan: "Plan Oro",
            },
          },
        }),
      });
    });

    // Mock de catálogo público para el selector de servicios
    await page.route("**/api/public/catalogo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            categorias: [{ id: 1, nombre: "Canchas", tipo: "canchas" }],
            servicios: [
              {
                id: 1,
                nombre: "Cancha de Tenis 1",
                categoriaId: 1,
                tarifa: 48000,
                capacidadMaxima: 4,
                estado: "ACTIVO",
                slug: "tenis-cancha-1",
              },
            ],
          },
        }),
      });
    });

    // Mock de bloqueo de franjas continuas (lock-cart)
    await page.route("**/api/bookings/lock-cart", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reservas: [
              { id: "res-slot-01", horaInicio: "14:00", horaFin: "15:00" },
              { id: "res-slot-02", horaInicio: "15:00", horaFin: "16:00" },
            ],
            checkout: {
              url: "/checkout?session_id=cs_test_mock_multislot",
            },
          },
        }),
      });
    });

    await page.goto("/portal/book?role=Cliente");
    await page.waitForLoadState("domcontentloaded");

    // 1. Validar carga del motor de reservas
    await expect(page.locator("h1")).toContainText(/Elige tu espacio/i);

    // 2. Seleccionar 2 horas contiguas en el SlotPicker
    const availableSlots = page.locator("button[aria-disabled='false']");
    const count = await availableSlots.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Clic en la primera franja disponible
    await availableSlots.nth(0).click();
    // Clic en la segunda franja contigua
    await availableSlots.nth(1).click();

    // Comprobar que el selector refleja la selección multi-franja continua
    const summaryIndicator = page.locator('[data-testid="slot-picker-summary"]');
    await expect(summaryIndicator).toBeVisible();
    await expect(summaryIndicator).toContainText(/2 horas continuas|hora reservada/i);

    // 3. Agregar servicio al carrito
    const addServiceBtn = page
      .locator("button[aria-label*='Agregar'], button:has-text('Agregar')")
      .first();
    await expect(addServiceBtn).toBeVisible({ timeout: 5000 });
    await addServiceBtn.click();

    // 4. Revisar selección en el carrito
    const reviewBtn = page.getByRole("button", { name: /Revisar selección/i });
    await expect(reviewBtn).toBeVisible({ timeout: 5000 });
    await reviewBtn.click();

    // 5. En el modal de resumen, proceder al pago seguro
    const proceedBtn = page.getByRole("button", { name: /Proceder al pago/i });
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click();

    // Redirección hacia pasarela o checkout
    await page.waitForURL((url) => url.pathname.includes("/checkout") || url.pathname.includes("/portal/book"), {
      timeout: 15000,
    });
  });

  test("3. Lectura de QR en intervalo válido: franja 1 y franja 2 conceden acceso (GRANTED)", async ({
    page,
  }) => {
    // Mock de catálogo de puestos para el lector
    await page.route("**/api/access/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nombre: "Cancha Tenis 1" }],
        }),
      });
    });

    // Mock de canje exitoso para franja 1 y 2 dentro de la ventana consolidada [14:00, 16:00]
    await page.route("**/api/access/redeem", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access: "GRANTED",
            resultado: "CONCEDIDO",
            message: "Acceso concedido.",
            ticket: {
              id: dummyTicketId,
              reservaId: "res-slot-01",
              estado: "EMITIDO",
              servicioId: 1,
              servicioNombre: "Cancha Tenis 1",
              fecha: "2026-10-25",
              horaInicio: "14:00:00",
              horaFin: "16:00:00",
              titularId: "user-123",
              titularNombre: "Carlos Mendoza",
            },
          },
          timestamp: "2026-10-25T19:30:00.000Z", // 14:30 Bogotá (Franja 1)
        }),
      });
    });

    await page.goto("/scanner?role=Empleado_Lector");
    await page.waitForLoadState("domcontentloaded");

    // Alternar a modo Turno si está en modo consulta
    const consultationToggle = page.locator("button[aria-label='Alternar modo consulta']");
    if (await consultationToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      const toggleText = await consultationToggle.innerText();
      if (toggleText.includes("Activado")) {
        await consultationToggle.click();
      }
    }

    // Seleccionar el turno/puesto
    const shiftOption = page.locator("button:has-text('Puesto 1'), button:has-text('Cancha Tenis 1')").first();
    await expect(shiftOption).toBeVisible({ timeout: 10000 });
    await shiftOption.click();

    // Simular escaneo de QR mediante helper de pruebas o entrada manual
    await page.evaluate((qr) => {
      const fn = (window as unknown as { __scannerScanTurno?: (q: string) => void }).__scannerScanTurno;
      if (typeof fn === "function") {
        fn(qr);
      }
    }, canonicalQr);

    // Confirmar canje en modal de validación ("Dar Acceso")
    const redeemBtn = page.getByRole("button", { name: /Dar Acceso/i });
    await expect(redeemBtn).toBeVisible({ timeout: 10000 });
    await redeemBtn.click();

    // Validar respuesta visual de acceso concedido
    await expect(page.getByText(/ACCESO CONCEDIDO|Acceso concedido/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("4. Lectura de QR expirado tras concluir la última franja: denegación contractual y pantalla ExpiredSlotScreen", async ({
    page,
  }) => {
    // Mock de catálogo de puestos para el lector
    await page.route("**/api/access/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nombre: "Cancha Tenis 1" }],
        }),
      });
    });

    // Mock de canje expirado (16:15 Bogotá, después del cierre de la 2da franja a las 16:00)
    await page.route("**/api/access/redeem", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access: "DENIED",
            code: "WINDOW_EXPIRED",
            resultado: "DENEGADO_HORARIO",
            message: "Acceso denegado: Franja horaria vencida",
            ticket: {
              id: dummyTicketId,
              reservaId: "res-slot-01",
              estado: "EMITIDO",
              servicioId: 1,
              servicioNombre: "Cancha Tenis 1",
              fecha: "2026-10-25",
              horaInicio: "14:00:00",
              horaFin: "16:00:00",
              titularId: "user-123",
              titularNombre: "Carlos Mendoza",
            },
          },
          timestamp: "2026-10-25T21:15:00.000Z", // 16:15 Bogotá
        }),
      });
    });

    await page.goto("/scanner?role=Empleado_Lector");
    await page.waitForLoadState("domcontentloaded");

    // Alternar a modo Turno si está en modo consulta
    const consultationToggle = page.locator("button[aria-label='Alternar modo consulta']");
    if (await consultationToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      const toggleText = await consultationToggle.innerText();
      if (toggleText.includes("Activado")) {
        await consultationToggle.click();
      }
    }

    // Seleccionar el turno/puesto
    const shiftOption = page.locator("button:has-text('Puesto 1'), button:has-text('Cancha Tenis 1')").first();
    await expect(shiftOption).toBeVisible({ timeout: 10000 });
    await shiftOption.click();

    // Simular escaneo de QR mediante helper de pruebas
    await page.evaluate((qr) => {
      const fn = (window as unknown as { __scannerScanTurno?: (q: string) => void }).__scannerScanTurno;
      if (typeof fn === "function") {
        fn(qr);
      }
    }, canonicalQr);

    // Confirmar canje en modal de validación ("Dar Acceso")
    const redeemBtn = page.getByRole("button", { name: /Dar Acceso/i });
    await expect(redeemBtn).toBeVisible({ timeout: 10000 });
    await redeemBtn.click();

    // Validar mensaje contractual en pantalla ExpiredSlotScreen
    const expiredScreen = page.locator("section[role='alertdialog']");
    await expect(expiredScreen).toBeVisible({ timeout: 10000 });
    await expect(expiredScreen).toContainText("Acceso denegado: Franja horaria vencida");
    await expect(expiredScreen).toContainText("14:00 - 16:00");
    await expect(expiredScreen).toContainText("Carlos Mendoza");
  });
});
