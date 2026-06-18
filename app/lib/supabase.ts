import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for the public tramitación tables.
 *
 * Reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the environment.
 *
 * These env vars are deliberately NOT prefixed with `NEXT_PUBLIC_` so the
 * anon key never ships to the browser bundle (T-05-10). All reads happen in
 * React Server Components; the anon role is constrained by the public-read
 * RLS policies applied in migration 0008 (it can read proyecto/votacion/
 * voto/tramitacion_evento but never parlamentario.rut).
 *
 * Required environment:
 *   SUPABASE_URL       e.g. http://127.0.0.1:54421 (Supabase local)
 *   SUPABASE_ANON_KEY  the anon key from `supabase status`
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno del servidor. " +
        "Configúralas con los valores del Supabase local (supabase status)."
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
