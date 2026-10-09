// Alias de compatibilidad con el contrato de SCRUM-114 (TSK-BE-10), que
// especifica `POST /api/webhooks/stripe`. El handler canónico vive en
// `POST /api/payments`; se reexporta para no duplicar la lógica del webhook.
export { POST } from "../../payments/route";
