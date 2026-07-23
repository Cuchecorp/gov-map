import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Cliente Supabase USER de BAJO PRIVILEGIO (Phase 97 — SPIKE auth-on-Workers).
 *
 * MODELO: separado por diseño del cliente service_role (`app/lib/supabase.ts`).
 * Este módulo lee EXCLUSIVAMENTE la publishable key nueva (`SUPABASE_PUBLISHABLE_KEY`,
 * formato `sb_publishable_...`) — de bajo privilegio, RLS-gated. JAMÁS lee la service
 * key (sb_secret_, que bypassa RLS) ni resucita la clave anon legacy (muerta por 0044,
 * 401). Mantener ambos clientes en módulos SEPARADOS evita que un refactor o el
 * lockdown-guard confundan los privilegios (RESEARCH §Structure Rationale + AP2).
 *
 * `import "server-only"` (línea 1) garantiza que ni la publishable key ni la lógica
 * de sesión viajen al bundle del navegador. La publishable key es server-side ->
 * SIN prefijo `NEXT_PUBLIC_` (convención del repo).
 *
 * `updateSession()` es el patrón canónico de `@supabase/ssr` (Vercel with-supabase
 * proxy.ts adaptado a un `middleware()`): crea un cliente request-scoped, espeja las
 * cookies en un `NextResponse` fresco y llama `getClaims()` para gatillar el refresh
 * del access token. REGLA CRÍTICA: NO ejecutar código entre `createServerClient` y
 * `getClaims()`, y devolver el `supabaseResponse` sin mutar — de lo contrario los
 * usuarios se deslogean aleatoriamente.
 *
 * Variables de entorno requeridas (fail-loud si faltan):
 *   SUPABASE_URL               e.g. https://<ref>.supabase.co
 *   SUPABASE_PUBLISHABLE_KEY   clave publishable nueva (sb_publishable_...)
 */

function leerEnv(): { url: string; publishableKey: string } {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en el entorno del servidor. " +
        "El cliente user de bajo privilegio requiere la publishable key nueva " +
        "(sb_publishable_...), NUNCA la service key (sb_secret_) ni la anon legacy (muerta). " +
        "Configúralas con los valores del proyecto Supabase."
    );
  }
  return { url, publishableKey };
}

/**
 * Refresca la sesión en el middleware Edge (OpenNext). Espeja las cookies del request
 * en un `NextResponse` fresco; `getClaims()` rota el access token y re-emite Set-Cookie
 * cuando corresponde.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = leerEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do NOT insert code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  void user; // spike: sin redirect gating; solo refresh + emitir Set-Cookie.

  // MUST return this object unchanged so the Set-Cookie survives.
  return supabaseResponse;
}

/**
 * Construye un cliente user @supabase/ssr ligado a un adaptador de cookies del
 * contexto de la request/response (Server Component / Server Action / Route Handler).
 * Usa la MISMA publishable key de bajo privilegio. `verifyOtp` escribe Set-Cookie a
 * través del `setAll` del adaptador provisto por el caller.
 */
export function createUserClient(cookieAdapter: {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options?: Record<string, unknown> }[],
  ) => void;
}) {
  const { url, publishableKey } = leerEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: cookieAdapter.getAll,
      setAll: cookieAdapter.setAll,
    },
  });
}
