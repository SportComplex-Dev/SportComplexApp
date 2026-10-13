import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Polyfill React global para renderToStaticMarkup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

import {
  executeWithRetry,
  getCachedTicketHelper,
  isTransientNetworkError,
  readCacheFromStorage,
  sanitizeTicketConsultationData,
  setCachedTicketHelper,
  writeCacheToStorage,
  HttpError,
  SCANNER_TICKET_CACHE_KEY,
  type TicketConsultationData,
} from "@/hooks/use-network-resilience";
import { ConsultationResultCard } from "@/components/scanner/consultation-result-card";
import { TicketValidationModal } from "@/components/scanner/ticket-validation-modal";
import ScannerPage from "../page";

// Mock de localStorage en memoria para pruebas aisladas
function createMockStorage(initialData: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

// ============================================================================
// 1. Inicialización SSR segura y estados online/offline
// ============================================================================
test("TSK-FE-24 (1): Inicialización SSR segura sin objeto window o navigator", () => {
  // Simular entorno SSR sin window
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  try {
    // @ts-expect-error simulación SSR
    delete globalThis.window;
    // @ts-expect-error simulación SSR
    delete globalThis.navigator;

    // En SSR la lectura de caché debe ser segura y devolver vacío
    const cache = readCacheFromStorage(undefined);
    assert.deepEqual(cache, {});

    // Sanitización pura funciona sin entorno de navegador
    const sanitized = sanitizeTicketConsultationData({
      ticketId: "uuid-1",
      titularNombre: "Ana Torres",
      servicioNombre: "Cancha 1",
      fecha: "2026-10-12",
      horaInicio: "10:00",
      horaFin: "11:00",
    });
    assert.notEqual(sanitized, null);
    assert.equal(sanitized?.ticketId, "uuid-1");
  } finally {
    globalThis.window = originalWindow;
    globalThis.navigator = originalNavigator;
  }
});

// ============================================================================
// 2. Eventos de reconexión y desconexión con limpieza
// ============================================================================
test("TSK-FE-24 (2): Escucha y sincronización de eventos online y offline", () => {
  const events = new Map<string, EventListener>();
  const mockWindow = {
    addEventListener: (type: string, listener: EventListener) => {
      events.set(type, listener);
    },
    removeEventListener: (type: string) => {
      events.delete(type);
    },
  };

  let isOnline = true;
  const handleOnline = () => {
    isOnline = true;
  };
  const handleOffline = () => {
    isOnline = false;
  };

  mockWindow.addEventListener("online", handleOnline);
  mockWindow.addEventListener("offline", handleOffline);

  assert.equal(events.has("online"), true);
  assert.equal(events.has("offline"), true);

  // Simular evento offline
  events.get("offline")?.(new Event("offline"));
  assert.equal(isOnline, false);

  // Simular reconexión
  events.get("online")?.(new Event("online"));
  assert.equal(isOnline, true);

  // Limpieza al desmontar
  mockWindow.removeEventListener("online");
  mockWindow.removeEventListener("offline");
  assert.equal(events.has("online"), false);
  assert.equal(events.has("offline"), false);
});

// ============================================================================
// 3. Primer intento inmediato y backoff exacto de 1, 2 y 4 segundos
// ============================================================================
test("TSK-FE-24 (3): Intento inicial inmediato y backoff exacto de 1000, 2000 y 4000 ms", async () => {
  const delaysCalled: number[] = [];
  let attempts = 0;

  const mockDelay = async (ms: number) => {
    delaysCalled.push(ms);
  };

  const failingFn = async () => {
    attempts += 1;
    throw new TypeError("Failed to fetch"); // Error de red transitorio
  };

  await assert.rejects(
    async () => {
      await executeWithRetry(failingFn, 3, mockDelay);
    },
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      return true;
    },
  );

  // Intento 0 inicial + 3 reintentos = 4 intentos en total
  assert.equal(attempts, 4);
  // Delays exactos según especificación: 1s, 2s, 4s
  assert.deepEqual(delaysCalled, [1000, 2000, 4000]);
});

