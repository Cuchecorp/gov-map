---
phase: 52-cruce2-cruces-nuevos
plan: 04
subsystem: frontend
tags: [home, actualidad, SC4, force-dynamic, anti-insinuacion]
requires:
  - "estado-actual-block.urgenciaVigente (F51)"
  - "app/lib/format: conteoVotacion, fechaCorta"
  - "createServerSupabase (service_role, server-only)"
provides:
  - "ActualidadModule (RSC) + VotadoEstaSemana + UrgenciasVigentes + UltimaActualizacion"
  - "home / con módulo de actualidad de 3 bloques bajo el hero + force-dynamic"
affects:
  - "app/app/page.tsx (home)"
tech-stack:
  added: []
  patterns:
    - "vistas puras (*View) testeables + Server Components delgados que leen .from() no-PII"
    - "empty-state honesto independiente por bloque; error real → throw #34 (nunca ?? [])"
    - "force-dynamic en el home (gotcha F50) cuando muestra datos vivos"
key-files:
  created:
    - "app/components/actualidad-module.tsx"
    - "app/components/actualidad-module.test.tsx"
  modified:
    - "app/app/page.tsx"
    - "app/app/page.test.tsx"
decisions:
  - "Semana ISO (lunes 00:00) para 'Votado esta semana', no ventana rodante — el ciudadano lee 'esta semana' como semana natural"
  - "Bloque 3 frescura = una línea por TABLA no-PII con etiqueta legible (Votaciones/Proyectos de ley/Tramitación/Citaciones/Lobby/Fichas de proyecto); transparencia de frescura, NO ranking de actividad"
  - "Traza nunca perdida: bloque 1 usa enlace externo seguro y cae a la ficha interna si falta; bloque 2 enlaza a /proyecto/{boletin}"
  - "page.test.tsx stubbea ActualidadModule a null para aislar el héroe editorial (el módulo tiene su propia suite)"
metrics:
  duration: ~9min
  tasks: 2
  files: 4
  completed: 2026-07-06
---

# Phase 52 Plan 04: Módulo de actualidad del home (SC4) Summary

Módulo de actualidad de 3 bloques server-rendered bajo el hero del home (`/`) —"Votado esta semana", "Urgencias vigentes", "Última actualización de datos"— con lecturas 100% no-PII, empty-states honestos independientes y `force-dynamic` (gotcha F50); el hero queda LOCKED e intacto.

## What Was Built

- **`ActualidadModule` (RSC)** — compone 3 sub-bloques bajo `grid gap-6 md:grid-cols-3` (apilado en móvil), cada uno un panel `--card` (`rounded-lg border bg-card p-6`) y cada uno bajo su propio `<Suspense>` (streaming independiente, skeleton acotado). Sin intro editorial: los 3 headings h2 se sostienen solos. NUNCA `"use client"`.
- **Bloque 1 "Votado esta semana"** — `.from("votacion")` acotado (`.gte(fecha, inicioSemanaIso())`, `.order(fecha desc)`, `.limit(6)`) + lookup de títulos a `proyecto`. Por item: título (o boletín Mono si falta) + desenlace factual "El proyecto fue {resultado} {si}–{no}." (tally Mono en-dash vía `conteoVotacion`) + "Votación del {fecha}" (Mono) + "Ver fuente oficial ↗". `resultado` null → omite la frase, conserva el hecho fechado.
- **Bloque 2 "Urgencias vigentes"** — `.from("tramitacion_evento")` acotado (`.ilike(descripcion, %urgencia%)`, `.limit(120)`), agrupa por boletín y **reusa `urgenciaVigente`** (F51, import — no reimplementa) para derivar la urgencia vigente por boletín. Item: "{título} — urgencia {tipo} vigente desde el {fecha}." + boletín Mono + link a `/proyecto/{boletin}`.
- **Bloque 3 "Última actualización de datos"** — `max(fecha_captura)` por tabla NO-PII (`votacion`/`proyecto`/`tramitacion_evento`/`citacion`/`lobby_audiencia`/`proyecto_ficha`), una línea "{fuente}: actualizada el {fecha}." por fuente. Transparencia de frescura, NO ranking.
- **Home** — `export const dynamic = "force-dynamic"` (gotcha F50, espejo de `/red`) + `<ActualidadModule/>` montado bajo el `<section>` del hero dentro de `<main>`. Hero (EXAMPLE_CHIPS + h1 + trust line + onboarding) byte-idéntico.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ActualidadModule + 3 sub-bloques (TDD) | `4cf32eb` | actualidad-module.tsx (+test) |
| 2 | Montar en home + force-dynamic | `6dd8dc4` | app/page.tsx (+test), actualidad-module.tsx (fix tsc) |

