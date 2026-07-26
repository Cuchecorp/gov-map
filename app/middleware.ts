// app/middleware.ts — PRIMER middleware del repo (Phase 97 — SPIKE auth-on-Workers).
//
// FILENAME INTENCIONALMENTE DEPRECADO. Next.js 16 renombró la convención `middleware`
// a `proxy` (proxy.ts corre en Node.js, sin opción Edge). `@opennextjs/cloudflare` NO
// soporta proxy Node — solo Edge middleware. Por eso ESTE repo se queda en la convención
// `middleware.ts`, que OpenNext ejecuta como Edge middleware. El WARNING de deprecación
// en build es ESPERADO y ACEPTABLE:
//   - JAMÁS crear `proxy.ts` ni correr `npx @next/codemod middleware-to-proxy`.
//   - JAMÁS declarar el segmento de ejecución en el config (proxy files tiran con él).
// Ver node_modules/next/dist/docs/.../proxy.md (§Version history v16.0.0) +
// 97-RESEARCH.md §Pattern 1 / Pitfall #1.
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase-user";

export async function middleware(request: NextRequest) {
  // FAIL-OPEN de Camino A: el matcher cubre TODAS las rutas de la app (/, /parlamentarios,
  // …). Si la publishable key no está configurada (deploy sin el wrangler secret de
  // 97-Task 1), NO se hace refresh de sesión y el request PASA sin tocar. Así el middleware
  // no puede tumbar el sitio existente (Camino A intacto, T-97-08). El cliente user
  // (supabase-user.ts) sigue siendo fail-loud en la ruta de auth real (/cuenta, NOTIF-01,
  // que absorbió y reemplazó al /spike-auth borrado en 103-03): allí SÍ debe existir la
  // key. Cuando el operador cargue el secret, este guard deja de aplicar y updateSession()
  // corre normal (refresh + Set-Cookie).
  if (!process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_URL) {
    return NextResponse.next({ request });
  }
  return await updateSession(request);
}

export const config = {
  // Saltar estáticos para que la lógica de auth nunca bloquee CSS/JS/imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
