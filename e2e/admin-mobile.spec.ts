import { test, expect } from '@playwright/test'

test.describe('TSK-QA-09: Pruebas visuales, responsivas y de accesibilidad del menú mobile en AdminLayout', () => {
  test.beforeEach(async ({ page, context }) => {
    // Descartar splash screen y establecer cookie de sesión administrativa para el proxy
    await context.addCookies([
      {
        name: 'sc-role',
        value: 'Administrador',
        domain: '127.0.0.1',
        path: '/',
      },
    ])

    await page.addInitScript(() => {
      sessionStorage.setItem('akros_splash_dismissed', 'true')
    })
  })

  test('9.1 Viewport móvil (375x667): Oculta sidebar estático y muestra botón hamburguesa accesible sin scroll horizontal', async ({
    page,
  }) => {
    // Configurar viewport móvil estándar iPhone SE / Android
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    // 1. Sidebar estático de escritorio debe estar oculto en móvil (< 768px)
    const desktopSidebar = page.locator('aside.admin-sidebar:not(.admin-drawer-sidebar)')
    if (await desktopSidebar.count() > 0) {
      await expect(desktopSidebar.first()).not.toBeVisible()
    }

    // 2. Botón hamburguesa debe ser visible en la barra superior móvil
    const menuTrigger = page.locator('button[aria-label="Abrir menú de navegación"]').first()
    await expect(menuTrigger).toBeVisible()
    await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(menuTrigger).toHaveAttribute('aria-controls', 'admin-mobile-drawer')

    // 3. Cero desbordamientos horizontales de página en resolución 375x667
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('9.2 Apertura del drawer: Dialog accesible, backdrop, bloqueo de scroll y focus trap', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    const menuTrigger = page.locator('button[aria-label="Abrir menú de navegación"]').first()
    await expect(menuTrigger).toBeVisible()

    // Abrir drawer
    await menuTrigger.click()

    // 1. Trigger actualiza su atributo ARIA a expandido
    await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true')

    // 2. Diálogo accesible montado en el DOM con atributos ARIA requeridos
    const drawerDialog = page.locator('div[role="dialog"][aria-label="Menú de administración"]')
    await expect(drawerDialog).toBeVisible()
    await expect(drawerDialog).toHaveAttribute('aria-modal', 'true')

    // 3. Backdrop interactivo visible
    const backdrop = page.locator('[data-testid="admin-drawer-backdrop"]')
    await expect(backdrop).toBeVisible()

    // 4. Bloqueo de scroll en document.body
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
    expect(bodyOverflow).toBe('hidden')

    // 5. El botón de cerrar existe y recibe foco inicial
    const closeBtn = page.locator('[data-testid="admin-drawer-close"]')
    await expect(closeBtn).toBeVisible()
    await expect(closeBtn).toBeFocused()

    // 6. Evidencia visual del drawer abierto
    await page.screenshot({
      path: 'test-results/visual-snapshots/admin-mobile-drawer-open.png',
      fullPage: false,
    })
  })

  test('9.3 Navegación administrativa completa y estado activo dentro del drawer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    // Abrir menú
    await page.locator('button[aria-label="Abrir menú de navegación"]').first().click()

    const nav = page.locator('nav[aria-label="Navegación de administración móvil"]')
    await expect(nav).toBeVisible()

    // Comprobar que todas las secciones principales están presentes
    const expectedRoutes = [
      { name: 'Resumen', href: '/admin' },
      { name: 'Catálogo', href: '/admin/catalog' },
      { name: 'Torneos', href: '/admin/tournaments' },
      { name: 'Empleados', href: '/admin/employees' },
      { name: 'Reservas', href: '/admin/bookings' },
      { name: 'Contingencias', href: '/admin/incident' },
      { name: 'Membresías', href: '/admin/memberships' },
    ]

    for (const route of expectedRoutes) {
      const link = nav.getByRole('link', { name: route.name })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', route.href)
    }

    // El enlace de la página activa (/admin) debe tener estilos destacados
    const activeLink = nav.getByRole('link', { name: 'Resumen' })
    await expect(activeLink).toHaveClass(/font-bold|bg-\[#eff4e9\]/)
  })

  test('9.4 Cierre interactivo mediante clic en el Backdrop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    // Abrir drawer
    await page.locator('button[aria-label="Abrir menú de navegación"]').first().click()
    const drawerDialog = page.locator('div[role="dialog"][aria-label="Menú de administración"]')
    await expect(drawerDialog).toBeVisible()

    // Clic en la zona expuesta del backdrop (fuera del contenedor del drawer de 285px)
    const backdrop = page.locator('[data-testid="admin-drawer-backdrop"]')
    await backdrop.click({ position: { x: 330, y: 150 }, force: true })

    // El drawer debe cerrarse y liberar el scroll
    await expect(drawerDialog).not.toBeVisible()
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
    expect(bodyOverflow).not.toBe('hidden')
  })

  test('9.5 Cierre accesible mediante la tecla Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    // Abrir drawer
    await page.locator('button[aria-label="Abrir menú de navegación"]').first().click()
    const drawerDialog = page.locator('div[role="dialog"][aria-label="Menú de administración"]')
    await expect(drawerDialog).toBeVisible()

    // Presionar tecla Escape
    await page.keyboard.press('Escape')

    // Debe cerrarse inmediatamente
    await expect(drawerDialog).not.toBeVisible()
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
    expect(bodyOverflow).not.toBe('hidden')
  })

  test('9.6 Cierre mediante el botón X accesible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    // Abrir drawer
    await page.locator('button[aria-label="Abrir menú de navegación"]').first().click()
    const drawerDialog = page.locator('div[role="dialog"][aria-label="Menú de administración"]')
    await expect(drawerDialog).toBeVisible()

    // Clic en el botón X de cierre
    const closeBtn = page.locator('[data-testid="admin-drawer-close"]')
    await closeBtn.click()

    // Debe cerrarse
    await expect(drawerDialog).not.toBeVisible()
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
    expect(bodyOverflow).not.toBe('hidden')
  })
})
