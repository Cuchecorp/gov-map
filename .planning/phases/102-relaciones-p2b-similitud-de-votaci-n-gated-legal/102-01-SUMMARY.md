---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
plan: 01
subsystem: testing
tags: [feature-flag, ci-guard, anti-insinuacion, pgvector-none, rpc, security-definer, gated-legal, dw-nominate]

# Dependency graph
requires:
  - phase: 101-relaciones-p2a
    provides: "anti-insinuacion-guard.test.ts extensible (SUPERFICIES_RELACIONES, NEGACIONES_LOCKED, self-check), lockdown-guard PUBLIC_RPC_ALLOWLIST + Direction-B, migración 0067 (mold RPC secdef/doble-revoke), patrón Wave-0 (guards antes del copy)"
  - phase: 73-money
    provides: "money-gate.ts + money-antiflip-guard.test.ts (mold del gate fail-closed + guard anti-flip 3 vectores + mutation self-check)"
  - phase: 98-audit-votos
    provides: "cobertura de voto Cámara ~80% confirmado / Senado ~20% por nombre (cifras del caveat de cobertura)"
provides:
  - "Gate server-only VSIM_PUBLIC_ENABLED fail-closed (=== 'true'), chokepoint único vsim-gate.ts"
  - "vsim-antiflip-guard.test.ts (V1/V2/V3 + mutation self-check) que congela el gate contra flip por agente"
  - "Linter anti-insinuación extendido con idioms VSIM DEDUPE-ados + leyenda VSIM restada de NEGACIONES_LOCKED"
  - "LEYENDA_SIMILITUD_VOTO (caveat VERBATIM) exportada como contrato del linter (cuerpo presentacional = Plan 03)"
  - "co-votacion-red-guard.test.ts (test estático permanente: co_votacion ∉ código /red) + ramas muertas borradas"
  - "Migración 0068_coincidencia_votos_par.sql ESCRITA (no aplicada) + entrada en PUBLIC_RPC_ALLOWLIST (Direction-B satisfecha)"
  - ".env.example con VSIM_PUBLIC_ENABLED=false (default OFF versionado)"
affects: [102-02-apply-0068, 102-03-copy-mount-comparar, 104-e2e-flags-off]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate fail-closed espejo money: chokepoint server-only único (=== 'true'), guard anti-flip 3 vectores + mutation self-check EN MEMORIA"
    - "Test estático permanente co_votacion∉/red: walk+strip-comments (TS y SQL) para no disparar sobre documentación de la exclusión"
    - "Wave 0: gate + guards + migración escrita + allowlist ANTES del copy/montaje (lección BLOCKER 91 + 101-02)"

key-files:
  created:
    - app/lib/vsim-gate.ts
    - app/lib/vsim-gate.test.ts
    - app/lib/vsim-antiflip-guard.test.ts
    - app/components/similitud-votacion-comparar.tsx
    - app/components/co-votacion-red-guard.test.ts
    - supabase/migrations/0068_coincidencia_votos_par.sql
  modified:
    - .env.example
    - app/lib/anti-insinuacion-guard.test.ts
    - app/lib/lockdown-guard.test.ts
    - app/components/red/red-graph.tsx
    - app/components/red/arista-hecho.tsx

key-decisions:
  - "Gate VSIM byte-espejo de money-gate.ts (=== 'true'), guard V1/V2/V3 + §4 self-check; flip = acto humano anti-DW-NOMINATE (sign-off 102-LEGAL-DOSSIER-VSIM)"
  - "Idioms VSIM nuevos DEDUPE-ados: solo votan juntos/igual/parecido, aliados/aliada, tasa de coincidencia, señal (afín/afinidad/aliado/nivel de acuerdo/bloque de/vota como/votan como YA cubiertos)"
  - "LEYENDA_SIMILITUD_VOTO restada de NEGACIONES_LOCKED ANTES de que SUPERFICIES_VSIM entre al scan (Pitfall 3, evita auto-caza sobre 'señal'/'afinidad')"
  - "co_votacion Option A: borrar ramas muertas (TIPO_LABEL + case) → default cubre tipo desconocido honestamente; guard estático permanente strip-comments"
  - "0068 ESCRITA no aplicada (apply = Plan 02): 3 columnas agregadas, filtro sustantiva seleccion in (si,no,abstencion) sobre estado_vinculo=confirmado, doble-revoke CERO grant"

