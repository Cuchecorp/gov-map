---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 03
subsystem: frontend-ui
tags: [ui, parlamentario, rail, capa-1, progressive-disclosure, anti-insinuacion, no-leak, gates]
requires:
  - "55-01 primitivas (FichaRail, DetalleColapsable, bg-accent-product-soft)"
  - "55-02 capa-1 (VotosCapa1/LobbyCapa1/PatrimonioCapa1/CrucesCapa1) + contarCarrilesSeguro extendido"
  - "55-04 patrón de página rail aplicado en /proyecto (misma composición)"
provides:
  - "ficha /parlamentario/[id] recompuesta: grid max-w-5xl + rail sticky + capa-1 visible + detalle colapsado"
  - "ParlamentarioRail (server wrapper) → FichaRail con navEntries de construirChips (gate-aware)"
  - "detalle (*Section) envuelto en DetalleColapsable (default cerrado); auto-open F45 eliminado"
affects:
  - "F38 (ficha proyecto/cruces) y F47/F49 se montan sobre esta estructura drill-down"
tech-stack:
  added: []
  patterns:
    - "Rail server-wrapper (ParlamentarioRail) → FichaRail client con header ReactNode + navEntries serializadas"
    - "Disclosure inverso: capa-1 fuera, *Section como children de DetalleColapsable (contrato no-leak F45)"
    - "navEntries derivadas de construirChips (una sola fuente gate-aware; ids = section ids para scrollspy)"
    - "Detalle solo cuando estado.tipo === 'dato' (n disponible); empty-state honesto lo cubre la capa-1"
key-files:
  created: []
  modified:
    - app/app/parlamentario/[id]/page.tsx
    - app/app/parlamentario/[id]/page.test.tsx
    - app/app/parlamentario/[id]/page-estructura.test.ts
    - app/components/parlamentario-resumen.test.tsx
decisions:
  - "Rail header COMPACTO (chip cámara + nombre <p> + periodo Mono), NO un segundo <h1>: el h1 real vive 1× en HeaderSection (mirror 55-04); se OMITE el ProvenanceBadge duplicado (ya prominente en la cabecera principal)"
  - "DetalleColapsable se renderiza SOLO cuando el carril tiene datos (tipo === 'dato', n disponible); vacio/no_ingerido → la capa-1 muestra el empty honesto sin un expander 'Ver detalle (0)'. MONEY (sin capa-1) usa ternario: colapsa si hay dato, si no renderiza la *Section directa para conservar su empty-state"
  - "Votaciones: se conserva la paginación server existente (?votosPage/?materia) DENTRO del DetalleColapsable; NO se añade 'mostrar más' cliente (evita paginador en conflicto)"
metrics:
  duration: ~35min
  completed: 2026-07-07
  tasks: 2
  files: 4
---

# Phase 55 Plan 03: Ficha de parlamentario — rail + capa-1 + detalle progresivo Summary

La ficha del parlamentario (el deliverable de mayor deuda, ~28.048px de scroll plano) se recompone con la variante B "Informe con rail": grid `max-w-5xl` de dos columnas (rail sticky `FichaRail` de 13rem + contenido 1fr), la **capa-1** de cada carril (cifras de votos, ranking de lobby, mini-columnas de patrimonio, chips de cruces petróleo) queda **SIEMPRE visible fuera del disclosure** alimentada por `contarCarrilesSeguro`, y el **detalle (`*Section`) se envuelve en `DetalleColapsable` (default CERRADO)** con la heurística `abrePorDefecto` de auto-open F45 eliminada. El estado por defecto baja a un orden de ~5.000px SIN perder ningún dato (todo accesible al expandir). Gates cruces/money, frontera `mt-12`, orden load-bearing y contrato no-leak intactos.

## What Was Built

