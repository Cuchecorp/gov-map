/**
 * Prueba de COMPILACIÓN del invariante tipado del RUT escribible (RUT-01, CR-01).
 *
 * Este archivo NO se ejecuta en runtime: vitest sólo recoge `*.test.ts`
 * (ver vitest.config.ts `include: ["src/**\/*.test.ts"]`). En cambio, `tsc -b`
 * (el script `typecheck`) SÍ lo compila, porque el tsconfig sólo excluye
 * `src/**\/*.test.ts` (no `*.test-d.ts`). Por eso cada `@ts-expect-error` de abajo es un
 * GATE de compilación: si un RUT NO corroborado (un objeto plano, un string, un candidato
 * derivado por NOMBRE) se volviera asignable a `FilaRutCorroborada` / al input del writer
 * `updateRut`, el `@ts-expect-error` quedaría "sin usar" y `tsc` FALLARÍA.
 *
 * ESTO ES LA DEFENSA DURABLE que un guard estático de regex no puede dar: el guard de
 * texto (`app/lib/name-match-rut-guard.test.ts`) es evadible por aliasing
 * (`const x = revisionesRut; updateRut(x)`), `.map`, spread o un helper. El compilador NO
 * es evadible: sin la marca privada `[RUT_CORROBORADO]` (imposible de fijar fuera de
 * `rut-corroborado.ts`), NADA llega al writer. Espeja `enlace-confirmado.test-d.ts`.
 */
import {
  corroborarRutFila,
  type FilaRutCandidata,
  type FilaRutCorroborada,
} from "./rut-corroborado";
import type { RutBackfillWriter } from "./backfill-rut";

// El input del writer (choke point): `updateRut(rows: FilaRutCorroborada[])`.
declare const writer: RutBackfillWriter;

// ── NEGATIVO: un objeto plano con la forma correcta pero SIN la marca NO compila ──
// @ts-expect-error — falta la marca nominal privada `[RUT_CORROBORADO]`, imposible de
// fijar fuera del módulo → no se puede "imitar" el branded type. Éste es el vector real:
// un RUT derivado por NOMBRE llega como objeto plano `{ id, rut, ... }`.
const _imitacion: FilaRutCorroborada = {
  id: "P00042",
  rut: "761234560",
  origen: "harvest:name-only",
  fecha_captura: "2026-06-19T00:00:00Z",
  enlace: "https://x.cl",
};
void _imitacion;

// ── NEGATIVO: un string crudo NO es un FilaRutCorroborada ─────────────────────────
// @ts-expect-error — un string desnudo NO es asignable al tipo branded del writer.
const _crudo: FilaRutCorroborada = "761234560";
void _crudo;

// ── NEGATIVO: un objeto plano (name-derived) NO llega al writer `updateRut` ────────
// Un RUT name-only llega como objeto plano `{ id, rut, ... }`; sin la marca no satisface
// `FilaRutCorroborada[]`. Se aísla en un const tipado para que el `@ts-expect-error`
// preceda EXACTAMENTE a la línea de la asignación (donde TS reporta el mismatch).
// @ts-expect-error — falta la marca `[RUT_CORROBORADO]`: un RUT name-only NO puede
// alimentar el writer (el compilador lo rechaza, no un regex).
const _filaNameOnly: FilaRutCorroborada = {
  id: "P00500",
  rut: "761234560",
  origen: "harvest:chilecompra:rut-name-only-pendiente-humano",
  fecha_captura: "2026-06-19T00:00:00Z",
  enlace: "https://x.cl",
};
void writer.updateRut([_filaNameOnly]);

// ── NEGATIVO: una `FilaRutCandidata` (el input SIN gate) tampoco satisface al writer ──
declare const candidata: FilaRutCandidata;
// @ts-expect-error — una fila candidata (sin pasar por `corroborarRutFila`) NO es
// `FilaRutCorroborada`; el gate es obligatorio para llegar al writer.
void writer.updateRut([candidata]);

// ── POSITIVO: el valor minteado por la factory SÍ es asignable al writer ───────────
const res = corroborarRutFila({
  id: "P00500",
  rut: "12.345.678-5",
  origen: "servel:track-b",
  fecha_captura: "2026-06-19T00:00:00Z",
  enlace: "https://servel.cl/x",
});
if (res.ok) {
  const _valido: FilaRutCorroborada = res.fila;
  void _valido;
  // Encaja en el input del writer (la corroboración es la ÚNICA vía).
  void writer.updateRut([res.fila]);
}
