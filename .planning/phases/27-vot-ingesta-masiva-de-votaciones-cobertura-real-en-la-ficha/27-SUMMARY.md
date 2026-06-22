---
phase: 27-vot-ingesta-masiva-de-votaciones-cobertura-real-en-la-ficha
plan: 01
subsystem: votos
tags: [votos, votaciones, opendata, camara, dipid, masivo, cobertura, source-limited]

# Dependency graph
requires:
  - phase: 23
    provides: "RPC 0028 votos_instructivos aplicado al remoto"
  - phase: 8/10/22
    provides: "@obs/votos + runCamaraVotos + cruce DIPID determinista validados"
provides:
  - "run-votos-masivo-cli: runner de operador reutilizable (--dry-run/--limit/--boletines-file)"
  - "ingesta idempotente de TODOS los boletines descubribles (74 trackeados) → todas las votaciones disponibles escritas"
  - "hallazgo de fuente: opendata.camara.cl NO expone enumeración bulk de votaciones; leg 58 joven → cobertura acotada por la fuente"
affects: [Phase 32 (verificación prod)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cruce DIPID→id_diputado_camara determinista: a diferencia de lobby/probidad NO hay issue de nombre (el id resuelve sin normalización)"
    - "opendata.camara.cl: votaciones SOLO por boletín (getVotaciones_Boletin); sin enumeración por legislatura/sesión/año (retornarVotacionesX*→500; getSesionDetalle trae fechas, no boletines)"

key-files:
  created:
    - packages/votos/src/run-votos-masivo-cli.ts
    - .planning/phases/27-vot-ingesta-masiva-de-votaciones-cobertura-real-en-la-ficha/27-CONTEXT.md
    - .planning/phases/27-vot-ingesta-masiva-de-votaciones-cobertura-real-en-la-ficha/27-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Cobertura SOURCE-LIMITED, no code-limited: el WS de la Cámara no enumera votaciones en bulk y la legislatura 58 (periodo 2026-2030) arrancó 2026-03 → solo 2 de los 74 boletines trackeados están votados (10 votaciones). El runner ingiere todo lo descubrible; el techo lo pone la fuente"
  - "Boletines explícitos vía --boletines-file desde los 74 proyectos trackeados (descubrirBoletines→0)"
  - "Cruce DIPID determinista → sin el issue de nombre de lobby/probidad"
  - "DEFERRED: enumeración de votaciones a escala requiere otra fuente (portal HTML de votaciones / BCN) — spike futuro; bug del writer tramitacion_evento (dedup intra-lote) afecta 2 boletines a nivel de eventos (no votos)"

# Metrics
metrics:
  duration: ~35min
  completed: 2026-06-22
---

# Phase 27 Plan 01: VOT — Ingesta masiva de votaciones Summary

Se construyó y ejerció el runner de ingesta masiva de votaciones; el resultado revela que la
cobertura está acotada por la FUENTE (no por el código): la Cámara no expone enumeración bulk de
votaciones y la legislatura vigente es joven.

## What was built / run

- **`run-votos-masivo-cli.ts`** — runner de operador reutilizable: `--dry-run`, `--limit N`,
  `--boletines-file <ruta>` (un boletín por línea). Writer Supabase prod (SUPABASE_API_URL +
  SECRET_KEY) o in-memory. Reusa `runCamaraVotos` (cruce DIPID determinista, idempotente).
- **Corrida LIVE** sobre los 74 boletines trackeados (extraídos de `proyecto`): upsert idempotente.

## Hallazgo de fuente (el núcleo de esta fase)

- `wscamaradiputados.asmx` expone votaciones SOLO por boletín (`getVotaciones_Boletin`) +
  `getVotacion_Detalle`. NO hay enumeración por legislatura/año/sesión (`retornarVotacionesX*`→500;
  `getSesionDetalle` trae FECHAS de sesión, no boletines; `descubrirBoletines(58)`→0).
- Legislatura 58 (periodo 2026-2030) arrancó **2026-03** → joven: solo **2 de los 74** boletines
  trackeados están votados → **10 votaciones / 1.389 votos** (1.154 confirmados por DIPID).
- **Cobertura tras la corrida: 10 votaciones / 2 boletines** (sin cambio — ya era el máximo
  descubrible). NO es una falla de código: el runner ingiere todo lo disponible.

## Verification

- `pnpm --filter @obs/votos typecheck` → limpio.
- Remoto: votacion=10, voto=1.389 (1.154 confirmados), boletines=2 (consistente, sin regresión).
- Errores de corrida: 2 (bug pre-existente del writer `tramitacion_evento` "ON CONFLICT cannot
  affect row a second time" — dedup intra-lote; afecta EVENTOS de tramitación de 2 boletines, NO
  votos). Deferred.

## Deviations from Plan

- **El goal asumía votaciones abundantes para ingerir; la realidad es source-limited.** El
  mecanismo (runner masivo) queda entregado y reutilizable; cuando haya más proyectos trackeados o
  una fuente de enumeración, escala sin cambios. La cobertura real de votaciones de la legislatura
  joven es de 10 votaciones a esta fecha.

## Hand-off

- Para escalar de verdad: spike de una fuente de enumeración de votaciones (portal HTML de la Cámara
  o BCN) que liste los boletines votados de la legislatura → pasarlos por `--boletines-file`.
- Fix del bug `tramitacion_evento` (dedup intra-lote en el writer de @obs/tramitacion).

## Self-Check: PASSED (con cobertura source-limited documentada)
