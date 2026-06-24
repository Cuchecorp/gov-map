import "server-only";

/**
 * Gate server-only de la superficie ADMIN de revisión de identidades de TERCEROS (ENT-04).
 *
 * La cola `revision_entidad` y la maestra `entidad_tercero` son PII interna deny-by-default
 * (la cola jamás debe ser superficie pública). Este flag decide si la ruta admin protegida
 * (`/admin/revisar-entidades`) se monta en ESTE despliegue. Nace OFF (fail-closed): solo el
 * literal "true" lo enciende; cualquier otro valor (undefined, "", "false", "1", "TRUE") => false.
 * NO usa truthiness laxa (`Boolean(env.X)` dejaría pasar "false"); la ausencia ES el default
 * seguro (OFF), NO un error que se lance (espejo de `net-gate.ts` / `money-gate.ts`).
 *
 * `import "server-only"` (línea 1, espejo de `app/lib/supabase.ts:1`) garantiza que el flag NUNCA
 * llega al bundle del navegador. La var `ADMIN_REVISION_ENABLED` NO lleva prefijo `NEXT_PUBLIC_`
 * por la misma razón: no debe viajar al cliente.
 *
 * CHOKEPOINT: la ruta `/admin/revisar-entidades` enruta su visibilidad SOLO a través de
 * `adminRevisionEnabled(process.env)` como su PRIMERA sentencia (NUNCA leyendo el flag crudo);
 * con OFF la ruta 404 sin filtrar ningún DOM de la cola al HTML. La promoción de un dudoso a
 * `confirmado` es SIEMPRE humana (vía el RPC `resolver_entidad`); ningún caso se auto-confirma.
 */
export function adminRevisionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ADMIN_REVISION_ENABLED === "true";
}
