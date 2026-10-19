import { test, expect } from '@playwright/test'

test.describe('TSK-QA-03: Auditoría y navegación de enlaces del menú lateral de administración', () => {
  test.beforeEach(async ({ page, context }) => {
    // Configurar cookie de sesión de rol Administrador para el proxy RBAC
    await context.addCookies([
      {
        name: 'sc-role',
        value: 'Administrador',
        url: 'http://127.0.0.1:3000',
      },
      {
        name: 'sc-role',
        value: 'Administrador',
        url: 'http://localhost:3000',
      },
    ])

    // Descartar splash screen para evitar demoras o bloqueos de interacción
    await page.addInitScript(() => {
      sessionStorage.setItem('akros_splash_dismissed', 'true')
    })
  })

  test('3.1 Auditoría del menú: no contiene enlaces obsoletos (Configuración) y solo contiene rutas operativas válidas', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    let navLocator = page.locator('aside.admin-sidebar nav.admin-nav')

    if (isMobile) {
      // En móvil, el sidebar estático está oculto; abrimos el drawer
      const menuTrigger = page.locator('button[aria-label="Abrir menú de navegación"]').first()
      await expect(menuTrigger).toBeVisible()
      await menuTrigger.click()
      navLocator = page.locator('nav[aria-label="Navegación de administración móvil"]')
    }

    await expect(navLocator).toBeVisible()

    // 1. Criterio clave: Verificar que el enlace 'Configuración' no existe tras la limpieza
    const configLink = navLocator.getByRole('link', { name: /Configuraci[oó]n|Settings/i })
    await expect(configLink).toHaveCount(0)

    // 2. Extraer todos los enlaces visibles dentro del menú de administración
    const navLinks = navLocator.locator('a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)

    const linksData: { text: string; href: string }[] = []
    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i)
      const text = (await link.innerText()).trim()
      const href = await link.getAttribute('href')
      if (href) {
        linksData.push({ text, href })
      }
    }

    // Comprobar que los 7 enlaces operativos esperados están presentes (100% de enlaces operativos)
    const expectedHrefs = [
      '/admin',
      '/admin/catalog',
      '/admin/tournaments',
      '/admin/employees',
      '/admin/bookings',
      '/admin/incident',
      '/admin/memberships',
    ]

    for (const expectedHref of expectedHrefs) {
      const found = linksData.some((l) => l.href === expectedHref)
      expect(found, `El enlace ${expectedHref} debe estar presente en la navegación administrativa`).toBe(true)
    }
  })

  test('3.2 Recorrido sistemático de cada enlace del menú administrativo: responde HTTP 200, sin 404 ni redirecciones rotas', async ({
    page,
    isMobile,
  }) => {
    const error404Urls: string[] = []
    const console404Messages: string[] = []

    // Monitorear respuestas de red para asegurar 0 respuestas 404
    page.on('response', (response) => {
      if (response.status() === 404) {
        error404Urls.push(`${response.status()} ${response.url()}`)
      }
    })

    // Monitorear errores en consola para verificar cero errores 404
    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error' && /404|Not Found/i.test(text)) {
        console404Messages.push(text)
      }
    })

    // Lista de enlaces del menú administrativo
    const sidebarItems = [
      { name: 'Resumen', href: '/admin' },
      { name: 'Catálogo', href: '/admin/catalog' },
      { name: 'Torneos', href: '/admin/tournaments' },
      { name: 'Empleados', href: '/admin/employees' },
      { name: 'Reservas', href: '/admin/bookings' },
      { name: 'Contingencias', href: '/admin/incident' },
      { name: 'Membresías', href: '/admin/memberships' },
    ]

    for (const item of sidebarItems) {
      // Navegar a la ruta verificando respuesta HTTP 200
      const response = await page.goto(`${item.href}?role=Administrador`, {
        waitUntil: 'domcontentloaded',
      })

      expect(response, `Respuesta para ${item.href} no debe ser nula`).not.toBeNull()
      expect(
        response?.status(),
        `La ruta ${item.href} debe responder con código HTTP 200`,
      ).toBe(200)

      // Verificar que no redirigió a página de error 404
      expect(page.url()).not.toContain('/404')
      await expect(page.locator('text=404 - Página no encontrada')).toHaveCount(0)
      await expect(page.locator('text=This page could not be found')).toHaveCount(0)

      // Verificar indicador de ruta activa en desktop
      if (!isMobile) {
        const sidebarNav = page.locator('aside.admin-sidebar nav.admin-nav')
        await expect(sidebarNav).toBeVisible()

        const activeLink = sidebarNav.locator(`a[href="${item.href}"]`)
        await expect(activeLink).toBeVisible()
        await expect(activeLink).toHaveClass(/admin-nav-active/)
      }
    }

    // Criterio de aceptación clave: Cero errores 404 en la consola y red
    expect(
      error404Urls,
      `No deben existir peticiones con estado 404: ${JSON.stringify(error404Urls)}`,
    ).toEqual([])

    expect(
      console404Messages,
      `No deben registrarse mensajes de error 404 en consola: ${JSON.stringify(console404Messages)}`,
    ).toEqual([])
  })

  test('3.3 Navegación interactiva mediante clics sucesivos en los enlaces del menú', async ({
    page,
    isMobile,
  }) => {
    const error404Urls: string[] = []
    page.on('response', (res) => {
      if (res.status() === 404) {
        error404Urls.push(`${res.status()} ${res.url()}`)
      }
    })

    // Iniciar en /admin
    await page.goto('/admin?role=Administrador')
    await page.waitForLoadState('domcontentloaded')

    const routesToClick = [
      { name: 'Catálogo', expectedUrl: /\/admin\/catalog/ },
      { name: 'Torneos', expectedUrl: /\/admin\/tournaments/ },
      { name: 'Empleados', expectedUrl: /\/admin\/employees/ },
      { name: 'Reservas', expectedUrl: /\/admin\/bookings/ },
      { name: 'Contingencias', expectedUrl: /\/admin\/incident/ },
      { name: 'Membresías', expectedUrl: /\/admin\/memberships/ },
      { name: 'Resumen', expectedUrl: /\/admin(?!\/catalog|\/tournaments|\/employees|\/bookings|\/incident|\/memberships)/ },
    ]

    for (const route of routesToClick) {
      let navLocator = page.locator('aside.admin-sidebar nav.admin-nav')

      if (isMobile) {
        // En móvil abrimos el drawer antes de hacer clic en cada enlace
        const menuTrigger = page.locator('button[aria-label="Abrir menú de navegación"]').first()
        await expect(menuTrigger).toBeVisible()
        await menuTrigger.click()
        navLocator = page.locator('nav[aria-label="Navegación de administración móvil"]')
      }

      const link = navLocator.getByRole('link', { name: route.name })
      await expect(link).toBeVisible()

      await link.click()
      await page.waitForLoadState('domcontentloaded')

      // Verificar URL alcanzada
      await expect(page).toHaveURL(route.expectedUrl)

      // Verificar que no sea pantalla 404
      await expect(page.locator('text=404 - Página no encontrada')).toHaveCount(0)
      await expect(page.locator('text=This page could not be found')).toHaveCount(0)
    }

    expect(error404Urls).toEqual([])
  })
})