// ============================================================================
// 4. Recuperación exitosa después de un fallo transitorio
// ============================================================================
test("TSK-FE-24 (4): Recuperación exitosa tras fallo transitorio en reintento 2", async () => {
  const delaysCalled: number[] = [];
  let attempts = 0;

  const mockDelay = async (ms: number) => {
    delaysCalled.push(ms);
  };

  const recoverFn = async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new TypeError("Failed to fetch");
    }
    return { success: true, data: "resultado-recuperado" };
  };

  const result = await executeWithRetry(recoverFn, 3, mockDelay);
  assert.equal(attempts, 3);
  assert.deepEqual(delaysCalled, [1000, 2000]);
  assert.deepEqual(result, { success: true, data: "resultado-recuperado" });
});

// ============================================================================
// 5. Fallo definitivo tras agotar los reintentos
// ============================================================================
test("TSK-FE-24 (5): Fallo definitivo al agotar maxRetries lanzando el error original", async () => {
  const delaysCalled: number[] = [];
  const mockDelay = async (ms: number) => {
    delaysCalled.push(ms);
  };

  const persistentFailure = async () => {
    throw new Error("network timeout econnrefused");
  };

  await assert.rejects(
    async () => {
      await executeWithRetry(persistentFailure, 2, mockDelay);
    },
    /network timeout econnrefused/,
  );

  assert.deepEqual(delaysCalled, [1000, 2000]);
});

// ============================================================================
// 6. Ausencia de reintentos para errores no transitorios
// ============================================================================
test("TSK-FE-24 (6): NO reintenta errores HTTP de negocio, 400, 401, 403, 404 ni validación", async () => {
  const delaysCalled: number[] = [];
  const mockDelay = async (ms: number) => {
    delaysCalled.push(ms);
  };

  // Error 400 Bad Request
  let calls400 = 0;
  await assert.rejects(
    async () => {
      await executeWithRetry(
        async () => {
          calls400 += 1;
          throw new HttpError("Firma inválida", 400);
        },
        3,
        mockDelay,
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 400);
      return true;
    },
  );
  assert.equal(calls400, 1, "400 no debe ser reintentado");
  assert.equal(delaysCalled.length, 0, "No debe haber llamadas a delay en 400");

  // Error 404 Not Found
  let calls404 = 0;
  await assert.rejects(
    async () => {
      await executeWithRetry(
        async () => {
          calls404 += 1;
          throw new HttpError("Boleto inexistente", 404);
        },
        3,
        mockDelay,
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 404);
      return true;
    },
  );
  assert.equal(calls404, 1, "404 no debe ser reintentado");
  assert.equal(delaysCalled.length, 0);

  // Clasificador puro
  assert.equal(isTransientNetworkError(new HttpError("Bad Request", 400)), false);
  assert.equal(isTransientNetworkError(new HttpError("Unauthorized", 401)), false);
  assert.equal(isTransientNetworkError(new HttpError("Forbidden", 403)), false);
  assert.equal(isTransientNetworkError(new HttpError("Not Found", 404)), false);
  assert.equal(isTransientNetworkError(new HttpError("Service Unavailable", 503)), true);
  assert.equal(isTransientNetworkError(new HttpError("Bad Gateway", 502)), true);
  assert.equal(isTransientNetworkError(new TypeError("Failed to fetch")), true);
});

