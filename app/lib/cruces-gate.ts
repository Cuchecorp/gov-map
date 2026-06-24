import "server-only";

/**
 * Candado B (presentación) del doble candado de exposición de CRUCES (SURF-01, D-25).
 *
 * Flag server-only que decide si la sección de cruces parlamentario↔sector
 * (`CrucesSection` en la ficha del parlamentario, que consume el RPC
 * `cruces_de_parlamentario`) se expone a la ciudadanía. Nace OFF (fail-closed):
 * solo el literal "true" lo enciende; cualquier otro valor (undefined, "", "false",
 * "1", "TRUE") => false. NO usa truthiness laxa (`Boolean(env.X)` dejaría pasar
 * "false"); la ausencia ES el default seguro (OFF), NO un error que se lance
 * (a diferencia de `app/lib/supabase.ts`, donde la ausencia de config sí lanza).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/money-gate.ts:1`,
 * `app/lib/net-gate.ts:1` y `app/lib/supabase.ts:1`) garantiza que el flag NUNCA
 * llega al bundle del navegador. La var `CRUCES_PUBLIC_ENABLED` NO lleva prefijo
 * `NEXT_PUBLIC_` por la misma razón: no debe viajar al cliente.
 *
 * Recibe `env` inyectado (default `process.env`, espejo de `moneyPublicEnabled`)
 * para ser testeable sin tocar `process.env` global.
 *
 * DOBLE CANDADO: Candado A (datos) = el RPC `cruces_de_parlamentario` SIN grant a
 * anon + RLS deny-by-default sobre `cruce_senal` (migraciones 0039/0040, ya en PROD).
 * Candado B (presentación) = este flag. Nada de los cruces se expone públicamente
 * hasta que AMBOS estén abiertos.
 *
 * ENCENDER ESTE FLAG requiere `signoff: approved` (firma legal humana, Phase 39) —
 * un agente NUNCA flipea este flag. Hasta el sign-off legal humano, la sección
 * `#cruces` de la ficha queda AUSENTE del HTML (el gate envuelve la `<section>`
 * entera), sin filtrar ningún DOM de cruces.
 *
 * CHOKEPOINT (WR-02): el consumidor único es la página de la ficha (Plan 37-03), que
 * enruta su visibilidad a través de `crucesPublicEnabled(process.env)` (NUNCA leyendo
 * `CRUCES_PUBLIC_ENABLED` crudo). En Plan 37-01 esta función aún no tiene consumidor —
 * se construye por delante de su llamador; el test del consumidor se agrega entonces.
 */
export function crucesPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CRUCES_PUBLIC_ENABLED === "true";
}
