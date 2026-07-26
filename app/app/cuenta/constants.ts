/**
 * Constantes de /cuenta (NOTIF-01, Phase 103) — módulo plano (NO "use server").
 *
 * `CONSENT_VERSION` vivía en `actions.ts`, pero en Next.js 16 un módulo con
 * `"use server"` SOLO puede exportar funciones async; un `export const` no-async
 * envenena el módulo entero ("The module has no exports at all") y rompe el build
 * OpenNext (verificarOtp/enviarOtp desaparecen del grafo). Se extrae aquí para que el
 * módulo de server actions quede con exports 100% async, sin cambiar el contrato de
 * versión de consentimiento (21.719 — trazabilidad) que consumen actions.ts y page.tsx.
 */

/** Versión del texto de consentimiento informado vigente (21.719 — trazabilidad). */
export const CONSENT_VERSION = "1";
