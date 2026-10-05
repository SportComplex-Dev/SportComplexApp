"use client";

export default function VerifyPage() {
  return (
    <main>
      <h1>Verificación de cuenta</h1>
      <p>Token con TTL improrrogable de 15 minutos (RF-02).</p>
      <form>
        <label>
          Código <input name="code" required pattern="\d{6}" maxLength={6} />
        </label>
        <button type="submit">Activar</button>
        <button type="button">Reenviar código (rate-limit 60s)</button>
      </form>
    </main>
  );
}
