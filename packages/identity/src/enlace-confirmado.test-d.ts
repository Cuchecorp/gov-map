/**
 * Prueba de COMPILACIÓN del invariante tipado (IDENT-12).
 *
 * Este archivo NO se ejecuta en runtime: vitest sólo recoge `*.test.ts`
 * (ver vitest.config.ts `include: ["src/**\/*.test.ts"]`). En cambio, `tsc -b`
 * (el script `typecheck`) SÍ lo compila, porque el tsconfig sólo excluye
 * `src/**\/*.test.ts` (no `*.test-d.ts`). Por eso cada `@ts-expect-error` de abajo
 * es un GATE de compilación: si un string crudo se volviera asignable a
 * `EnlaceConfirmado`, el `@ts-expect-error` quedaría "sin usar" y `tsc` FALLARÍA.
 * Esto demuestra estructuralmente —no por runtime— la imposibilidad de fijar el FK
 * desde un string crudo.
 */
import { confirmar, type EnlaceConfirmado } from "./enlace-confirmado";

// ── NEGATIVO: un string crudo NO es un EnlaceConfirmado ───────────────────────
// @ts-expect-error — un string crudo NO es asignable a EnlaceConfirmado (el FK
// de un writer NO puede fijarse desde un string desnudo).
const _crudo: EnlaceConfirmado = "P00042";
void _crudo;

// ── NEGATIVO: un objeto con la forma correcta pero SIN la marca tampoco compila ─
// @ts-expect-error — falta la marca nominal privada `[ENLACE_CONFIRMADO]`, que es
// imposible de fijar fuera del módulo → no se puede "imitar" el branded type.
const _imitacion: EnlaceConfirmado = {
  parlamentarioId: "P00042",
  metodo: "determinista",
};
void _imitacion;

// ── POSITIVO: el valor minteado por la factory SÍ es asignable (sin error) ─────
const _valido: EnlaceConfirmado = confirmar("P00042");
void _valido;

// ── POSITIVO: encaja en la posición FK de un writer (EnlaceConfirmado | null) ──
const _fkConfirmado: EnlaceConfirmado | null = confirmar("P00500", "humano");
const _fkNulo: EnlaceConfirmado | null = null;
void _fkConfirmado;
void _fkNulo;
