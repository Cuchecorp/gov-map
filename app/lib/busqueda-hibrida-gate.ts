import "server-only";

/**
 * Flag server-only para la búsqueda híbrida (RETR-05).
 *
 * Decide si `buscarProyectos` enruta a la RPC híbrida `buscar_proyectos_hibrido`
 * en vez de `match_proyectos`.
 *
 * DEFAULT ON (flippeado tras gate de dominancia — Plan 87-03, 2026-07-22):
 *   - RPC real domina: 43.8% hit@1, 68.8% hit@5, 53.6% MRR@5
 *   - Boletín 4/4 tras fix bo-03 (migración 0056)
 *   - Rollback: setear BUSQUEDA_HIBRIDA_ENABLED=false en Cloudflare → OFF inmediato
 *
 * Solo el literal "false" apaga el flag (rollback explícito).
 * Cualquier otro valor (undefined, "", "true", "1") → ON.
 *
 * `import "server-only"` garantiza que el flag NUNCA llega al bundle del cliente.
 * La var `BUSQUEDA_HIBRIDA_ENABLED` NO lleva prefijo `NEXT_PUBLIC_` (T-87-05).
 *
 * Recibe `env` inyectado (default `process.env`) para ser testeable sin tocar
 * `process.env` global (espejo de cruces-gate.ts).
 */
export function busquedaHibridaEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BUSQUEDA_HIBRIDA_ENABLED !== "false";
}