patterns-established:
  - "co-votacion-red-guard: detector puro tieneCoVotacionEnCodigo(src, 'ts'|'sql') con strip por lenguaje + mutation self-check bidireccional (muerde en código, calla en comentario)"

requirements-completed: [VSIM-02, VSIM-03]

# Metrics
duration: 15min
completed: 2026-07-25
---

# Phase 102 Plan 01: Wave 0 — Gate VSIM + guards + 0068 escrita Summary

**Gate fail-closed VSIM_PUBLIC_ENABLED (=== "true") + guard anti-flip 3-vectores + linter anti-insinuación extendido con idioms de co-votación + test estático permanente co_votacion∉/red + migración 0068 escrita (no aplicada) + entrada de allowlist — todo el enforcement montado ANTES del copy.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-25T02:32:04Z
- **Completed:** 2026-07-25T02:47:32Z
- **Tasks:** 3
- **Files modified:** 11 (6 creados, 5 modificados)

## Accomplishments
- Gate server-only `VSIM_PUBLIC_ENABLED` fail-closed con guard anti-flip espejo del de MONEY (V1 fail-closed / V2 .env.example=false / V3 no-raw-env, + mutation self-check §4 que muerde por cada relajación).
- Linter anti-insinuación extendido: `SUPERFICIES_VSIM` al scan, 7 idioms nuevos DEDUPE-ados, `LEYENDA_SIMILITUD_VOTO` restada de `NEGACIONES_LOCKED` (evita auto-caza), self-check muerde por idiom + no-falso-positivo sobre la leyenda montada verbatim.
- Ramas muertas `co_votacion` borradas de `/red` (TIPO_LABEL + case) + test estático permanente `co-votacion-red-guard.test.ts` (scan con strip-comments TS/SQL, no dispara sobre la documentación de la exclusión en 0030_net.sql).
- Migración `0068_coincidencia_votos_par.sql` ESCRITA (no aplicada) con las 3 columnas agregadas + doble-revoke CERO grant; `coincidencia_votos_par` en `PUBLIC_RPC_ALLOWLIST` (Direction-B ⊆ definidas satisfecha por la migración escrita).

## Task Commits

Cada tarea se committeó atómicamente:

1. **Task 1: Gate fail-closed + anti-flip guard + .env.example** — `6b73d3a` (feat)
2. **Task 2: Constante de leyenda + extensión del linter anti-insinuación** — `a2d8800` (feat)
3. **Task 3: co_votacion∉/red + 0068 escrita + allowlist** — `ea53907` (feat)

_Nota: aunque las tareas son `tdd="true"`, se ejecutaron como un solo commit por tarea (test + implementación) por ser guards/gates estáticos donde el test ES el artefacto principal y el gate su contrato — se verificó verde antes de cada commit._

## Files Created/Modified
- `app/lib/vsim-gate.ts` — chokepoint server-only `VSIM_PUBLIC_ENABLED === "true"` (fail-closed).
- `app/lib/vsim-gate.test.ts` — 5 casos (solo el literal "true" enciende).
- `app/lib/vsim-antiflip-guard.test.ts` — guard CI espejo money: V1/V2/V3 + mutation self-check (20 tests).
- `app/components/similitud-votacion-comparar.tsx` — exporta `LEYENDA_SIMILITUD_VOTO` (caveat VERBATIM; cuerpo presentacional = Plan 03).
- `app/components/co-votacion-red-guard.test.ts` — test estático permanente co_votacion∉/red (8 tests).
- `supabase/migrations/0068_coincidencia_votos_par.sql` — DDL de la RPC (ESCRITA, no aplicada en este plan).
- `.env.example` — bloque + `VSIM_PUBLIC_ENABLED=false`.
- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES_VSIM, idioms nuevos, leyenda restada, self-check + no-falso-positivo (32 tests).
- `app/lib/lockdown-guard.test.ts` — entrada `coincidencia_votos_par` en PUBLIC_RPC_ALLOWLIST.
- `app/components/red/red-graph.tsx` — borrada la rama muerta `co_votacion` de TIPO_LABEL.
- `app/components/red/arista-hecho.tsx` — borrado el `case "co_votacion"` (default cubre tipo desconocido).

