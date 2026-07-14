/**
 * Prueba de COMPILACIÓN del invariante tipado del FK del voto (SC#4).
 *
 * Este archivo NO se ejecuta en runtime: vitest sólo recoge `*.test.ts`
 * (ver vitest.config.ts `include: ["src/**\/*.test.ts"]`). En cambio, `tsc -b`
 * (el script `typecheck`) SÍ lo compila, porque el tsconfig sólo excluye
 * `src/**\/*.test.ts` (no `*.test-d.ts`). Por eso cada `@ts-expect-error` es un
 * GATE de compilación: si un string crudo se volviera asignable a
 * `VotoParaEscribir["enlace"]` (el FK branded `EnlaceConfirmado | null`), el
 * `@ts-expect-error` quedaría "sin usar" y `tsc` FALLARÍA. Prueba estructural —no
 * por runtime— de que un FK de voto NO puede fabricarse desde un string desnudo.
 *
 * Espejo de `packages/identity/src/enlace-confirmado.test-d.ts`. NO toca ningún runtime.
 */
import type { VotoParaEscribir } from "@obs/tramitacion";

// Posición FK del voto = VotoParaEscribir["enlace"] = EnlaceConfirmado | null (branded).
type EnlaceFK = VotoParaEscribir["enlace"];

// ── NEGATIVO: un string crudo NO es asignable al FK del voto ──────────────────
// @ts-expect-error — un string crudo NO puede fijarse en el FK del voto (el branded
// EnlaceConfirmado rechaza estructuralmente un string desnudo).
const _crudo: EnlaceFK = "P00042";
void _crudo;

// ── POSITIVO: `null` SÍ es asignable (fail-closed: no_confirmado usa enlace=null) ─
const _nulo: EnlaceFK = null;
void _nulo;
