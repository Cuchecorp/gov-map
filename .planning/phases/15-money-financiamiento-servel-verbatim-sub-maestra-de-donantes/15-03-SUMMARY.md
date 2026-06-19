---
phase: 15-money-financiamiento-servel-verbatim-sub-maestra-de-donantes
plan: 03
subsystem: frontend-ficha-money
tags: [money, servel, financiamiento, ficha, exposure-gate, honestidad, ley-21719]
requires:
  - "RPC aportes_de_parlamentario (Plan 15-01)"
  - "marcador aportes_ingesta_estado (Plan 15-01)"
  - "writer SERVEL origen=servel + enlace por NOMBRE confirmado (Plan 15-02)"
  - "moneyPublicEnabled (Phase 13)"
provides:
  - "FinanciamientoView (pura, RTL-testable)"
  - "FinanciamientoSection (Server Component gated)"
  - "rama SERVEL en sourceLabel()"
  - "interface AporteRpcRow (sin RUT donante)"
  - "seccion #financiamiento montada en /parlamentario/[id]"
affects:
  - "app/app/parlamentario/[id]/page.tsx"
  - "app/lib/types.ts"
tech-stack:
  added: []
  patterns:
    - "espejo archivo-por-archivo de contratos-de-parlamentario.tsx"
    - "doble candado: moneyPublicEnabled() en page.tsx (heading ausente OFF) + re-check en Section"
    - "View pura props-only para RTL + Server Component gate->RPC->marcador->View"
key-files:
  created:
    - "app/components/financiamiento-de-parlamentario.tsx"
    - "app/components/financiamiento-de-parlamentario.test.tsx"
  modified:
    - "app/lib/types.ts"
    - "app/app/parlamentario/[id]/page.tsx"
decisions:
  - "eleccionActual=null por defecto (heuristica conservadora): sin fuente confiable del periodo del mandato vigente, ningun grupo se etiqueta 'anterior'; el Eleccion: por fila (defense in depth) ya impide atribuir un aporte previo al mandato actual"
  - "fila_id sintetico (eleccion#fecha#indice) para React key; la PK compuesta (fuente_id, fecha_corte) no se proyecta por el RPC"
  - "A1: la asociacion candidato es POR NOMBRE confirmado (SERVEL no trae RUT), nunca por RUT — corrige el UI-SPEC manteniendo su estructura"
metrics:
  duration: "~15 min"
  completed: "2026-06-19"
  tasks: 2
  files: 4
  commits: 2
---

# Phase 15 Plan 03: Financiamiento de campaña (SERVEL) ficha section Summary

Seccion ciudadana gateada "Aportes de campaña registrados en SERVEL" en la ficha del parlamentario — espejo de `contratos-de-parlamentario.tsx` con tres estados honestos, agrupacion por eleccion + caveat de candidatura anterior, donante como sujeto propio (RUT nunca renderizado), y asociacion al candidato **por nombre confirmado** (no por RUT, correccion A1).

## What Was Built

### Task 1 — `types.ts` (sourceLabel + AporteRpcRow) + componente (commit `f1d7979`)
- **`app/lib/types.ts`**: rama `if (o.includes("servel")) return "SERVEL";` en `sourceLabel()` (antes del fallthrough). Nueva interface `AporteRpcRow` junto a `ContratoRpcRow`: `eleccion` NON-NULL (load-bearing), `donante_nombre`/`tipo_persona`/`monto`/`fecha_aporte`/`tipo_aporte`/`candidato_nombre_verbatim` nullable, `origen`/`fecha_captura`/`fecha_corte`/`enlace`/`licencia`. **NUNCA incluye RUT del donante** (Ley 21.719).
- **`app/components/financiamiento-de-parlamentario.tsx`** (sin `"use client"`): dos exports.
  - `FinanciamientoView` (pura, props-only): `Intro()` (2 lineas muted — frame honesto "asociados a este candidato por su nombre" + atribucion "Fuente: SERVEL … términos de uso por verificar"), los tres estados (`no_ingestado` / `verificado_sin_aportes` con fecha de corte / `enlazado`), lista AGRUPADA por eleccion (`agruparPorEleccion`), caveat amber de grupo para candidatura anterior, `AporteFila` con el donante como sujeto (`Aporta: …`) + linea separada `Asociado por nombre confirmado al candidato.` + `<dl>` (`Elección:` load-bearing por fila, `Fecha del aporte:`, `Monto:` verbatim, `Tipo de aporte:`) + `Consultado por nombre del candidato, corte al {fecha}.` + `ProvenanceBadge`. Paginacion `?financiamientoPage=N` ancla `#financiamiento`, `PAGE_SIZE=20`, `min-h-[44px]`.
  - `FinanciamientoSection` (Server Component): `if (!moneyPublicEnabled(process.env)) return null;` ANTES de Supabase; `sb.rpc("aportes_de_parlamentario", {p_id})` con THROW en `rpcError`; marcador `aportes_ingesta_estado` via `.maybeSingle()`; deriva el estado; pagina server-driven; pasa a la View.

