---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
verified: 2026-07-07T00:00:00Z
status: human_needed
score: 4/5 must-haves verified (SC5 pending final operator visual-direction checkpoint)
overrides_applied: 0
human_verification:
  - test: "Abrir docs/demo/ (o el sitio en vivo redeploy) a 1280px y recorrer ficha parlamentario, ficha proyecto, agenda, /red"
    expected: "La ficha de parlamentario comunica su resumen en el primer viewport (qué es, cifras clave, dónde profundizar) SIN scroll; listas completas colapsadas/truncadas; el operador aprueba la dirección visual (variante B 'Informe con rail')"
    why_human: "La corrección de F54 es de percepción/gusto ('claro, escaneable, ir aumentando el detalle'). Es un checkpoint:human-verify gate=blocking (Task 3 de 55-06) que el ejecutor NO puede auto-aprobar. La estructura está verificada por código; el veredicto de dirección visual es intrínsecamente humano."
  - test: "Revisar /red?seed=D1012 en el set de demo (demo-06)"
    expected: "El ego-network abre legible centrado en el vecindario del seed"
    why_human: "El ejecutor marcó (Deviation 4 de 55-06) que un seed de alto grado (D1012, 107 reuniones) renderiza denso en banda horizontal; fiel al sitio pero candidato de ajuste de dirección visual. Requiere juicio del operador sobre si es aceptable."
---

# Phase 55: UXCOG — Rediseño cognitivo (jerarquía visual + detalle progresivo) Verification Report

**Phase Goal:** Rediseñar las superficies ciudadanas con arquitectura de información en 3 capas (resumen visual escaneable → detalle bajo demanda → fuente/trazabilidad), corrigiendo el rechazo del operador post-demo F54 ("información no organizada, mucho texto genérico; piensa de modo cognitivo").
**Verified:** 2026-07-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cada ficha comunica su resumen en el primer viewport (qué es, cifras clave, dónde profundizar) SIN scroll; listas completas solo bajo demanda | ✓ VERIFIED (estructural) | `parlamentario/[id]/page.tsx`: FichaRail sticky + capa-1 (`VotosCapa1`/`LobbyCapa1`/`PatrimonioCapa1`/`CrucesCapa1`) renderizada FUERA de `DetalleColapsable`; cada `*Section` envuelto en `DetalleColapsable` (`defaultOpen` ausente = cerrado). `proyecto/[boletin]/page.tsx`: `TramitacionStepper` visible + `TimelineView` dentro de `DetalleColapsable`. Demo medida 2.133px. La confirmación "sin scroll @1280" es parte del checkpoint humano. |
| 2 | Ficha parlamentario ~28.000px→~5.000px sin perder datos; proyecto agrupa repetitivos y destaca hitos clave | ✓ VERIFIED | Medido en vivo 28.048px→**2.133px** (-92%, supera el objetivo ~5k). Datos preservados: `DetalleColapsable` usa `forceMount` (SSR queda en el HTML, oculto por CSS `data-[state=closed]:hidden`). Proyecto: `hitosClaveStepper()` reduce a hitos clave (cap ~7) + `LineaUrgenciaAgrupada` (N trámites de urgencia); lista exhaustiva solo en el `TimelineView` colapsado (WR-03 aplicado). |
| 3 | Cruces elevados como destino del drill-down en ambas fichas; /red abre legible (ego-network del seed) | ✓ VERIFIED | `CrucesCapa1` petróleo-framed (`border-accent-product` 1.5px) + CTA `<a href="#cruces-detalle">Explorar los N cruces</a>` (WR-02: era botón inerte, ahora ancla real; target `<div id="cruces-detalle">` presente en la página). `red-graph.tsx`: `fitViewOptions.nodes = egoIds` (seed + vecinos 1-hop), `esSeed` marca sobria; `red/page.tsx` conserva `force-dynamic` + fallback fitView global seedless. |
| 4 | Cero regresión: negative-match, lockdown-guard, tsc, suite verdes; PII-safe; tokens design system | ✓ VERIFIED | Ejecutado por el verificador: `vitest run` → **670/670 verde** (64 archivos, incl. `lib/lockdown-guard.test.ts` + negative-match embebido en page tests). `tsc --noEmit` → exit 0. Tokens: WR-01 aplicado — islas nuevas usan utilidades planas (`text-/border-/outline-accent-product`, `bg-accent-product-soft`); grep NO encuentra arbitrary color values en los archivos de fase. No-leak: ninguna isla importa `supabase`/`*Section`; `conteos.ts` mantiene `import "server-only"`. Sin PII (rut/partido) renderizado. |
| 5 | Checkpoint de dirección visual aprobado ANTES + set de demo recapturado al cierre | ⚠️ PARTIAL → human_needed | Pre-checkpoint (sketch B) aprobado por el operador 2026-07-07 (contexto). Set de demo recapturado: commit `01ab5e5`, 6 superficies (Jul 7), técnica same-origin. **Checkpoint FINAL del operador PENDIENTE** (Task 3, `checkpoint:human-verify` gate=blocking) — presentado, veredicto no emitido. NO es un gap (checkpoint en curso), es item de verificación humana. |

