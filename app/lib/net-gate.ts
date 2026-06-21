import "server-only";

/**
 * Candado B (presentación) del doble candado de exposición NET (NET-01/NET-02, D-25).
 *
 * Flag server-only que decide si la superficie pública de NET (el grafo de
 * influencia `/red` que consume el RPC `subgrafo_red`) se expone a la ciudadanía.
 * Nace OFF (fail-closed): solo el literal "true" lo enciende; cualquier otro valor
 * (undefined, "", "false", "1", "TRUE") => false. NO usa truthiness laxa
 * (`Boolean(env.X)` dejaría pasar "false"); la ausencia ES el default seguro (OFF),
 * NO un error que se lance (a diferencia de `app/lib/supabase.ts`, donde la ausencia
 * de config sí lanza).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/money-gate.ts:1` y
 * `app/lib/supabase.ts:1`) garantiza que el flag NUNCA llega al bundle del navegador.
 * La var `NET_PUBLIC_ENABLED` NO lleva prefijo `NEXT_PUBLIC_` por la misma razón:
 * no debe viajar al cliente.
 *
 * Recibe `env` inyectado (default `process.env`, espejo de `moneyPublicEnabled`)
 * para ser testeable sin tocar `process.env` global.
 *
 * DOBLE CANDADO: Candado A (datos) = RLS deny-by-default sobre `entidad`/`arista`
 * (migración 0030_net.sql). Candado B (presentación) = este flag. Nada de NET se
 * expone públicamente hasta que AMBOS estén abiertos.
 *
 * ENCENDER ESTE FLAG requiere `signoff: approved` en el dossier legal
 * (`17-LEGAL-DOSSIER.md`) — es la deuda de operador F17. Hasta el sign-off legal
 * humano, la ruta `/red` 404 sin filtrar ningún DOM de NET.
 *
 * CHOKEPOINT: el chokepoint único queda EFECTIVAMENTE enforzado cuando la ruta
 * `/red` enruta su visibilidad a través de `netPublicEnabled(process.env)` (NUNCA
 * leyendo `NET_PUBLIC_ENABLED` crudo) como su PRIMERA sentencia.
 */
export function netPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NET_PUBLIC_ENABLED === "true";
}
