import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mintWebReaderToken } from "./web-reader-jwt";

/**
 * LOCKDOWN-03 — Cliente Supabase server-only autenticado como `web_reader`.
 *
 * Reemplaza la versión `anon` de `app/lib/supabase.ts`. La diferencia única
 * respecto al original es el campo `accessToken`: supabase-js 2.108.2 acepta
 * `accessToken?: () => Promise<string | null>` (SupabaseClientOptions). Cuando
 * está presente, el SDK usa el valor retornado como `Authorization: Bearer`
 * en CADA petición HTTP hacia PostgREST/Kong, mientras sigue enviando la
 * `anonKey` como header `apikey` (Kong la valida por firma; el rol DB lo
 * determina el Bearer, NO el apikey). Ver _FACTS-live-prod.md §JWT / credential
 * reality.
 *
 * PostgREST recibe el Bearer con `role: "web_reader"` → ejecuta
 * `SET ROLE web_reader` → el cliente lee solo las tablas/RPCs cubiertas por
 * las policies y grants de `web_reader` (espejo exacto de `anon` — LOCKDOWN-01).
 *
 * NOTA — cuando `accessToken` está seteado, `client.auth.*` lanza error por
 * diseño de supabase-js (ver jsdoc del campo). Esto es correcto: el servidor
 * no usa auth de usuarios; solo lee datos públicos. Si en el futuro se necesita
 * un cliente con Supabase Auth (para SSR de sesión de usuario), crear otro
 * helper SIN accessToken.
 *
 * CUTOVER: este módulo se deployea a Cloudflare ANTES de que se aplique
 * LOCKDOWN-02 (revoke anon). Ver _FACTS-live-prod.md §Cutover order.
 *
 * Nuevas variables de entorno requeridas (además de las existentes):
 *   SUPABASE_URL       (ya existía)
 *   SUPABASE_ANON_KEY  (ya existía — sigue siendo el `apikey` para Kong)
 *   SUPABASE_JWT_SECRET ← NUEVO: JWT secret del proyecto (HS256 simétrico).
 *                         Obtener en Dashboard → Settings → API → JWT Secret.
 *                         Agregar a `.env` (local) y a Cloudflare Pages env (prod).
 *                         NO confundir con SUPABASE_SECRET_KEY (sb_secret_…).
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno del servidor. " +
        "Configúralas con los valores del proyecto Supabase."
    );
  }

  // `mintWebReaderToken()` lanza si falta SUPABASE_JWT_SECRET, lo que convierte
  // una misconfiguration en un error explícito en el primer request — no silencioso.
  return createClient(url, anonKey, {
    // accessToken sobreescribe el Authorization: Bearer en cada petición.
    // supabase-js llama a esta función en cada request HTTP (puede ser concurrente);
    // mintWebReaderToken() es sync con caché en proceso — seguro y sin await real.
    accessToken: async () => mintWebReaderToken(),
    auth: {
      persistSession: false,
      // autoRefreshToken no aplica cuando accessToken está seteado (el SDK lo
      // ignora), pero lo dejamos false de forma explícita para consistencia con
      // createAdminSupabase() y para evitar timers fantasma en Edge/Workers.
      autoRefreshToken: false,
    },
  });
}
