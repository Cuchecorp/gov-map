import "server-only";

/**
 * Flag server-only fail-closed para la búsqueda híbrida (RETR-05).
 *
 * Decide si `buscarProyectos` enruta a la RPC híbrida `buscar_proyectos_hibrido`
 * en vez de `match_proyectos`. Nace OFF (fail-closed): solo el literal "true"
 * lo enciende; cualquier otro valor (undefined, "", "false", "1", "TRUE") → false.
 *
 * `import "server-only"` garantiza que el flag NUNCA llega al bundle del cliente.
 * La var `BUSQUEDA_HIBRIDA_ENABLED` NO lleva prefijo `NEXT_PUBLIC_` por la misma
 * razón: no debe viajar al cliente (T-87-05).
 *
 * Recibe `env` inyectado (default `process.env`) para ser testeable sin tocar
 * `process.env` global (espejo de cruces-gate.ts).
 *
 * El default OFF se mantiene hasta que el gate de dominancia (Plan 87-03) lo flipee.
 */
export function busquedaHibridaEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BUSQUEDA_HIBRIDA_ENABLED === "true";
}
