import type { Metadata } from "next";

import {
  buscarSuscripcionPorConfirmToken,
  marcarConfirmada,
} from "@/lib/notif-service";

import { hashToken } from "../token";

/**
 * /notificaciones/confirmar?t=<token> (NOTIF-04, Phase 103) — aterrizaje del doble
 * opt-in. SIN login: el token opaco ES la autorización. Se hashea el `?t=` recibido y
 * se busca la suscripción por `confirm_token_hash` vía el helper service_role dedicado
 * (notif-service.ts) — NUNCA `app/lib/supabase.ts` (el lockdown-guard lo prohíbe ahí).
 *
 * Si la suscripción existe y NO expiró (`confirm_expira_at`), se marca 'confirmada'. Un
 * token ausente/inválido/expirado → copy de inválido (S3, verbatim). robots noindex:
 * estas URLs con token nunca deben indexarse.
 *
 * GOTCHA PHASE 45 (LOCKED): `export const dynamic = "force-dynamic"` + leer
 * `searchParams` (Promise, Next 16) ANTES de cualquier branching. Sin token → inválido
 * (empty state honesto), jamás 404/500.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Copy LOCKED (103-UI-SPEC §Copywriting → Double opt-in landing S3).
const OK_HEADING = "Confirmaste tu suscripción";
const OK_BODY_PREFIX = "Ya sigues";
const OK_BODY_SUFFIX =
  ". Recibirás tu resumen diario de lunes a viernes.";
const INVALID_COPY =
  "Este enlace de confirmación no es válido o ya expiró. Vuelve a tu cuenta e intenta seguirlo de nuevo.";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Extrae el primer valor string de `?t=` (normalización estándar del repo). */
function tokenDe(sp: { [key: string]: string | string[] | undefined }): string | null {
  const raw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const limpio = raw?.trim();
  return limpio && limpio.length > 0 ? limpio : null;
}

export default async function ConfirmarPage({ searchParams }: PageProps) {
  // GOTCHA 45: searchParams (Promise) se lee PRIMERO, antes de cualquier branching.
  const sp = await searchParams;
  const raw = tokenDe(sp);

  let ok = false;
  let objetivo: string | null = null;

  if (raw) {
    const suscripcion = await buscarSuscripcionPorConfirmToken(hashToken(raw));
    if (suscripcion) {
      // Respetar la ventana de confirmación: expirada → inválido (no se confirma).
      const expira = suscripcion.confirm_expira_at
        ? new Date(suscripcion.confirm_expira_at).getTime()
        : null;
      const vigente = expira == null || expira > Date.now();
      if (vigente) {
        // WR-02: la fuente de verdad es el WRITE server-side (marcarConfirmada re-valida
        // la ventana en el update y devuelve si confirmó de verdad). El chequeo de arriba
        // es solo un short-circuit; el `ok` lo decide el resultado del write (evita una
        // race donde el token vence entre la lectura y el update).
        ok = await marcarConfirmada(suscripcion.id);
        if (ok) objetivo = suscripcion.objetivo_id;
      }
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
