/**
 * Prueba de COMPILACIÓN del invariante tipado de terceros (ENT-03), espejo de
 * enlace-confirmado.test-d.ts.
 *
 * Este archivo NO se ejecuta en runtime: vitest sólo recoge `*.test.ts`. En cambio, `tsc -b`
 * (el script `typecheck`) SÍ lo compila (el tsconfig sólo excluye `*.test.ts`, no `*.test-d.ts`).
 * Cada `@ts-expect-error` es un GATE de compilación: si un string crudo se volviera asignable a
 * `EnlaceEntidadConfirmado`, el `@ts-expect-error` quedaría "sin usar" y `tsc` FALLARÍA. Demuestra
 * estructuralmente —no por runtime— que el FK de tercero no se puede fijar desde un string crudo.
 */
import {
  confirmarEntidad,
  type EnlaceEntidadConfirmado,
} from "./enlace-entidad-confirmado";

// ── NEGATIVO: un string crudo NO es un EnlaceEntidadConfirmado ─────────────────
// @ts-expect-error — un string crudo NO es asignable a EnlaceEntidadConfirmado (el FK
// de un reconciliador NO puede fijarse desde un string desnudo).
const _crudo: EnlaceEntidadConfirmado = "E00042";
void _crudo;

// ── NEGATIVO: un objeto con la forma correcta pero SIN la marca tampoco compila ─
// @ts-expect-error — falta la marca nominal privada `[ENLACE_ENTIDAD_CONFIRMADO]`, que es
// imposible de fijar fuera del módulo → no se puede "imitar" el branded type.
const _imitacion: EnlaceEntidadConfirmado = {
  entidadTerceroId: "E00042",
  metodo: "determinista",
};
void _imitacion;

// ── POSITIVO: el valor minteado por la factory SÍ es asignable (sin error) ─────
const _valido: EnlaceEntidadConfirmado = confirmarEntidad("E00042");
void _valido;

// ── POSITIVO: encaja en la posición FK de un reconciliador (EnlaceEntidadConfirmado | null) ──
const _fkConfirmado: EnlaceEntidadConfirmado | null = confirmarEntidad("E00500", "humano");
const _fkNulo: EnlaceEntidadConfirmado | null = null;
void _fkConfirmado;
void _fkNulo;
