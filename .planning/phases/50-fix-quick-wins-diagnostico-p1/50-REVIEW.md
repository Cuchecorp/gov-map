---
phase: 50-fix-quick-wins-diagnostico-p1
reviewed: 2026-07-02T00:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - app/app/agenda/error.tsx
  - app/app/agenda/page.tsx
  - app/app/buscar/error.tsx
  - app/app/page.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentarios/error.tsx
  - app/app/proyecto/[boletin]/error.tsx
  - app/components/autores-list.tsx
  - app/components/camara-chip.tsx
  - app/components/ficha-header.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/components/patrimonio-de-parlamentario.tsx
  - app/components/votacion-card.tsx
  - app/components/votos-por-parlamentario.tsx
  - app/lib/format.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
fixes_applied:
  fixed_at: 2026-07-02T00:00:00Z
  scope: critical_warning
  warning_fixed: 2
  warning_open: 0
  info_deferred: 3
  items:
    - id: WR-01
      commit: 8f90753
      note: esHistorica guard ISO (fecha null/no-ISO → no fabrica 'histórica'); +6 tests
    - id: WR-02
      commit: 0b372f3
      note: getParlamentarioPublico via React.cache dedup en los 3 sitios; cero RPC nueva
  tests: 406 passed (baseline 400, +6); tsc -b limpio; lockdown-guard 7/7
status: fixes_applied
---

# Phase 50: Code Review Report

**Reviewed:** 2026-07-02
**Depth:** deep (cross-file: call-sites de helpers + props threadeadas)
**Files Reviewed:** 15
**Status:** fixes_applied (WR-01 `8f90753`, WR-02 `0b372f3`; 3 Info diferidos por decisión de fase)

## Summary

Los 11 fixes de la fase están implementados con solidez y respetan la doctrina
(honest-states no fabrican, copy es-CL sin vocabulario prohibido, fuente/fecha/enlace
intactos, Camino A: cero `.from()` PII nueva, cero RPC nueva). Los 4 `error.tsx`
espejan verbatim el patrón `unstable_retry` y NUNCA vuelcan `error.message`/stack al
DOM (solo `console.error`). El guard `fechaCortaSegura` y el umbral `esStale` de 14 días
son retro-compatibles y correctos. La omisión del chip `desconocida` es segura en los
4 call-sites (todos dentro de `flex flex-wrap gap-2`).

Dos defectos merecen atención antes de considerar la fase cerrada:

1. **B17 quedó incompleto** (WARNING): el mismo `fecha_presentacion` que ahora se guarda
   para DISPLAY sigue crudo en `esHistorica()`, que trata `null` como epoch → etiqueta
   "histórica" fabricada sobre un dato ausente.
2. **B10 agregó una tercera lectura duplicada** de `parlamentario_publico` sin
   `React.cache` (WARNING de duplicación/IO redundante).

No se encontraron bugs bloqueantes, vulnerabilidades ni regresiones de seguridad/PII.

## Structural Findings (fallow)

No se proporcionó bloque `<structural_findings>` en esta invocación. Todo lo de abajo es
narrativa del revisor.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `esHistorica()` fabrica la etiqueta "declaración histórica" con `fecha_presentacion` null (B17 incompleto) — RESUELTO (`8f90753`)

> **RESUELTO 2026-07-02** (`8f90753`): `esHistorica` aplica el guard ISO (slice+regex,
> espejo de `fechaCortaSegura`) antes de `new Date`; fecha null/vacía/no-ISO → `false`
> (no se afirma "histórica"). Firma ampliada a `string | null`. +6 tests RTL/unit.


**File:** `app/components/patrimonio-de-parlamentario.tsx:714-721` (usado en `:689`, renderizado en `:407-412`)

**Issue:** B17 guardó el DISPLAY de la fecha con `fechaCortaSegura` en `VersionRow` (`:384`)
y en la comparación (`:608`) — reconociendo explícitamente que `fecha_presentacion` puede
venir `null`/vacía/no-ISO en runtime (el tipo `fecha_presentacion: string` en `lib/types.ts`
es optimista). Pero `esHistorica(f.fecha_presentacion)` lee ese MISMO campo crudo sin guard:

```ts
export function esHistorica(fechaPresentacion: string, now: Date = new Date()): boolean {
  const presentada = new Date(fechaPresentacion).getTime(); // new Date(null) → 0 (epoch)
  const unAnioMs = 365 * 24 * 60 * 60 * 1000;
  return now.getTime() - presentada > unAnioMs; // now - 0 >> 1 año → true
}
```

Con `fecha_presentacion === null`, `new Date(null).getTime() === 0` → devuelve `true`, y
`VersionRow` pinta el caveat ámbar contradictorio:
"Esta es una declaración histórica, presentada el **fecha no informada**. No representa
necesariamente el estado actual." Esto fabrica una afirmación ("es histórica") a partir
de un dato ausente — exactamente lo que la doctrina de honest-states prohíbe, y el flanco
que B17 vino a cerrar. (Una cadena basura no-ISO da `NaN` → `false`, así que solo `null`/
vacío dispara el falso "histórica", pero ese es precisamente el caso que motivó B17.)

**Fix:** Aplicar el mismo guard ISO antes de `new Date`; ante fecha no parseable, NO
etiquetar histórica (conservador, no fabrica):

