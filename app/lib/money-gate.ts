import "server-only";

/**
 * Candado B (presentación) del doble candado de exposición MONEY (LEGAL-01, D-25).
 *
 * Flag server-only que decide si las secciones MONEY (financiamiento SERVEL +
 * contratos ChileCompra) se exponen en la ficha pública. Nace OFF (fail-closed):
 * solo el literal "true" lo enciende; cualquier otro valor (undefined, "", "false",
 * "1", "TRUE") => false. NO usa truthiness laxa (`Boolean(env.X)` dejaría pasar
 * "false"); la ausencia ES el default seguro (OFF), NO un error que se lance
 * (a diferencia de `app/lib/supabase.ts`, donde la ausencia de config sí lanza).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/supabase.ts:1`) garantiza que
 * el flag NUNCA llega al bundle del navegador. La var `MONEY_PUBLIC_ENABLED` NO lleva
 * prefijo `NEXT_PUBLIC_` por la misma razón: no debe viajar al cliente.
 *
 * Recibe `env` inyectado (default `process.env`, espejo de `loadRouterConfigFromEnv`
 * en `packages/llm/src/config.ts`) para ser testeable sin tocar `process.env` global.
 *
 * ENCENDER ESTE FLAG requiere `signoff: approved` en el dossier legal
 * (`docs/legal/13-LEGAL-DOSSIER.md`, D-32) — es la deuda de operador F13. Hasta el
 * sign-off legal humano, toda ruta pública MONEY de Phases 14-16 permanece oculta.
 *
 * CHOKEPOINT (WR-02): en Phase 13 esta función aún no tiene consumidor — se construye
 * por delante de sus llamadores (sección ficha MONEY + RPC de Phases 14-16). El
 * chokepoint único queda EFECTIVAMENTE enforzado cuando Phase 14 enrute toda ruta
 * pública MONEY a través de `moneyPublicEnabled(process.env)` (NUNCA leyendo
 * `MONEY_PUBLIC_ENABLED` crudo); el test del consumidor se agrega entonces.
 */
export function moneyPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.MONEY_PUBLIC_ENABLED === "true";
}
