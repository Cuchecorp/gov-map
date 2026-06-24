import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mintWebReaderToken } from "./web-reader-jwt";

/**
 * LOCKDOWN-03 — Cliente Supabase server-only autenticado como `web_reader`.
 *
 * La diferencia respecto al original es el campo `accessToken`: supabase-js
 * 2.108.2 acepta `accessToken?: () => Promise<string | null>`. Cuando esta
 * presente, el SDK usa el valor retornado como `Authorization: Bearer` en
 * cada peticion HTTP hacia PostgREST/Kong, mientras sigue enviando la
 * `anonKey` como header `apikey` (Kong la valida por firma; el rol DB lo
 * determina el Bearer, NO el apikey).
 *
 * PostgREST recibe el Bearer con `role: "web_reader"` -> ejecuta
 * `SET ROLE web_reader` -> el cliente lee solo las tablas/RPCs cubiertas por
 * las policies y grants de `web_reader` (espejo exacto de `anon`, LOCKDOWN-01).
 *
 * NOTA: cuando `accessToken` esta seteado, `client.auth.*` lanza por diseno
 * de supabase-js. El servidor no usa auth de usuarios; solo lee datos publicos.
 *
 * CUTOVER: este modulo se deploya a Cloudflare ANTES de que se aplique
 * LOCKDOWN-02 (revoke anon). Ver _FACTS-live-prod.md §Cutover order.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL        e.g. https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY   anon key (sigue siendo el `apikey` para Kong)
 *   SUPABASE_JWT_SECRET JWT secret del proyecto (Dashboard -> Settings -> API
 *                       -> JWT Secret). NO es SUPABASE_SECRET_KEY (sb_secret_).
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno del servidor. " +
        "Configuralas con los valores del proyecto Supabase."
    );
  }

  return createClient(url, anonKey, {
    accessToken: async () => mintWebReaderToken(),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
