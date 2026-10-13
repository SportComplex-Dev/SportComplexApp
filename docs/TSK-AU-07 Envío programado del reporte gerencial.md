================================================================================
README: TSK-AU-07 — Reporte Automatizado de Analíticas Administrativas (Cron)
Componente: Automation & n8n | Proyecto: SportComplex (AKROS Club)
Rama de Integración: feature/n8n-workflows-au-03-05-07
================================================================================

1. DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
Este workflow automatiza la recopilación, consolidación y distribución periódica
de las métricas operativas, ocupación de canchas, eventos de contingencia y
rendimiento financiero hacia la administración de AKROS Club.

A diferencia de los flujos de contingencia y reservas, no depende de un webhook
externo sino que se dispara de manera autónoma mediante un temporizador (Schedule
Trigger). Consulta el endpoint de analíticas del backend, estructura un resumen
ejecutivo con plantilla HTML Dark Mode y envía el reporte a través de la API
de Resend.

- Identificador Jira: TSK-AU-07 (SCRUM-120)
- Tipo de Flujo: Scheduled Job / Analytics Reporter
- Fase del Proyecto: F2
- Criterio de Aceptación / SLA: Entrega programada recurrente del informe en el
  buzón administrativo sin intervención humana.


2. ESPECIFICACIÓN DEL DISPARADOR (SCHEDULE TRIGGER)
--------------------------------------------------------------------------------
- Tipo de Nodo: Schedule Trigger (Cron)
- Frecuencia recomendada: Semanal (Lunes 07:00 AM COT) o Diario
- Zona Horaria: America/Bogota (UTC-5)
- Regla Cron estándar:
  0 7 * * 1 (Cada lunes a las 07:00 AM)


3. VARIABLES DE ENTORNO Y ENDPOINTS (BACKEND / N8N)
--------------------------------------------------------------------------------
# Endpoint real de analíticas expuesto por el backend y consumido por n8n:
BACKEND_ANALYTICS_API_URL="https://akros.lat/api/admin/analytics"

# Destinatarios del reporte consolidado:
ADMIN_REPORT_RECIPIENTS="gerencia@akros.lat,operaciones@akros.lat"


4. CONFIGURACIÓN DEL NODO "Consultar Analytics Backend"
--------------------------------------------------------------------------------
- Tipo de Nodo: HTTP Request (n8n-nodes-base.httpRequest)
- Method: GET
- URL: https://akros.lat/api/admin/analytics
- Authentication: None
- Send Query Parameters: Activado (Specify: Using Fields Below)
- Parámetros de consulta (Query Params) opcionales según el rango a liquidar:
  * periodo / range: "semana_actual" | "mes_actual"
  * limit: 10


5. CONTRATO DE DATOS ESPERADO DESDE EL BACKEND (GET RESPONSE)
--------------------------------------------------------------------------------
Estructura JSON devuelta por el backend al ejecutar la consulta GET:

{
  "periodo": "Semana Operativa 41 (05/10/2026 - 11/10/2026)",
  "metricas": {
    "totalReservas": 142,
    "ingresosTotales": "$11.360.000 COP",
    "tasaOcupacion": "78.4%",
    "contingenciasReportadas": 1,
    "horasPico": "18:00 - 21:00"
  },
  "canchasMasUtilizadas": [
    { "nombre": "Cancha Sintética Principal Fútbol 7", "reservas": 68 },
    { "nombre": "Cancha Múltiple Voleibol / Baloncesto", "reservas": 44 },
    { "nombre": "Cancha Auxiliar Fútbol 5", "reservas": 30 }
  ]
}


6. ARQUITECTURA DE NODOS EN N8N
--------------------------------------------------------------------------------
[Schedule Trigger]
    │  - Disparador programado por tiempo (Cron).
    ▼
[Consultar Analytics Backend] (HTTP Request Node)
    │  - Método: GET
    │  - URL: https://akros.lat/api/admin/analytics
    │  - Authentication: None
    │  - Envío de Query Parameters para filtrar período/métricas.
    ▼
[Construir Reporte HTML] (Code Node)
    │  - Toma el JSON devuelto por el backend.
    │  - Formatea los valores numéricos, porcentajes y listas de ocupación.
    │  - Ensambla la plantilla visual ejecutiva en HTML Dark Mode.
    │  - Construye el objeto resendPayload con asunto, remitente y destinatarios.
    ▼
[Enviar Reporte Resend] (HTTP Request Node)
       - Método: POST a https://api.resend.com/emails
       - Header Auth con la API Key de Resend.
       - Despacha el informe ejecutivo final a los correos administrativos.


7. VERIFICACIÓN Y PRUEBA MANUAL EN N8N
--------------------------------------------------------------------------------
1. Entrar al lienzo del flujo TSK-AU-07 en n8n.
2. Abrir el nodo "Consultar Analytics Backend" y hacer clic en "Execute step".
3. Verificar que el backend responda con el JSON de mét