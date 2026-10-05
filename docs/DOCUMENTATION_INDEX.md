# Índice de Documentación - Automatización n8n

## 📚 Documentos Principales

### 1. **[N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md)** - Especificación Técnica
- Descripción detallada del workflow `tsk-au-01-envio-codigo`
- Configuración de cada nodo
- Payload de entrada y salida
- Template de email con estilos
- Monitoreo y logs
- Mejoras futuras

**Quién debe leer**: Desarrolladores que necesitan entender cómo funciona el workflow exactamente.

### 2. **[AUTOMATION.md](./AUTOMATION.md)** - Arquitectura General
- Visión general del sistema
- Stack tecnológico
- Tipos de workflows (actuales y futuros)
- Diagrama de arquitectura
- Deployment local y producción
- Testing

**Quién debe leer**: Arquitectos, lead developers, nuevos desarrolladores.

### 3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Guía Práctica
- Configuración inicial (variables de entorno)
- Pasos para usar en endpoints
- Ejemplo completo de registro
- Casos de uso comunes
- Manejo de errores
- Security best practices
- Testing unitario

**Quién debe leer**: Desarrolladores que necesitan implementar funcionalidad.

### 4. **[packages/automation/README.md](../packages/automation/README.md)** - Guía del Paquete
- Estructura del directorio
- Integración con backend
- Configuración n8n
- Schemas de validación
- Servicios de integración
- Ejemplos de uso
- Troubleshooting

**Quién debe leer**: Todo desarrollador del proyecto.

### 5. **[packages/automation/IMPLEMENTATION_EXAMPLES.ts](../packages/automation/IMPLEMENTATION_EXAMPLES.ts)** - Código Listo para Copiar
- Ejemplos de endpoints reales
- Handlers de registro, verificación, resend
- Hook de React para UI
- Error handling avanzado
- Utilities y factories
- Tests

**Quién debe leer**: Desarrolladores implementando features.

---

## 🗺️ Mapa Visual de Documentación

