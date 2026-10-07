"use client";

export default function RegisterPage() {
  return (
    <main>
      <h1>Registro</h1>
      {/* TODO(feature/auth-provider-email): alta Pendiente + token TTL 15 min + rate-limit 60s (RF-02) */}
      <form>
        <label>
          Correo <input name="email" type="email" required />
        </label>
        <label>
          Nombre <input name="nombre" type="text" required maxLength={120} />
        </label>
        <label>
          Contraseña <input name="password" type="password" required />
        </label>
        <button type="submit">Crear cuenta</button>
      </form>
    </main>
  );
}