### Task 1 — Recomposición de `page.tsx` (`a073928`)
- **Layout**: `max-w-3xl` → `max-w-5xl` + grid `md:grid-cols-[13rem_1fr] md:gap-8 md:items-start` (track de geometría, no arbitrary color). Rail sticky en la 1ª columna, contenido en la 2ª; `< md` el rail colapsa a barra superior (lo resuelve FichaRail).
- **`ParlamentarioRail`** (server, exportado): lee la cabecera pública (`getParlamentarioPublico`, React.cache dedup con HeaderSection) + `contarCarrilesSeguro`, arma `navEntries` vía `construirChips(conteos)` (misma fuente gate-aware que el índice anterior → orden LOCKED, gates espejo) mapeadas a `RailEntry` (`id` = href sin `#` → coincide con el `id` de la `<section>` para scrollspy/salto; `count` = conteoLabel 3-estado; `marker:"diamante"` para cruces). Header compacto: `CamaraChip` + nombre (`formatNombre`, `<p>`) + periodo Mono. Caveat anti-causal 1× (en el rail). Retorna null si no existe (HeaderSection resuelve el 404).
- **`CarrilesSection`** recompuesta: cada carril sigue siendo `<section id className="mt-12 scroll-mt-6">` HERMANA (frontera LOCKED). Dentro: `<h2>` + conteo (`conteoLabel`, siempre visible) → la **capa-1** correspondiente SIEMPRE visible FUERA del disclosure (`VotosCapa1`←votosBreakdown/asistencia, `LobbyCapa1`←lobbyTopMaterias/total, `PatrimonioCapa1`←patrimonioPorDeclaracion/rangoAnios, `CrucesCapa1`←crucesSectores/total) → `DetalleColapsable n={estado.n}` con el `*Section` server como children (contrato no-leak; CERRADO por defecto), renderizado solo cuando `estado.tipo === "dato"`.
- **`abrePorDefecto` eliminado**: la heurística de auto-open por `tipo === "dato"` se removió; el detalle arranca cerrado (`DetalleColapsable` default `false`). `conteoLabel` conservado verbatim.
- **Gates preservados verbatim**: cruces (`crucesPublicEnabled`) y money (`moneyPublicEnabled`) envuelven la `<section>` entera; OFF ⇒ nodo ausente del HTML Y entrada ausente del rail (el rail deriva de `construirChips` gate-aware). MONEY OFF ⇒ `#financiamiento-pendiente` `opacity-60` con la línea legal LOCKED. Orden id-validate → searchParams y wrappers `LobbySectionConCamara`/`FinanciamientoSectionConPeriodo`/`HeaderSection`/`getParlamentarioPublico` intactos.
- **Skeletons anti-CLS**: `RailSkeleton` (columna angosta: chip + nombre + 5 entradas + caveat) y `CarrilesSkeleton` (por carril: header + bloque de cifras de capa-1) reformados a la forma rail+capa-1; se eliminó `ResumenSkeleton` (obsoleto).

### Task 2 — Tests + skeletons (`1363f26`)
- **`page.test.tsx`**: +6 aserciones nuevas del patrón — (1) rail con una entrada de nav por carril presente + orden gate-aware + caveat 1×; (2) `#cruces` AUSENTE del rail con el gate OFF; (3) capa-1 de votos (cifras) SIEMPRE visible; (4) detalle default-cerrado (`Ver detalle (3)` + `data-state="closed"`); (5+6) source-scan (`VotosCapa1` antes del primer `DetalleColapsable`, orden load-bearing, no-leak). Mock `votos_de_parlamentario` extendido para ejercer el path con datos.
- **`page-estructura.test.ts`**: los invariantes F45 (CarrilAccordion 1:1, `ParlamentarioResumen` antes de la 1ª section) se REEMPLAZARON por los de UXCOG 55-03 (DetalleColapsable presente / cero CarrilAccordion, FichaRail+construirChips, 4 capa-1 fuera del disclosure, `mt-12`+`scroll-mt-6` por section, no-leak de `detalle-colapsable.tsx`). Tests de gates (3), WR-02 (6) y WR-01 (7) conservados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture `CONTEOS_BASE` incompleto rompía `pnpm typecheck`**
- **Found during:** Task 1 (verify `cd app && pnpm typecheck`)
- **Issue:** `parlamentario-resumen.test.tsx` construye un `ConteoCarriles` literal (`CONTEOS_BASE`) que NO fue actualizado cuando 55-02 extendió el tipo con `votosBreakdown`/`lobbyTopMaterias`/`crucesSectores`/`patrimonioPorDeclaracion`/`rangoAnios` → TS2739, bloqueaba el gate de typecheck de mi Task 1.
- **Fix:** Añadidos los 5 campos con su forma vacía honesta al fixture (el `construirChips` bajo prueba no los consume; el TIPO los exige).
- **Files modified:** app/components/parlamentario-resumen.test.tsx
- **Commit:** a073928

