import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase SERVER-ONLY para la superficie PUBLICA del sitio (solo lecturas).
 *
 * MODELO POST-LEGACY (Camino A — cero secreto simetrico):
 * Tras DESACTIVAR el legacy JWT del proyecto, el approach `web_reader` (auto-firma
 * HS256 con un secreto simetrico) queda abandonado: auto-firmar un rol = tener un
 * secreto de firma en el server = exactamente el riesgo que el lockdown cierra.
 * Este cliente lee con la SERVICE key nueva (`SUPABASE_SECRET_KEY`, formato
 * `sb_secret_...`) -> PostgREST resuelve `service_role`. supabase-js manda la key
 * como header `apikey` y como `Authorization: Bearer` (sin `accessToken`).
 *
 * IMPLICACION DE SEGURIDAD (trade-off aceptado del Camino A): `service_role`
 * BYPASSA RLS. La proteccion de PII ya NO esta en la DB para esta ruta; recae en
 * DISCIPLINA DE CODIGO: este cliente y todo el arbol server-side del sitio publico
 * NUNCA deben consultar tablas PII (`parlamentario`, `donante`, `cruce_senal`,
 * `identidad_audit`, ...). Los datos de parlamentario se leen SIEMPRE via RPCs
 * PII-safe (`parlamentario_publico`, `votos_de_parlamentario`, etc.). El guard CI
 * `lockdown-guard.test.ts` (Block B) escanea TODO `app/` (excepto la superficie
 * admin gateada) para hacer cumplir esto estaticamente. Las lecturas PII legitimas
 * (cola humana de terceros) van por `createAdminSupabase()` detras de su gate.
 *
 * `import "server-only"` (linea 1) garantiza que la service key jamas viaje al
 * bundle del navegador.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL         e.g. https://<ref>.supabase.co
 *   SUPABASE_SECRET_KEY  service key nueva (sb_secret_...). Fallback historico:
 *                        SUPABASE_SERVICE_KEY (alias que aun leen los CLIs de ingesta).
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno del servidor. " +
        "El sitio publico lee con la service key (sb_secret_...) tras el cutover " +
        "post-legacy. Configuralas con los valores del proyecto Supabase."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
