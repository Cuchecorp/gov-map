import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase SERVICE-ROLE, server-only, para la superficie ADMIN protegida (ENT-04).
 *
 * A diferencia de `createServerSupabase` (anon, constreñido por las policies public-read), este
 * cliente usa la SERVICE key para leer/escribir tablas deny-by-default (`revision_entidad`,
 * `vinculo_entidad`, `identidad_audit`, `entidad_tercero`) — la cola humana de terceros vive en
 * tablas sin grant a `anon`. SOLO puede instanciarse desde un Server Component / Server Action ya
 * protegido por `adminRevisionEnabled` (el gate va PRIMERO; este cliente nunca se construye con el
 * gate OFF).
 *
 * Lee `SUPABASE_URL` y la SERVICE key del entorno. La service key se busca como
 * `SUPABASE_SECRET_KEY` (nombre canonico que el repo + `.env` realmente setean) con
 * fallback a `SUPABASE_SERVICE_KEY` (alias historico que aun leen los CLIs de ingesta).
 * Antes solo leia `SUPABASE_SERVICE_KEY` → en Cloudflare (donde `.env` define
 * `SUPABASE_SECRET_KEY`) el cliente admin tiraba "Falta ..." al encender el gate
 * (deuda DEBT/APP-01). NINGUNA de las dos lleva prefijo `NEXT_PUBLIC_`: la service key
 * JAMÁS debe viajar al bundle del navegador (T-05-10 reforzado). `import "server-only"`
 * (línea 1) lo garantiza en build.
 */
export function createAdminSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL o la service key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_KEY) " +
        "en el entorno del servidor. La superficie admin requiere la SERVICE key (nunca la anon) " +
        "para leer la cola deny-by-default."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
