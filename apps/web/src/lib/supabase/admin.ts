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

export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar la Admin API de Supabase.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
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
 * GET de la Admin API vía REST (el cliente tipado no expone el filtro `filter`
 * en listUsers para algunos paginados). Solo se usa con service_role en servidor.
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
  try {
    const data = await adminJsonGet(
      `/admin/users?per_page=1000&filter=${encodeURIComponent(email)}`,
    );
    const users = Array.isArray(data.users) ? (data.users as Array<Record<string, unknown>>) : [];
    const normalized = email.toLowerCase();
    const candidate = users.find(
      (row) => String(row.email ?? "").toLowerCase() === normalized,
    );
    const user: AuthAdminUser | null = candidate
      ? { id: String(candidate.id ?? ""), email: String(candidate.email ?? "") }
      : null;
    return { data: { user }, error: null };
  } catch (error: unknown) {
    return { data: null, error: error as Error };
  }
}

/** Rollback best-effort de una identidad Auth cuando falla la inserción en `usuario`. */
export async function deleteSupabaseAuthUser(id: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id, true);
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