```
┌─────────────────────────────────────────────────────────────────┐
│                  DOCUMENTACIÓN n8n COMPLETO                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  PRINCIPIANTE    │    │  DESARROLLADOR   │                   │
│  │  (sin n8n)       │    │  (implementando) │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────────────────────────────┐                   │
│  │  1. IMPLEMENTATION_GUIDE.md             │                   │
│  │     - Setup inicial (.env)              │                   │
│  │     - Pasos rápidos (1-5)               │                   │
│  │     - Ejemplo completo                  │                   │
│  └────────────┬─────────────────────────────┘                   │
│               │                                                  │
│               ▼                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │  2. IMPLEMENTATION_EXAMPLES.ts          │                   │
│  │     - Copiar y pegar código             │                   │
│  │     - 5 ejemplos reales                 │                   │
│  │     - Testing                           │                   │
│  └────────────┬─────────────────────────────┘                   │
│               │                                                  │
│  ┌────────────▼──────────┐  ┌──────────────────┐               │
│  │ ARQUITECTO / TECH     │  │ TROUBLESHOOTING  │               │
│  │ LEAD                  │  │ ISSUES           │               │
│  └────────────┬──────────┘  └────────┬─────────┘               │
│               │                      │                          │
│               ▼                      ▼                          │
│  ┌────────────────────────────────────────────────┐            │
│  │  3. AUTOMATION.md                            │            │
│  │     - Arquitectura completa                  │            │
│  │     - Componentes                            │            │
│  │     - Deployment                             │            │
│  │     - Stack tecnológico                      │            │
│  └────────────┬─────────────────────────────────┘            │
│               │                                               │
│               ▼                                               │
│  ┌────────────────────────────────────────────────┐           │
│  │  4. N8N_WORKFLOWS.md                          │           │
│  │     - Detalles de cada nodo                   │           │
│  │     - Payloads exactos                        │           │
│  │     - Template HTML                          │           │
│  │     - Monitoreo avanzado                      │           │
│  └────────────┬─────────────────────────────────┘           │
│               │                                              │
│  ┌────────────▼──────────────────────────────────┐          │
│  │  5. packages/automation/README.md            │          │
│  │     - Visión del paquete                     │          │
│  │     - Estructura                             │          │
│  │     - Exportes públicos                      │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Rutas Rápidas por Caso de Uso

### "Necesito implementar envío de código YA"
1. Leer: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) secciones 1-5
2. Copiar: Código de [IMPLEMENTATION_EXAMPLES.ts](../packages/automation/IMPLEMENTATION_EXAMPLES.ts)
3. Adaptar: A tu endpoint específico
4. Test: Usar ejemplos de testing

**Tiempo estimado**: 30 minutos

---

### "Necesito entender cómo funciona n8n"
1. Leer: [AUTOMATION.md](./AUTOMATION.md) (todo)
2. Ver: Diagrama en sección de Arquitectura
3. Revisar: [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md) para detalles
4. Explorar: El JSON en `packages/automation/workflows/`

**Tiempo estimado**: 1-2 horas

---

### "El código no se envía, me falta debuggear"
1. Revisar: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) sección 6 (Errores Comunes)
2. Revisar: [packages/automation/README.md](../packages/automation/README.md) sección Troubleshooting
3. Validar: Que el schema sea correcto con `validateSendVerificationCode()`
4. Consultar: Logs en n8n dashboard

**Tiempo estimado**: 15 minutos para la mayoría de casos

---

### "Quiero agregar un nuevo workflow"
1. Leer: [AUTOMATION.md](./AUTOMATION.md) sección "Integración con Backend"
2. Consultar: [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md) como referencia de estructura
3. Crear: Nuevo schema en `packages/validation/src/`
4. Crear: Nueva función en `packages/core/src/integrations/n8n.ts`
5. Documentar: Siguiendo formato de éste documento

**Tiempo estimado**: 2-4 horas

---

### "Necesito setup en producción"
1. Leer: [AUTOMATION.md](./AUTOMATION.md) sección Deployment
2. Leer: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) sección Variables de Entorno
3. Seguir: Pasos de deployment
4. Test: Con datos reales
5. Monitor: Revisar métricas

**Tiempo estimado**: 1 hora + testing

---

## 📦 Archivos de Código Relacionados

### Schemas de Validación
```typescript
// packages/validation/src/automation.schema.ts
export const SendVerificationCodeSchema
export const SendVerificationCodeResponseSchema
export function validateSendVerificationCode()
export function trySendVerificationCode()
export function createTestVerificationCodePayload()
```

### Integración con n8n
```typescript
// packages/core/src/integrations/n8n.ts
export async function sendVerificationCodeWebhook()
export async function sendVerificationCodeNonBlocking()
export async function fireContingencyWebhook()
```

### Workflow JSON
```json
// packages/automation/workflows/tsk-au-01-envio-codigo.json
{
  "name": "My workflow",
  "nodes": [
    "Webhook",
    "Code in JavaScript",
    "HTTP Request",
    "Respond to Webhook"
  ]
}
```

---

## 🔗 Checklist de Implementación

- [ ] Leer [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- [ ] Configurar variables de entorno (.env.local)
- [ ] Importar workflow en n8n
- [ ] Agregar validación de schema
- [ ] Implementar endpoint con `sendVerificationCodeWebhook()`
- [ ] Escribir tests unitarios
- [ ] Test end-to-end (email llega)
- [ ] Revisar logs en n8n
- [ ] Configurar alertas de monitoreo
- [ ] Documentar cambios
- [ ] Deploy a producción

---

## 📞 Nivel de Detalle de Cada Documento

| Documento | Nivel | Objetivo | Leer en |
|-----------|-------|----------|---------|
| IMPLEMENTATION_GUIDE | ⭐⭐ Básico | Aprender a implementar | 30-45 min |
| IMPLEMENTATION_EXAMPLES | ⭐⭐ Básico | Copy-paste código | 15-30 min |
| packages/automation/README | ⭐⭐ Básico | Overview del paquete | 20 min |
| AUTOMATION.md | ⭐⭐⭐ Intermedio | Arquitectura completa | 1-2 horas |
| N8N_WORKFLOWS.md | ⭐⭐⭐ Intermedio | Detalles técnicos | 1-2 horas |
| automation.schema.ts | ⭐⭐⭐⭐ Avanzado | Schemas exactos | 30 min |
| n8n.ts | ⭐⭐⭐⭐ Avanzado | Implementación | 30 min |

---

## 🆘 Preguntas Frecuentes Mapeadas

**P: Por dónde empiezo?**  
R: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) secciones 1-4

**P: ¿Cuál es la URL del webhook?**  
R: [AUTOMATION.md](./AUTOMATION.md) sección "Integración con Backend" + [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md)

**P: ¿Qué datos envío?**  
R: [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md) sección "Entrada Esperada" + [packages/automation/IMPLEMENTATION_EXAMPLES.ts](../packages/automation/IMPLEMENTATION_EXAMPLES.ts)

**P: ¿Cómo hago validación?**  
R: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) sección 2, paso 4

**P: ¿El email no llega?**  
R: [packages/automation/README.md](../packages/automation/README.md) Troubleshooting

**P: ¿Cómo agrego otro workflow?**  
R: [AUTOMATION.md](./AUTOMATION.md) sección "Tipos de Workflows"

---

## 📊 Dependencias Entre Documentos

```
IMPLEMENTATION_GUIDE.md (punto de entrada)
├─ necesita N8N_WORKFLOWS.md (detalles de webhook)
├─ necesita automation.schema.ts (validación)
└─ necesita IMPLEMENTATION_EXAMPLES.ts (código)

AUTOMATION.md (visión general)
├─ referencia a N8N_WORKFLOWS.md
├─ referencia a packages/automation/README.md
└─ referencia a IMPLEMENTATION_GUIDE.md

N8N_WORKFLOWS.md (detalles técnicos)
└─ referencia a automation.schema.ts

packages/automation/README.md (resumen local)
├─ referencia a N8N_WORKFLOWS.md
├─ referencia a AUTOMATION.md
├─ referencia a IMPLEMENTATION_GUIDE.md
└─ referencia a IMPLEMENTATION_EXAMPLES.ts
```

---

## 📝 Cambios Recientes

### v1.0 (Octubre 2026)
- [x] Documentación completa
- [x] Schemas de validación
- [x] Integración con core
- [x] Ejemplos de implementación
- [x] Guía de deployment