```ts
export function esHistorica(fechaPresentacion: string | null, now: Date = new Date()): boolean {
  const iso = (fechaPresentacion ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false; // sin fecha válida → no se afirma "histórica"
  const presentada = new Date(iso).getTime();
  if (Number.isNaN(presentada)) return false;
  return now.getTime() - presentada > 365 * 24 * 60 * 60 * 1000;
}
```

### WR-02: `parlamentario_publico` se consulta hasta 3× por render sin `React.cache` (B10 agregó la 3ª copia) — RESUELTO (`0b372f3`)

> **RESUELTO 2026-07-02** (`0b372f3`): extraído `getParlamentarioPublico = cache(async (id) => …)`
> (throw-on-error #34) y reusado en `HeaderSection`, `LobbySectionConCamara` y
> `FinanciamientoSectionConPeriodo` → una sola RPC por request, cero copy-paste,
> comportamiento idéntico, cero RPC nueva. `tsc -b` limpio.


**File:** `app/app/parlamentario/[id]/page.tsx:393` (HeaderSection), `:337` (LobbySectionConCamara, nuevo B10), `:369` (FinanciamientoSectionConPeriodo)

**Issue:** El wrapper `LobbySectionConCamara` que introdujo B10 es el TERCER bloque
idéntico (`createServerSupabase().rpc("parlamentario_publico", { p_id: id }).maybeSingle()`
+ throw #34) en el mismo árbol de render. `HeaderSection` ya trae esa misma fila; con MONEY
ON, `FinanciamientoSectionConPeriodo` la trae una vez más. Ninguno está deduplicado: son
tres round-trips a la misma RPC con el mismo `p_id`. El propio encabezado del archivo
elogia `React.cache` para deduplicar los conteos (`contarCarrilesSeguro`), y el codebase ya
tiene el patrón (`leerFicha = cache(...)` en `proyecto/[boletin]/page.tsx:84`) — pero estas
tres lecturas de `parlamentario_publico` no lo usan. Es duplicación de código (tres bloques
copy-paste) + IO redundante. B10 empeoró una duplicación preexistente en vez de encapsularla.

**Fix:** Extraer un lector cacheado y reusarlo en los tres sitios:

```ts
import { cache } from "react";

const getParlamentarioPublico = cache(async (id: string) => {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .rpc("parlamentario_publico", { p_id: id })
    .maybeSingle<ParlamentarioPublicoRow>();
  if (error) throw new Error(`parlamentario_publico falló para ${id}: ${error.message}`);
  return data;
});
```

`HeaderSection`, `LobbySectionConCamara` y `FinanciamientoSectionConPeriodo` llaman
`getParlamentarioPublico(id)` → una sola RPC por request, cero copy-paste, mismo #34.

## Info

### IN-01: Código muerto `voto-ficha-row.tsx` conserva el honest-state per-fila que la fase dedupó en otro lado

**File:** `app/components/voto-ficha-row.tsx:89`

**Issue:** La decisión de honest-state repetido (CONTEXT) listaba `votos-por-parlamentario.tsx:228`
y `voto-ficha-row.tsx:89`. Se dedupó el primero (nota una-vez-por-sección) pero el segundo
quedó intacto con `"De qué trata: no disponible aún"` por fila. Verificado: `voto-ficha-row.tsx`
solo lo importa su propio test (`votos-por-parlamentario.test.tsx:4`), no lo renderiza ninguna
página → código muerto, sin impacto en el usuario. La SUMMARY 50-02 documenta la diferición
(B24/Phase 51). Se anota por trazabilidad: el componente muerto sigue contradiciendo el
invariante de la fase.

**Fix:** Diferido OK. Al retomar B24, o borrar el componente muerto (+su test) o alinear el
honest-state para consistencia.

### IN-02: Asimetría de copy en `fuenteLobbyPorCamara` (diputados lleva URL, senado no)

**File:** `app/components/lobby-de-parlamentario.tsx:80-90`

**Issue:** La rama `diputados` devuelve "el registro oficial de la Cámara
(camara.cl/transparencia)" con dominio, pero la rama `senado` devuelve "el registro de la
Ley del Lobby del Senado" sin URL equivalente. El enlace real por fila (`sourceUrl={a.enlace}`)
está intacto en ambos casos (trazabilidad correcta), así que esto es solo cosmético en el
frame/intro. La CONTEXT dejó el copy exacto a discreción del executor.

**Fix:** Opcional. Para paridad, añadir el registro/dominio del Senado si existe uno público
estable, o quitar el paréntesis de la Cámara para simetría. No bloquea.

### IN-03: La nota "algunos proyectos… idea matriz" depende de la página actual

**File:** `app/components/votos-por-parlamentario.tsx:331,442`

**Issue:** `hayArcoSinIdea = arcos.some((g) => !g.idea_matriz)` se computa sobre `votos`
(la página paginada), no sobre el conjunto completo. Si la página 1 tiene todos los arcos
con idea y la página 2 tiene uno sin idea, la nota de sección no aparece en la página 1.
Esto es DEFENDIBLE (la nota refleja lo efectivamente mostrado y nunca sobre-afirma), pero
es una decisión implícita: el lector podría no ver la salvedad aunque el parlamentario sí
tenga proyectos sin idea. Se anota, no es un defecto.

**Fix:** Ninguno requerido. Si se quiere la salvedad global, derivarla del conjunto completo
en `derivarVotosViewData` y pasarla como flag en `VotosViewData` (como `totalProyectos`).

---

_Reviewed: 2026-07-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