## Threat Model Compliance

- **T-52-12 (Information Disclosure)** — bloque 3 lee `fecha_captura` SOLO de tablas no-PII; source-scan test asierta cero `.from()` sobre aporte/contrato/declaracion*/donante/cruce_senal/parlamentario. Lockdown-guard verde.
- **T-52-13 (Repudiation / integridad narrativa)** — counts neutros Mono; negative-match banned-vocab sobre el copy poblado de los 3 bloques (sin ranking/score/"quién ganó"/porcentaje-veredicto).
- **T-52-14 (DoS / F50)** — `force-dynamic` aplicado; todas las lecturas con `.limit()` acotado.
- **T-52-15 (Availability / integridad)** — error real de lectura → `throw` #34 (≥4 throws en el módulo); empty-state honesto SOLO en 0 filas legítimo.

## Verification

- `pnpm --dir app test -- --run actualidad-module` — **18 tests verdes** (vistas puras, desenlace null, empties independientes, negative-match, source-scan PII-exclusion + reuse de urgenciaVigente).
- `pnpm --dir app test -- --run lockdown-guard app/page` — verde (guard B sin `.from()` PII; héroe editorial intacto).
- Suite app/ completa: **535/535 verde** (18 nuevos).
- `pnpm --dir app exec tsc -b` — limpio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Anotación de tipo en el `.map()` del bloque 1**
- **Found during:** Task 2 (`tsc -b`).
- **Issue:** `.map(...).filter((x): x is VotadoItem => ...)` fallaba: el objeto mapeado infería `enlace: string` (de `VotacionRow`), incompatible con el predicado a `VotadoItem` (`enlace: string | null`).
- **Fix:** anotar el callback como `.map((v): VotadoItem | null => ...)` y quitar `satisfies`. Cero cambio de comportamiento.
- **Files modified:** app/components/actualidad-module.tsx
- **Commit:** `6dd8dc4`

**2. [Rule 3 - Blocking] Stub de ActualidadModule en el test del héroe**
- **Found during:** Task 2 (`--run app/page`).
- **Issue:** `page.test.tsx` renderiza `<Home/>` síncrono; el `ActualidadModule` (Server Component con hijos async que leen Supabase) desestabilizaba el render del héroe (input controlado perdía valor tras `fireEvent.click`).
- **Fix:** `vi.mock("@/components/actualidad-module", () => ({ ActualidadModule: () => null }))` — aísla el héroe editorial (propósito declarado del test); el módulo se cubre en su propia suite.
- **Files modified:** app/app/page.test.tsx
- **Commit:** `6dd8dc4`

## Known Stubs

None. Los 3 bloques leen datos reales; los empty-states son degradación honesta de 0 filas, no stubs.

## Self-Check: PASSED

- Created files exist: actualidad-module.tsx, actualidad-module.test.tsx, 52-04-SUMMARY.md — all FOUND.
- page.tsx modified (import + force-dynamic + mount) — FOUND.
- Commits `4cf32eb`, `6dd8dc4` — both FOUND in git log.
- No unexpected deletions (git diff --diff-filter=D HEAD~2 HEAD empty).
