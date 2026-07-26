import type { Metadata } from "next";

import {
  buscarSuscripcionPorBajaToken,
  marcarBaja,
} from "@/lib/notif-service";

import { hashToken } from "../token";

/**
 * /notificaciones/baja?t=<token> (NOTIF-04, Phase 103) — unsubscribe login-less. SIN
 * login: el token opaco ES la autorización. Se hashea el `?t=` recibido y se busca la
 * suscripción por `baja_token_hash` vía el helper service_role dedicado
 * (notif-service.ts) — NUNCA `app/lib/supabase.ts`.
 *
 * ONE-CLICK (21.719 / List-Unsubscribe-Post One-Click): el link ES la intención — se da
 * de baja al aterrizar, SIN confirmación extra. Un token ausente/inválido/ya-usado →
 * copy de inválido (S4, verbatim). robots noindex.
 *
 * GOTCHA PHASE 45 (LOCKED): `export const dynamic = "force-dynamic"` + leer
 * `searchParams` (Promise, Next 16) ANTES de cualquier branching.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Copy LOCKED (103-UI-SPEC §Copywriting → Unsubscribe landing S4).
const OK_HEADING = "Te diste de baja";
const OK_BODY_PREFIX = "Ya no recibirás el resumen de";
const OK_BODY_SUFFIX =
  ". Puedes volver a seguirlo cuando quieras desde tu cuenta.";
const INVALID_COPY =
  "Este enlace de baja no es válido o ya se usó. Si sigues recibiendo correos, escríbenos.";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Extrae el primer valor string de `?t=` (normalización estándar del repo). */
function tokenDe(sp: { [key: string]: string | string[] | undefined }): string | null {
  const raw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const limpio = raw?.trim();
  return limpio && limpio.length > 0 ? limpio : null;
}

export default async function BajaPage({ searchParams }: PageProps) {
  // GOTCHA 45: searchParams (Promise) se lee PRIMERO, antes de cualquier branching.
  const sp = await searchParams;
  const raw = tokenDe(sp);

  let ok = false;
  let objetivo: string | null = null;

  if (raw) {
    const suscripcion = await buscarSuscripcionPorBajaToken(hashToken(raw));
    if (suscripcion) {
      // One-click: el link es la intención → baja sin confirmación extra (21.719).
      await marcarBaja(suscripcion.id);
      ok = true;
      objetivo = suscripcion.objetivo_id;
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-12 text-center space-y-4">
      {ok ? (
        <>
          <h1 className="text-2xl font-semibold leading-tight">{OK_HEADING}</h1>
          <p className="text-sm text-muted-foreground">
            {OK_BODY_PREFIX} {objetivo}
            {OK_BODY_SUFFIX}
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold leading-tight">
            Enlace no válido
          </h1>
          <p className="text-sm text-muted-foreground">{INVALID_COPY}</p>
        </>
      )}
    </main>
  );
}
