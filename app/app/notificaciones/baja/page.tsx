import type { Metadata } from "next";

import {
  buscarSuscripcionPorBajaToken,
  marcarBaja,
  marcarBajaUsuario,
} from "@/lib/notif-service";

import { hashToken, verifyUserBajaToken } from "../token";

/**
 * /notificaciones/baja?t=<token> (NOTIF-04, Phase 103) — unsubscribe login-less. SIN
 * login: el token ES la autorización. Dos formas de token conviven:
 *
 *   1. TOKEN DE USUARIO (CR-03, el que lleva el DIGEST): auto-autenticante
 *      base64url(`${userId}:${HMAC(secret,'baja-user:'+userId)}`). Se verifica la firma con
 *      el secreto (verifyUserBajaToken) — SIN lookup por token en la DB — y, si casa, se
 *      BORRAN TODAS las suscripciones del usuario (marcarBajaUsuario). Esto es lo que exige
 *      el `List-Unsubscribe` one-click (RFC 8058 / 21.719): un click detiene el correo
 *      ENTERO, no una sola de N suscripciones.
 *   2. TOKEN POR-SUSCRIPCIÓN (legado / links de baja de una fila puntual): se hashea el `?t=`
 *      y se busca por `baja_token_hash` vía el helper service_role dedicado (notif-service.ts,
 *      NUNCA `app/lib/supabase.ts`); se borra ESA fila. Se conserva por compatibilidad.
 *
 * Se intenta PRIMERO el token de usuario (el que emite el digest); si no verifica, se cae al
 * lookup por-suscripción. Un token ausente/inválido/ya-usado → copy de inválido (S4, verbatim).
 * robots noindex.
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
// Baja a nivel USUARIO (CR-03): se detuvo el digest completo (todas las suscripciones), no un
// objetivo puntual → copy sin `{objetivo}`, coherente con "ya no recibirás el resumen".
const OK_BODY_DIGEST =
  "Ya no recibirás el resumen diario. Puedes volver a seguir proyectos y parlamentarios cuando quieras desde tu cuenta.";
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
  // true = baja a nivel usuario (digest completo, CR-03) → copy sin objetivo puntual.
  let esDigest = false;

  if (raw) {
    // CR-03: PRIMERO el token de baja por-usuario (el que emite el digest). Se verifica la
    // firma HMAC con el secreto (fail-loud si falta) — NO hay lookup por token en la DB.
    const secret = process.env.NOTIF_TOKEN_SECRET;
    const userId = secret ? verifyUserBajaToken(secret, raw) : null;
    if (userId) {
      // One-click 21.719: el link es la intención → baja del digest COMPLETO (todas las filas).
      await marcarBajaUsuario(userId);
      ok = true;
      esDigest = true;
    } else {
      // Fallback: token por-suscripción (legado). Se hashea y se busca la fila puntual.
      const suscripcion = await buscarSuscripcionPorBajaToken(hashToken(raw));
      if (suscripcion) {
        await marcarBaja(suscripcion.id);
        ok = true;
        objetivo = suscripcion.objetivo_id;
      }
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-12 text-center space-y-4">
      {ok ? (
        <>
          <h1 className="text-2xl font-semibold leading-tight">{OK_HEADING}</h1>
          <p className="text-sm text-muted-foreground">
            {esDigest ? (
              OK_BODY_DIGEST
            ) : (
              <>
                {OK_BODY_PREFIX} {objetivo}
                {OK_BODY_SUFFIX}
              </>
            )}
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
