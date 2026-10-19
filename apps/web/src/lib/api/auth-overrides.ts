/**
 * Registro de composición para la autenticación de API.
 *
 * Permite sustituir la sesión por defecto cuando la aplicación se ejecuta en
 * un contexto distinto de NextAuth (por ejemplo, un adaptador de plataforma).
 * No contiene lógica de tests ni consulta variables de entorno: el código de
 * pruebas que quiera usarlo instala su propio proveedor desde `test-env`.
 */
export interface SessionLike {
  user?: { id?: string | null; email?: string | null } | null;
}

export type AuthenticateOverride = () => Promise<SessionLike | null>;

let authenticateOverride: AuthenticateOverride | undefined;

/** Instala (o limpia con `undefined`) el proveedor de sesión por defecto. */
export function setAuthenticateOverride(
  authenticate: AuthenticateOverride | undefined,
): void {
  authenticateOverride = authenticate;
}

export function getAuthenticateOverride(): AuthenticateOverride | undefined {
  return authenticateOverride;
}