## Decisions Made
- Gate y guard byte-espejo de MONEY (Phase 73), swap money→vsim; el flip queda como acto humano condicionado a `signoff: approved` en `docs/legal/102-LEGAL-DOSSIER-VSIM.md` (creado en Plan 02/03).
- DEDUPE de idioms verificado contra la lista existente (Pitfall 4): solo se añadieron los genuinamente nuevos.
- `app/comparar/page.tsx` NO se duplicó en SUPERFICIES_VSIM — ya está en SUPERFICIES_RELACIONES.
- Migración escrita (no huérfana) para satisfacer Direction-B sin aplicarla (lección 101-02); apply = Plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `*/` literal dentro de un JSDoc rompía el transform de esbuild**
- **Found during:** Task 3 (creación de co-votacion-red-guard.test.ts)
- **Issue:** El JSDoc de cabecera contenía la secuencia literal `` `/* */` `` para documentar los tipos de comentario que se strippean; el `*/` cerró prematuramente el bloque JSDoc → esbuild falló el transform ("Expected ';' but found 'co_votacion'").
- **Fix:** Reescrita la prosa del JSDoc sin la secuencia `*/` literal (se describe en palabras "comentarios de línea/bloque TS y SQL con doble-guion").
- **Files modified:** app/components/co-votacion-red-guard.test.ts
- **Verification:** `pnpm test -- --run co-votacion-red` verde (8 tests); no cambia la lógica del detector.
- **Committed in:** ea53907 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** El fix es puramente de sintaxis del comentario; la lógica del guard es idéntica a la planificada. Sin scope creep.

## Issues Encountered
- El filtro de vitest corre la suite completa (no aísla por spec), pero todos los specs objetivo se confirmaron verdes por nombre en la salida. Suite completa 1340 tests verde; `tsc -b` exit 0.

## Known Stubs
- `app/components/similitud-votacion-comparar.tsx` contiene POR AHORA solo la constante `LEYENDA_SIMILITUD_VOTO` — el cuerpo presentacional `<SimilitudVotacionComparar>` lo llena **Plan 03** (documentado en el JSDoc del archivo y en el objetivo del plan). Es un stub de contrato intencional (el linter necesita la constante en Wave 0), NO un dato falso mostrado al usuario.
- `supabase/migrations/0068_coincidencia_votos_par.sql` ESCRITA pero NO aplicada a PROD — el apply + pgTAP contra schema aplicado es **Plan 02** (aditivo, `psql --single-transaction`, NUNCA `db push`).

## Threat Flags
Ninguno. Toda la superficie nueva (gate, RPC 0068 con doble-revoke CERO grant, /red sin co_votacion) está cubierta por el `<threat_model>` del plan (T-102-01..04). La RPC 0068 emite solo 3 agregados (n_coinciden/m_compartidas/fecha_captura_max), cero rut/email/seleccion crudo.

## Self-Check: PASSED
- Archivos creados verificados en disco: vsim-gate.ts, vsim-gate.test.ts, vsim-antiflip-guard.test.ts, similitud-votacion-comparar.tsx, co-votacion-red-guard.test.ts, 0068_coincidencia_votos_par.sql — todos presentes.
- Commits verificados: 6b73d3a, a2d8800, ea53907 en git log.

## Next Phase Readiness
- **Plan 02 (apply 0068):** la migración está escrita y allowlisted; aplicar por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0068_coincidencia_votos_par.sql` + pgTAP contra schema aplicado.
- **Plan 03 (copy + montaje):** el gate `vsimPublicEnabled()`, la constante `LEYENDA_SIMILITUD_VOTO` y todos los guards ya existen; falta el cuerpo presentacional neutro + el 5º eje gated en `/comparar` + `docs/legal/102-LEGAL-DOSSIER-VSIM.md`.
- **Blocker (operador):** el flip de `VSIM_PUBLIC_ENABLED=true` requiere sign-off legal humano (anti-DW-NOMINATE); el agente NO flipea.

---
*Phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal*
*Completed: 2026-07-25*