**Score:** 4/5 truths verified; SC5 con checkpoint final de operador pendiente (human_needed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/use-scrollspy.ts` | hook IntersectionObserver → id activo | ✓ VERIFIED | Consumido por `FichaRail` (`useScrollspy(navEntries.map(e=>e.id))`); cleanup `obs.disconnect()` (REVIEW). |
| `app/components/detalle-colapsable.tsx` | disclosure sobre children server, cerrado por defecto, forceMount | ✓ VERIFIED | `AccordionPrimitive` `defaultValue={defaultOpen?"d":undefined}`, `Content forceMount`. Trigger usa `text-accent-product` plano (WR-01). |
| `app/components/ficha-rail.tsx` | rail sticky genérico (header + navEntries + caveat + scrollspy) | ✓ VERIFIED | Utilidades planas `bg-accent-product-soft`/`border-accent-product`/`text-accent-product`/`outline-accent-product` (WR-01/IN-03). |
| `app/lib/parlamentario-resumen-conteos.ts` | ConteoCarriles extendido (votosBreakdown/lobbyTopMaterias/crucesSectores/patrimonioPorDeclaracion) | ✓ VERIFIED | `import "server-only"` línea 1; 23 tests en suite verde. |
| `app/components/capa1/{votos,lobby,patrimonio,cruces}-capa1.tsx` | 4 vistas capa-1 puras | ✓ VERIFIED | Wired en `parlamentario/[id]/page.tsx`; vistas puras (tests con fixtures, sin runtime Supabase). |
| `app/components/capa1/tramitacion-stepper.tsx` | stepper de hitos clave + urgencia agrupada | ✓ VERIFIED | `hitosClaveStepper` (cap 7) + `LineaUrgenciaAgrupada` deep-link (WR-03/WR-04). |
| `app/components/red/red-graph.tsx` | grafo ego-framing del seed | ✓ VERIFIED | `fitViewOptions.nodes` = ego; `esSeed`. |
| `app/app/agenda/page.tsx` | agenda agrupada día→comisión colapsable | ✓ VERIFIED | Sub-agrupación presentacional día→comisión, bloques `defaultOpen={index===0}`, cross-links `/proyecto/{boletin}` intactos. |
| `docs/demo/` | set de demo recapturado | ✓ VERIFIED | 6 JPEG 1280px (commit `01ab5e5`); demo-04b eliminado (ficha colapsa a 2.133px). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ficha-rail.tsx` | `use-scrollspy.ts` | `useScrollspy(ids)` marca entrada activa | ✓ WIRED | Línea 45. |
| `parlamentario/[id]/page.tsx` | `ficha-rail.tsx` | `construirChips(conteos)` gate-aware → navEntries | ✓ WIRED | Línea 213/234. |
| `parlamentario/[id]/page.tsx` | `cruces-capa1.tsx` | `detalleHref="#cruces-detalle"` → target `<div id="cruces-detalle">` | ✓ WIRED | CTA ancla real (WR-02). |
| `tramitacion-stepper.tsx` | `timeline-view.tsx` | reusa `construirItems` + reduce a hitos clave | ✓ WIRED | Línea 167; `LineaUrgenciaAgrupada` deep-link `?urgencias={id}#timeline`. |
| `proyecto/[boletin]/page.tsx` | `detalle-colapsable.tsx` | `defaultOpen={urgenciaExpandida != null}` abre timeline con `?urgencias` | ✓ WIRED | Línea 386 (WR-04: el "ver todos" ahora revela los trámites al aterrizar). |
| `red/page.tsx` | `red-graph.tsx` | `?seed=` → `seedId` → `fitViewOptions.nodes` ego | ✓ WIRED | force-dynamic preservado. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite completa verde | `npx vitest run` | 670/670 passed (64 files) | ✓ PASS |
| Typecheck limpio | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Sin arbitrary color values en archivos de fase | grep `\[color:var(--accent-product` en capa1/ficha-rail/detalle | 0 matches (islas de fase) | ✓ PASS |
| No-leak: islas no importan supabase/Section | grep imports en capa1/*.tsx + islas | 0 (solo asserts en tests) | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/components/parlamentario-resumen.tsx` | 93,95 | `hover:/focus-visible:outline-[var(--accent-product)]` (arbitrary, HSL bare → color inválido) | ℹ️ Info | Pre-existente (última modificación phase 51, commit 651bacf) — NO introducido por F55. Solo afecta hover/focus-outline del `ResumenView`. Fuera de scope (IN-04). Recomendable un lint-guard `\[color:var(--` a futuro. |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-03 | 55-01..06 | Legibilidad cognitiva (3 capas, progressive disclosure) | ✓ SATISFIED | Rail + capa-1 escaneable + detalle colapsado; ficha -92%. |
| UX-01/UX-02 | 55-* | Extiende superficies existentes | ✓ SATISFIED | Reusa `*Section`/`construirItems`/`construirChips`; cero RPC nueva, cero DDL. |

## Human Verification Required

### 1. Checkpoint de dirección visual del operador (Task 3, gate=blocking)

**Test:** Abrir `docs/demo/` (o el sitio redeployado) a 1280px y recorrer ficha parlamentario, ficha proyecto, agenda y /red.
**Expected:** La ficha de parlamentario comunica su resumen en el primer viewport (qué es, cifras clave, dónde profundizar) SIN scroll; listas completas colapsadas/truncadas; el operador aprueba/rechaza la dirección visual "Informe con rail".
**Why human:** La corrección de F54 es de percepción. Es un `checkpoint:human-verify` gate=blocking que el ejecutor explícitamente NO auto-aprueba. La estructura está verificada por código; el veredicto es humano. (No es un gap: es el checkpoint en curso.)

### 2. Legibilidad de /red ego-network para seeds de alto grado

**Test:** Revisar `demo-06-red-1280.jpg` (o `/red?seed=D1012` en vivo).
**Expected:** El ego-network abre legible.
**Why human:** El ejecutor marcó (Deviation 4) que D1012 (107 reuniones) renderiza denso en banda horizontal — fiel al sitio, pero candidato de ajuste. Requiere juicio del operador.

## Gaps Summary

No hay gaps técnicos. Los 4 Success Criteria automatizables (SC1-SC4) están VERIFICADOS en código: la arquitectura de 3 capas está construida y cableada (rail sticky + capa-1 siempre visible + detalle colapsado con `forceMount`), la ficha de parlamentario baja a 2.133px sin perder datos, los cruces están elevados con CTA-ancla funcional y /red abre en ego-network, y la suite (670) + tsc + lockdown-guard + negative-match están verdes con tokens planos y contrato no-leak intacto. Las 7 correcciones post-review (WR-01..04, IN-01..03) están efectivamente aplicadas en el código, no solo declaradas.

El único item abierto es el **checkpoint final de dirección visual del operador** (SC5, Task 3 de 55-06) — presentado con el set de demo recapturado, veredicto pendiente. Por ser un `checkpoint:human-verify` de percepción, el estado es `human_needed`, no `passed` ni `gaps_found`.

Nota: el estado del deploy (d2176a33 fue pre-fixes; redeploy en curso) queda EXPLÍCITAMENTE fuera de esta verificación por instrucción — se verificó código y tests, no el artefacto desplegado.

---

_Verified: 2026-07-07_
_Verifier: Claude (gsd-verifier)_
