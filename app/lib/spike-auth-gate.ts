import "server-only";

/**
 * Gate server-only del SPIKE auth-on-Workers (Phase 97 — CR-01).
 *
 * `/spike-auth` es una superficie de de-risk que dispara un flujo OTP no autenticado con
 * `shouldCreateUser: true`: cualquier actor que descubra la ruta podría hacer que Supabase
 * envíe correos OTP a direcciones de terceros y auto-crear filas de usuario en GoTrue
 * (abuso de relay + contaminación de la tabla de usuarios). "No enlazada" es seguridad por
 * obscuridad, NO un control. Este flag decide si la ruta y sus server actions se ejercen en
 * ESTE despliegue.
 *
 * Nace OFF (fail-closed), espejo de `admin-gate.ts` / `net-gate.ts` / `money-gate.ts`: SOLO
 * el literal "true" lo enciende; cualquier otro valor (undefined, "", "false", "1", "TRUE")
 * => false. NO usa truthiness laxa (`Boolean(env.X)` dejaría pasar "false"); la ausencia ES
 * el default seguro (OFF). En el Worker de producción la var queda SIN setear -> la ruta 404
 * y las server actions se rehúsan. El operador la enciende solo en preview.
 *
 * `import "server-only"` (línea 1) garantiza que el flag NUNCA llega al bundle del navegador.
 * `SPIKE_AUTH_ENABLED` NO lleva prefijo `NEXT_PUBLIC_` por la misma razón.
 *
 * CHOKEPOINT: la ruta `/spike-auth` y CADA server action (`enviarOtp`, `verificarOtp`)
 * consultan `spikeAuthEnabled(process.env)` como su PRIMERA sentencia. Las server actions son
 * invocables de forma independiente del render de la página, así que NO pueden confiar en el
 * gate de la página.
 */
export function spikeAuthEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.SPIKE_AUTH_ENABLED === "true";
}
