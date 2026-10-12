import { ok } from "@/lib/api-response";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export async function POST() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return ok({ signedOut: true });
}