import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente para la Admin API de Supabase (solo servidor).
 * Requiere SUPABASE_SERVICE_ROLE_KEY; NUNCA exponer en cliente/Edge.
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Cliente Supabase REST reutilizable. Si no se pasa `apiKey`, usa la service role.
 * Permite compartir la misma fábrica entre la Admin API y el proxy (que puede
 * operar con la anon key cuando no hay service role disponible).
 */
export function createSupabaseRestClient(apiKey?: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = apiKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !key) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y una API key (service role o anon) para el cliente Supabase REST.",
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
  const injected = (globalThis as unknown as { __scSupabaseAdminClient?: SupabaseClient }).__scSupabaseAdminClient;
  if (injected) return injected;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar la Admin API de Supabase.",
    );
  }

  return createSupabaseRestClient(serviceRoleKey);
}

/**
 * Crea una identidad en Supabase Auth como Cliente con email ya confirmado
 * (D4=b: la puerta de activación sigue siendo el flujo de 6 dígitos de la app;
 * `usuario.estado = PENDIENTE` bloquea el acceso hasta verificar).
 */
export async function createSupabaseAuthUser(input: {
  email: string;
  password: string;
  nombre: string;
}) {
  const supabase = createSupabaseAdminClient();
  return supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { role: "Cliente", name: input.nombre },
  });
}

/**
 * GET de la Admin API vía REST (paginado con `page`/`per_page`; se recorre hasta
 * agotar resultados con salida temprana). Solo se usa con service_role en servidor.
 */
async function adminJsonGet(
  path: string,
): Promise<Record<string, unknown>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar la Admin API de Supabase.",
    );
  }

  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin API GET ${path} → ${response.status}: ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export interface AuthAdminUser {
  id: string;
  email: string;
}

export async function findSupabaseUserByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  // La Admin API de GoTrue solo soporta `page`/`per_page` (no `filter`), así que
  // se pagina hasta agotar los resultados, con salida temprana al encontrar el correo.
  const perPage = 1000;
  try {
    for (let page = 1; ; page += 1) {
      const data = await adminJsonGet(`/admin/users?page=${page}&per_page=${perPage}`);
      const users = Array.isArray(data.users) ? (data.users as Array<Record<string, unknown>>) : [];
      const candidate = users.find(
        (row) => String(row.email ?? "").toLowerCase() === normalized,
      );
      if (candidate) {
        const user: AuthAdminUser = {
          id: String(candidate.id ?? ""),
          email: String(candidate.email ?? ""),
        };
        return { data: { user }, error: null };
      }
      if (users.length < perPage) break;
    }
    return { data: { user: null as AuthAdminUser | null }, error: null };
  } catch (error: unknown) {
    return { data: null, error: error as Error };
  }
}

/**
 * Rollback best-effort de una identidad Auth cuando falla la inserción en `usuario`.
 * Usa hard-delete (no soft-delete) porque la identidad se acaba de crear y un
 * soft-delete bloquearía reintentar el registro con el mismo correo.
 */
export async function deleteSupabaseAuthUser(id: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id, false);
  return !error;
}

/**
 * Garantiza que el email de una identidad Auth esté confirmado (best-effort).
 * No lanza: fallos de red/configuración no deben tumbar el flujo de la app.
 */
export async function confirmSupabaseUserEmail(email: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const { data, error } = await findSupabaseUserByEmail(email);
    if (error || !data?.user) return false;
    const { error: updateError } = await createSupabaseAdminClient().auth.admin.updateUserById(
      data.user.id,
      { email_confirm: true },
    );
    return !updateError;
  } catch {
    return false;
  }
}

/** Actualiza la credencial de Supabase si la cuenta local también tiene identidad Auth. */
export async function updateSupabasePasswordByEmail(email: string, password: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  const result = await findSupabaseUserByEmail(email);
  if (result.error) throw result.error;
  const userId = result.data?.user?.id;
  if (!userId) return false;
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) throw error;
  return true;
}
