import "server-only";

/**
 * Candado B (presentación) del gate de exposición NOTIF — captura pública de
 * suscripciones/notificaciones (NOTIF-05, Phase 103, gated legal 21.719).
 *
 * Flag server-only que decide si la superficie pública de suscripción ("Seguir" en
 * las fichas de proyecto/parlamentario + el centro de cuenta) se expone. Nace OFF
 * (fail-closed): solo el literal "true" lo enciende; cualquier otro valor
 * (undefined, "", "false", "1", "TRUE") => false. NO usa truthiness laxa
 * (`Boolean(env.X)` dejaría pasar "false"); la ausencia ES el default seguro (OFF),
 * NO un error que se lance (a diferencia de `app/lib/supabase.ts`, donde la ausencia
 * de config sí lanza).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/vsim-gate.ts:1`) garantiza que
 * el flag NUNCA llega al bundle del navegador. La var `NOTIF_PUBLIC_ENABLED` NO lleva
 * prefijo `NEXT_PUBLIC_` por la misma razón: no debe viajar al cliente.
 *
 * Recibe `env` inyectado (default `process.env`) para ser testeable sin tocar
 * `process.env` global.
 *
 * DISTINCIÓN vs VSIM/MONEY (Pattern 8): para VSIM/MONEY el flip a `"true"` es deuda de
 * operador PENDIENTE de sign-off. Para NOTIF el operador PRE-AUTORIZÓ el flip esta
 * corrida (2026-07-26) — PERO `.env.example` SIGUE en `=false` y el flip ocurre a
 * DEPLOY-TIME (env var del Worker), NUNCA se committea `=true`. La estrictez del
 * anti-flip guard es IDÉNTICA: un commit de agente no puede encender el gate.
 * Encender requiere `signoff: approved` en `docs/legal/103-LEGAL-DOSSIER-NOTIF.md`
 * (base de licitud + DPA proveedor + ARCO-P Ley 21.719).
 *
 * CHOKEPOINT: esta función es la ÚNICA lectura de `NOTIF_PUBLIC_ENABLED`; toda ruta
 * pública que exponga la superficie de suscripción debe leer el flag vía
 * `notifPublicEnabled(process.env)`, NUNCA `process.env.NOTIF_PUBLIC_ENABLED` crudo
 * (enforzado por notif-antiflip-guard.test.ts vector 3).
 */
export function notifPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NOTIF_PUBLIC_ENABLED === "true";
}
