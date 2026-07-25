import "server-only";

/**
 * Candado B (presentación) del gate de exposición VSIM — similitud de votación
 * (VSIM-02, Phase 102, gated legal 21.719 / anti-DW-NOMINATE).
 *
 * Flag server-only que decide si la sección de similitud de votación (coincidencia
 * de votos entre dos parlamentarios) se expone en la superficie pública /comparar.
 * Nace OFF (fail-closed): solo el literal "true" lo enciende; cualquier otro valor
 * (undefined, "", "false", "1", "TRUE") => false. NO usa truthiness laxa
 * (`Boolean(env.X)` dejaría pasar "false"); la ausencia ES el default seguro (OFF),
 * NO un error que se lance (a diferencia de `app/lib/supabase.ts`, donde la ausencia
 * de config sí lanza).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/money-gate.ts:1`) garantiza que
 * el flag NUNCA llega al bundle del navegador. La var `VSIM_PUBLIC_ENABLED` NO lleva
 * prefijo `NEXT_PUBLIC_` por la misma razón: no debe viajar al cliente.
 *
 * Recibe `env` inyectado (default `process.env`) para ser testeable sin tocar
 * `process.env` global.
 *
 * ENCENDER ESTE FLAG requiere `signoff: approved` en el dossier legal
 * (`docs/legal/102-LEGAL-DOSSIER-VSIM.md`) — es una deuda de operador. La similitud
 * de votación cruza la línea anti-DW-NOMINATE (insinuación de afinidad/coordinación)
 * si se enciende sin el caveat legal aprobado; hasta el sign-off humano, la sección
 * de similitud permanece oculta (flag OFF => cero DOM, cero RPC).
 *
 * CHOKEPOINT: esta función es la ÚNICA lectura de `VSIM_PUBLIC_ENABLED`; toda ruta
 * pública que exponga similitud de votación debe leer el flag vía
 * `vsimPublicEnabled(process.env)`, NUNCA `process.env.VSIM_PUBLIC_ENABLED` crudo
 * (enforzado por vsim-antiflip-guard.test.ts vector 3).
 */
export function vsimPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VSIM_PUBLIC_ENABLED === "true";
}