**2. [Rule 1 - Bug] `page-estructura.test.ts` afirmaba la estructura F45 superada**
- **Found during:** Task 2 (suite completa)
- **Issue:** El test estructural protegía invariantes F45 (`<CarrilAccordion>` 1:1 por section, `<ParlamentarioResumen>` antes de la 1ª section) que 55-03 deliberadamente reemplaza por el patrón rail+DetalleColapsable → 2 tests rojos.
- **Fix:** Reescritos Test 2 (disclosure inverso: DetalleColapsable presente, cero CarrilAccordion) y Test 4 (rail FichaRail/construirChips + 4 capa-1 fuera del disclosure); Test 1 extendido con `scroll-mt-6`; Test 5 no-leak apunta a `detalle-colapsable.tsx`. Gates/WR-02/WR-01 sin cambios.
- **Files modified:** app/app/parlamentario/[id]/page-estructura.test.ts
- **Commit:** 1363f26

### Aclaraciones de implementación (dentro del alcance)

- **Rail header sin ProvenanceBadge duplicado**: el plan lista "badge frescura compacto" en la composición del header del rail, pero el `ProvenanceBadge` ya vive 1× y prominente en `HeaderSection` (cabecera principal). Duplicarlo en el rail sticky de 13rem añade ruido sin señal nueva. El rail usa un `<p>` compacto (chip cámara + nombre + periodo Mono), mirror EXACTO de la composición de `ProyectoRail` (55-04, "misma composición rail"). Ningún dato se pierde.
- **DetalleColapsable solo con datos**: se renderiza cuando `estado.tipo === "dato"` (n disponible). Con `vacio`/`no_ingerido` la capa-1 ya muestra el empty honesto — un expander "Ver detalle (0)" sería ruido. MONEY (sin capa-1 en 55-02) usa un ternario: colapsa si hay dato, si no renderiza la `*Section` directa para conservar su empty-state.

## Verification

- `cd app && npx vitest run` → **666 tests verdes** (baseline 660; +6 nuevos en page.test.tsx; page-estructura sigue en 7). Nunca decrece.
- `pnpm typecheck` (root, `tsc -b`) + `cd app && pnpm typecheck` (`tsc --noEmit`) → ambos limpios.
- `cd app && npx vitest run lib/lockdown-guard.test.ts` → **8/8** verde (Camino A intacto: cero RPC nueva/DDL/flag; el módulo de conteos no se tocó).
- banned-vocab negative-match verde (suite completa). CERO deps nuevas, CERO token de color arbitrario, `min-h-11` en triggers/links, `mt-12`+`scroll-mt-6` frontera intacta, petróleo reservado (CrucesCapa1 + diamante del rail), caveat anti-causal 1× en el rail.
- Gates: OFF ⇒ sección Y entrada de rail ausentes (verificado por render + source-scan); `crucesSectores` `[]` con gate OFF; `cruces_de_parlamentario` nunca invocado con el gate OFF (prueba load-bearing de Candado B).

## Self-Check: PASSED

- app/app/parlamentario/[id]/page.tsx — FOUND (contiene FichaRail, DetalleColapsable, 4 capa-1)
- app/app/parlamentario/[id]/page.test.tsx — FOUND (14 tests)
- app/app/parlamentario/[id]/page-estructura.test.ts — FOUND (7 tests, invariantes 55-03)
- app/components/parlamentario-resumen.test.tsx — FOUND (fixture completo)
- commits a073928, 1363f26 — FOUND