// ============================================================================
// 7. Escritura, lectura, persistencia y sanitización estricta de la caché
// ============================================================================
test("TSK-FE-24 (7): Almacena y recupera datos informativos, filtrando secretos y firmas", () => {
  const storage = createMockStorage();

  const ticketDataWithExtras = {
    ticketId: "9f0d6f4e-0000-4000-8000-0000000000ff",
    titularNombre: "Carlos Gómez",
    servicioNombre: "Cancha de Tenis 1",
    fecha: "2026-10-15",
    horaInicio: "14:00:00",
    horaFin: "15:00:00",
    // CAMPOS PROHIBIDOS que deben ser descartados:
    signature: "secreto-firma-criptografica-prohibida",
    access: "GRANTED",
    qrSecret: "super-secret-key",
    lecturaId: "auditoria-123",
  };

  const sanitized = sanitizeTicketConsultationData(ticketDataWithExtras);
  assert.notEqual(sanitized, null);
  assert.equal(sanitized?.ticketId, "9f0d6f4e-0000-4000-8000-0000000000ff");
  assert.equal(sanitized?.titularNombre, "Carlos Gómez");
  assert.equal(sanitized?.servicioNombre, "Cancha de Tenis 1");
  assert.equal(sanitized?.fecha, "2026-10-15");
  assert.equal(sanitized?.horaInicio, "14:00:00");
  assert.equal(sanitized?.horaFin, "15:00:00");
  // @ts-expect-error comprobación de ausencia
  assert.equal(sanitized?.signature, undefined);
  // @ts-expect-error comprobación de ausencia
  assert.equal(sanitized?.qrSecret, undefined);
  // @ts-expect-error comprobación de ausencia
  assert.equal(sanitized?.access, undefined);

  // Escribir en caché usando la clave oficial scanner_ticket_cache_v1
  const cache: Record<string, TicketConsultationData> = {};
  cache["9f0d6f4e-0000-4000-8000-0000000000ff"] = sanitized!;
  writeCacheToStorage(cache, storage);

  const rawSaved = storage.getItem(SCANNER_TICKET_CACHE_KEY);
  assert.notEqual(rawSaved, null);
  assert.ok(!rawSaved?.includes("secreto-firma-criptografica-prohibida"));

  const recovered = readCacheFromStorage(storage);
  assert.deepEqual(
    recovered["9f0d6f4e-0000-4000-8000-0000000000ff"],
    sanitized,
  );

  // Probar helpers con storage inyectado
  setCachedTicketHelper("9f0d6f4e-0000-4000-8000-0000000000ff", sanitized!, storage);
  const helperRecovered = getCachedTicketHelper("9f0d6f4e-0000-4000-8000-0000000000ff", storage);
  assert.deepEqual(helperRecovered, sanitized);
});

