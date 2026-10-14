import ky from "ky";

const url = process.env.N8N_AUTH_EMAIL_WEBHOOK_URL || "https://jafet123.app.n8n.cloud/webhook/auth/enviar-codigo";
const email = process.env.TEST_EMAIL || "user@mail.com";
const nombre = process.env.TEST_NAME || "Prueba Akros";
const code = process.env.TEST_CODE || "112233";
const expiraEnMinutos = 15;

const payload = {
  usuarioId: "c4f9a721-3e5b-4819-a1b7-9d6e52c803f4",
  correo: email,
  nombre: nombre,
  codigoVerificacion: code,
  expiraEnMinutos: expiraEnMinutos,
};

console.log("🚀 Disparando webhook n8n desde backend seam (camelCase)...");
console.log("URL destino:", url);
console.log("Payload JSON despachado:\n", JSON.stringify(payload, null, 2));

const startTime = Date.now();
try {
  const response = await ky.post(url, {
    json: payload,
    timeout: 2500,
    retry: 0,
  }).json();
  console.log(`\n✅ Éxito en ${Date.now() - startTime}ms:`, response);
} catch (error) {
  console.log(`\n⚠️ Finalizado en ${Date.now() - startTime}ms con manejo no bloqueante (RN-12):`);
  console.log(`   ${error.message}`);
  console.log("   (La DB y la lógica de negocio no son afectadas por fallos del webhook).");
}
