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
import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase-user";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Saltar estáticos para que la lógica de auth nunca bloquee CSS/JS/imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