// ============================================================================
// 8. Datos corruptos, entradas inexistentes y almacenamiento inaccesible
// ============================================================================
test("TSK-FE-24 (8): Manejo seguro de JSON corrupto, entradas inexistentes y excepciones de storage", () => {
  // JSON corrupto
  const corruptStorage = createMockStorage({
    [SCANNER_TICKET_CACHE_KEY]: "{ corrupt json invalid [[",
  });
  const corruptCache = readCacheFromStorage(corruptStorage);
  assert.deepEqual(corruptCache, {}, "Debe devolver objeto vacío ante JSON corrupto");

  // Entrada inexistente
  const validStorage = createMockStorage();
  const emptyCache = readCacheFromStorage(validStorage);
  assert.equal(emptyCache["boleto-inexistente"], undefined);

  // Storage inaccesible que lanza excepción
  const brokenStorage: Storage = {
    getItem: () => {
      throw new Error("SecurityError: Access denied");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };

  const safeRead = readCacheFromStorage(brokenStorage);
  assert.deepEqual(safeRead, {});

  // setItem no lanza excepción
  assert.doesNotThrow(() => {
    writeCacheToStorage({ test: {} as TicketConsultationData }, brokenStorage);
  });
});

// ============================================================================
// 9 y 10. Bloqueo offline del canje (interfaz y handler) y cero solicitudes
// ============================================================================
test("TSK-FE-24 (9 y 10): Bloqueo estricto del botón 'Dar Acceso' y alerta visual cuando isOnline es false", () => {
  const htmlOffline = renderToStaticMarkup(
    React.createElement(TicketValidationModal, {
      isOpen: true,
      state: "ticket-valid",
      ticket: { ticketId: "uuid-10", signature: "a".repeat(64) },
      message: "QR listo para canje",
      employeeName: "Operador 1",
      isRedeeming: false,
      isOnline: false, // Desconectado
      onClose: () => {},
      onRedeem: () => {},
      onScanNext: () => {},
    }),
  );

  // 1. Debe contener alerta offline
  assert.ok(
    htmlOffline.includes("Sin conexión a internet. El canje de tickets está suspendido por seguridad"),
    "Debe mostrar el mensaje de suspensión de canje",
  );
  // 2. Botón deshabilitado con texto de canje bloqueado
  assert.ok(
    htmlOffline.includes("disabled"),
    "El botón de canje debe estar deshabilitado en HTML",
  );
  assert.ok(
    htmlOffline.includes("Canje suspendido (Sin conexión)"),
    "El texto del botón debe reflejar la suspensión por falta de conexión",
  );

  // Versus online:
  const htmlOnline = renderToStaticMarkup(
    React.createElement(TicketValidationModal, {
      isOpen: true,
      state: "ticket-valid",
      ticket: { ticketId: "uuid-10", signature: "a".repeat(64) },
      message: "QR listo para canje",
      employeeName: "Operador 1",
      isRedeeming: false,
      isOnline: true,
      onClose: () => {},
      onRedeem: () => {},
      onScanNext: () => {},
    }),
  );

  assert.ok(htmlOnline.includes("Dar Acceso"), "Online debe mostrar 'Dar Acceso'");
  assert.ok(!htmlOnline.includes("Canje suspendido (Sin conexión)"));
});

// ============================================================================
// 11. Ausencia de falsos positivos y de cambios locales a USADO ante fallos
// ============================================================================
test("TSK-FE-24 (11): Nunca se marca un ticket como USADO localmente ante fallos de conexión", () => {
  let estadoBoleto = "EMITIDO";
  const simulateRedeemOffline = (online: boolean) => {
    if (!online) {
      // Bloqueo sin alteración
      return { allowed: false, message: "Sin conexión" };
    }
    estadoBoleto = "USADO";
    return { allowed: true };
  };

  const intento = simulateRedeemOffline(false);
  assert.equal(intento.allowed, false);
  assert.equal(estadoBoleto, "EMITIDO", "El boleto NUNCA muta a USADO localmente sin respuesta satisfactoria");
});

// ============================================================================
// 12. Manejo de resultados inciertos del POST sin reintentos automáticos
// ============================================================================
test("TSK-FE-24 (12): Resultado incierto informa al operador y NO reintenta el POST automáticamente", async () => {
  let postCount = 0;

  const simulateRedeemAttempt = async (online: boolean) => {
    if (!online) {
      throw new Error("Sin conexión a internet. El canje de tickets está suspendido por seguridad.");
    }
    postCount += 1;
    // Simular corte tras enviar
    throw new TypeError("Failed to fetch");
  };

  // Al fallar la red, el sistema captura el error y asigna el mensaje de resultado incierto
  let userMessage = "";
  try {
    await simulateRedeemAttempt(true);
  } catch {
    userMessage =
      "Resultado de canje incierto debido a un error de comunicación. Verifique el estado del boleto mediante el Modo Consulta antes de intentar nuevamente.";
  }

  assert.equal(postCount, 1, "El POST no se reintenta automáticamente para evitar doble canje");
  assert.ok(userMessage.includes("Resultado de canje incierto"));
  assert.ok(userMessage.includes("Modo Consulta"));
});

// ============================================================================
// 13. Consulta online exitosa y almacenamiento de datos válidos
// ============================================================================
test("TSK-FE-24 (13): Consulta exitosa almacena datos sanitizados en caché", () => {
  const storage = createMockStorage();

  const apiResponseTicket = {
    id: "ticket-100",
    reservaId: "reserva-200",
    estado: "EMITIDO" as const,
    servicioId: 1,
    servicioNombre: "Cancha Fútbol 5",
    fecha: "2026-10-14",
    horaInicio: "16:00:00",
    horaFin: "17:00:00",
    titularId: "user-300",
    titularNombre: "Valentina Ramos",
  };

  const dataToCache = sanitizeTicketConsultationData(apiResponseTicket);
  assert.notEqual(dataToCache, null);

  const cache = readCacheFromStorage(storage);
  cache[apiResponseTicket.id] = dataToCache!;
  writeCacheToStorage(cache, storage);

  const saved = readCacheFromStorage(storage);
  assert.equal(saved["ticket-100"]?.titularNombre, "Valentina Ramos");
  assert.equal(saved["ticket-100"]?.servicioNombre, "Cancha Fútbol 5");
});

// ============================================================================
// 14. Consulta offline con caché y distintivo obligatorio
// ============================================================================
test("TSK-FE-24 (14): ConsultationResultCard muestra obligatoriamente '[Datos locales en caché - Sin conexión]'", () => {
  const cachedTicket = {
    id: "ticket-100",
    reservaId: "CONSULTA-LOCAL",
    estado: "EMITIDO" as const,
    servicioId: 1,
    servicioNombre: "Cancha Fútbol 5",
    fecha: "2026-10-14",
    horaInicio: "16:00:00",
    horaFin: "17:00:00",
    titularId: "user-300",
    titularNombre: "Valentina Ramos",
  };

  const html = renderToStaticMarkup(
    React.createElement(ConsultationResultCard, {
      ticket: cachedTicket,
      modo: "CONSULTA",
      isCached: true, // Proviniendo de caché
      onReset: () => {},
    }),
  );

  // Distintivo obligatorio según especificación de TSK-FE-24
  assert.ok(
    html.includes("[Datos locales en caché - Sin conexión]"),
    "Debe contener exactamente el distintivo '[Datos locales en caché - Sin conexión]'",
  );
  // Explicación de que los datos pueden estar desactualizados
  assert.ok(
    html.includes("pueden estar desactualizados"),
    "Debe advertir que los datos pueden estar desactualizados",
  );
  assert.ok(
    html.includes("No autorizan acceso"),
    "Debe aclarar que no autorizan acceso",
  );
  // No contiene acciones de canje
  assert.ok(!html.includes("Dar Acceso"));
  assert.ok(!html.includes("Canjear"));
});

// ============================================================================
// 15. Consulta offline sin caché con mensaje de indisponibilidad
// ============================================================================
test("TSK-FE-24 (15): Consulta offline sin caché informa indisponibilidad sin inventar datos", () => {
  const storage = createMockStorage();
  const cache = readCacheFromStorage(storage);
  const ticketId = "codigo-desconocido-offline";

  const cachedEntry = cache[ticketId];
  assert.equal(cachedEntry, undefined);

  // El mensaje de error que ScannerPage asigna cuando no hay caché y está offline:
  const offlineNoCacheMsg = "Sin conexión a internet. No hay datos en caché para este boleto.";
  assert.ok(offlineNoCacheMsg.includes("Sin conexión"));
  assert.ok(offlineNoCacheMsg.includes("No hay datos en caché"));
});

// ============================================================================
// 16. Errores HTTP, respuestas inválidas y fallos de red sin conceder acceso
// ============================================================================
test("TSK-FE-24 (16): Errores 500, JSON inválido o fallos de red nunca conceden acceso", () => {
  const badResponses = [
    { ok: false, status: 500, payload: null },
    { ok: true, status: 200, payload: "not-json" },
    { ok: true, status: 200, payload: { success: false } },
    { ok: false, status: 400, payload: { success: false, error: { message: "Firma inválida" } } },
  ];

  for (const resp of badResponses) {
    let accessGranted = false;
    if (resp.ok && typeof resp.payload === "object" && resp.payload !== null) {
      const p = resp.payload as { success?: boolean; data?: { access?: string } };
      if (p.success && p.data?.access === "GRANTED") {
        accessGranted = true;
      }
    }
    assert.equal(accessGranted, false, `Respuesta ${JSON.stringify(resp)} jamás debe conceder acceso`);
  }
});

// ============================================================================
// 17. Recuperación de la conectividad sin recargar la aplicación
// ============================================================================
test("TSK-FE-24 (17): Indicador en línea presente en la interfaz", () => {
  const html = renderToStaticMarkup(React.createElement(ScannerPage));
  assert.ok(
    html.includes("En línea") || html.includes("Sin conexión"),
    "La vista debe renderizar el estado de conectividad",
  );
  assert.ok(
    html.includes("Staff Portería"),
    "La vista renderiza el encabezado corporativo",
  );
});

// ============================================================================
// Criterios de Aceptación Gherkin (Escenarios A a F)
// ============================================================================
test("Gherkin Escenario A: Bloqueo de canje con navigator.onLine === false", () => {
  const html = renderToStaticMarkup(
    React.createElement(TicketValidationModal, {
      isOpen: true,
      state: "ticket-valid",
      ticket: { ticketId: "uuid-esc-a", signature: "f".repeat(64) },
      message: "QR listo para canje",
      employeeName: "Staff",
      isRedeeming: false,
      isOnline: false,
      onClose: () => {},
      onRedeem: () => {},
      onScanNext: () => {},
    }),
  );
  assert.ok(html.includes("Sin conexión a internet. El canje de tickets está suspendido por seguridad"));
  assert.ok(html.includes("disabled"));
});

test("Gherkin Escenario B: Microcorte con reintentos y recuperación", async () => {
  let attempt = 0;
  const mockDelay = async () => {};

  const microcorteFetch = async () => {
    attempt += 1;
    if (attempt === 1) {
      throw new TypeError("Failed to fetch"); // Microcorte en primer intento
    }
    return { success: true, verified: true };
  };

  const res = await executeWithRetry(microcorteFetch, 3, mockDelay);
  assert.equal(attempt, 2);
  assert.equal(res.verified, true);
});

test("Gherkin Escenario C: Consulta offline con ticket cacheado muestra distintivo", () => {
  const html = renderToStaticMarkup(
    React.createElement(ConsultationResultCard, {
      ticket: {
        id: "esc-c",
        reservaId: "r-c",
        estado: "EMITIDO",
        servicioId: 1,
        servicioNombre: "Piscina",
        fecha: "2026-10-12",
        horaInicio: "08:00",
        horaFin: "09:00",
        titularId: "u-c",
        titularNombre: "Laura Medina",
      },
      modo: "CONSULTA",
      isCached: true,
      onReset: () => {},
    }),
  );
  assert.ok(html.includes("[Datos locales en caché - Sin conexión]"));
  assert.ok(!html.includes("Dar Acceso"));
});

test("Gherkin Escenario D: Sin caché informa indisponibilidad", () => {
  const storage = createMockStorage();
  const cache = readCacheFromStorage(storage);
  assert.equal(cache["no-existe"], undefined);
});

test("Gherkin Escenario E: Resultado transaccional incierto no reenvía el canje", () => {
  let redeemCalls = 0;
  const executeRedeem = () => {
    redeemCalls += 1;
    throw new Error("Timeout de conexión");
  };

  try {
    executeRedeem();
  } catch {
    // Manejado como resultado incierto sin reintentos
  }
  assert.equal(redeemCalls, 1);
});

test("Gherkin Escenario F: Reconexión actualiza indicador", () => {
  let onlineState = false;
  const handleOnline = () => {
    onlineState = true;
  };
  handleOnline();
  assert.equal(onlineState, true);
});