### Task 2 — mount en page.tsx + tests RTL (commit `1cecb32`)
- **`app/app/parlamentario/[id]/page.tsx`**: import `FinanciamientoSection`; nuevo `<section id="financiamiento" className="mt-12">` SIBLING inmediatamente despues de `#dinero`, con `<h2>Aportes de campaña registrados en SERVEL</h2>` + `<Suspense fallback={<FinanciamientoSkeleton/>}>` + `<FinanciamientoSection/>`, TODO dentro de `{moneyPublicEnabled(process.env) && ( … )}`. `FinanciamientoSkeleton` definido junto a `ContratosSkeleton`, shape-matched a la View.
- **`app/components/financiamiento-de-parlamentario.test.tsx`**: 20 tests RTL.

## Deviations from Plan

None - plan executed exactly as written. Decisiones de discrecion explicita documentadas:
- `eleccionActual=null` por defecto: el plan instruye "renderizar el caveat de forma conservadora … documentar la heuristica en comentario". El RPC/marcador no emiten el periodo del mandato vigente, asi que la View NO etiqueta de mas; cuando una fuente futura lo provea, `eleccionActual` se puebla y el caveat se activa por grupo. El `Elección:` por fila (defense in depth) sigue impidiendo la mis-atribucion. El test `eleccionActual: "Elección 2021"` ejercita la rama del caveat activo.

## Verification

- `pnpm test financiamiento` → **20/20 verde**.
- `pnpm exec tsc --noEmit` → sin errores en `financiamiento-de-parlamentario.tsx`, `financiamiento-de-parlamentario.test.tsx`, `types.ts`, `page.tsx`.
- Tests cubren:
  - **Gate-off**: `queryByText("Aportes de campaña registrados en SERVEL") === null` con `MONEY_PUBLIC_ENABLED` undefined y `"false"`; presente con `"true"` (+ `#financiamiento` ausente/presente en el DOM).
  - **3 estados textualmente distintos**: no_ingestado / verificado_sin_aportes (con fecha de corte) / enlazado, cada uno asierta la ausencia de los otros dos; un vacio nunca lee "limpio"/"✓".
  - **A1 honestidad del enlace**: la frase EXACTA `Asociado por nombre confirmado al candidato.` esta presente; `por RUT` esta AUSENTE de toda la copy (intro/asociacion/corte/empty-B). Intro "por su nombre".
  - **Donante-sujeto**: `Aporta: {nombre}` + `(persona natural/jurídica)`; sin posesivo; **RUT del donante nunca renderizado** (regex de RUT chileno ausente + "RUT" ausente).
  - **Agrupacion por eleccion**: header de grupo mono + `Elección:` por fila; caveat amber para candidatura anterior (con clase `amber`), ausente para el periodo actual y cuando `eleccionActual` es null.
  - **Provenance + cero computo**: `ProvenanceBadge` SERVEL por fila con `fuente oficial ↗`; monto verbatim, "No publicado" si null (nunca cero/fabricado); sin total/suma/ranking/%.
- Atribucion = "términos de uso por verificar" (NO CC BY 4.0); `AtribucionCcBy` NO usado.
- `mt-12` carril boundary presente; `#financiamiento` SIBLING de `#dinero`.

## Out-of-scope (deferred)

- `app/lib/buscar.test.ts:156` tiene 2 errores tsc pre-existentes (`TS2532`/`TS2493`) NO causados por este plan (archivo no tocado). No corregidos (fuera de scope, Rule SCOPE BOUNDARY).

## Threat coverage (del threat_model del plan)

- **T-15-12** (exposicion prematura): doble candado — gate en page.tsx (heading ausente OFF, test) + re-check en Section + RLS del Plan 01.
- **T-15-13** (RUT donante): `AporteRpcRow` sin RUT; la View no lo renderiza; test de ausencia de RUT.
- **T-15-14** (vacio leido como "limpio"): 3 estados distintos; test prohibe "limpio"/"✓".
- **T-15-15** (aporte previo atribuido al actual): agrupacion por eleccion + `Elección:` por fila + caveat amber; RPC ordena DESC.
- **T-15-16** (atribucion personal fusionada): donante sujeto + linea separada; test sin posesivo.
- **T-15-16b** (base de enlace falsa "por RUT"): copy "por nombre confirmado"; test asierta ausencia de "por RUT".
- **T-15-17** (env crudo): siempre via `moneyPublicEnabled()`.
- **T-15-18** (error degradado a vacio): THROW en `rpcError`/`estadoError`.

## Known Stubs

None. La seccion esta completamente cableada al RPC + marcador del Plan 01; el unico valor por defecto (`eleccionActual=null`) es una heuristica conservadora documentada, no un stub que bloquee el objetivo.

## Self-Check: PASSED

- FOUND: app/components/financiamiento-de-parlamentario.tsx
- FOUND: app/components/financiamiento-de-parlamentario.test.tsx
- FOUND: .planning/phases/15-…/15-03-SUMMARY.md
- FOUND commit: f1d7979 (Task 1)
- FOUND commit: 1cecb32 (Task 2)
