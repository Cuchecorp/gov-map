---
phase: 100-panel-p1c-landing-panel
plan: 02
subsystem: frontend
tags: [rsc, bento, panel-actualidad, honesty-contract, supresion, anti-ranking, rtl]

# Dependency graph
requires:
  - phase: 100-01
    provides: SUPERFICIES_PANEL + bento cero-hex/tipografia declarando panel-actualidad.tsx (guards muerden ahora)
  - phase: 99-02
    provides: RPC actualidad_senales_panel (0066) precomputada, en PUBLIC_RPC_ALLOWLIST
provides:
  - "components/panel-actualidad.tsx — RSC PanelActualidad() + vista pura TileSenal testeable con fixtures SenalRow[]"
  - "Lectura de la RPC bounded (cero agregacion on-read); throw en error real; supresion_causa verbatim"
  - "Helpers exportados rotuloFecha (agenda date-only-midnight-UTC vs timestamp real) + fuenteLabel"
affects: [100-03, page.tsx, panel-mount, Wave-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Near-clone del germen actualidad-module.tsx: split async RSC + vista pura *View testeable sin DB"
    - "rotuloFecha por tipo: agenda_* via diaCalendarioCitacion (sin tz shift), resto via fechaCorta"
    - "fuenteLabel derivada de tipo_senal/cobertura (la RPC no re-emite origen/dataset)"

key-files:
  created:
    - app/components/panel-actualidad.tsx
    - app/components/panel-actualidad.test.tsx
  modified: []

key-decisions:
  - "fuenteLabel DERIVA la fuente de tipo_senal/cobertura (RPC 0066 no re-emite origen/dataset) en vez de extender la RPC (fuera de alcance, preferir derivar — 100-PATTERNS L76)"
  - "agenda_citacion + agenda_sala comparten titulo 'Agenda proxima' pero rotulo de fecha por-fila via el tipo_senal real (contrato date-only-midnight-UTC solo aplica a agenda)"
  - "NEGACIONES_LOCKED sin cambios: el copy del panel es framing positivo-factual, no NIEGA ningun termino prohibido (recordatorio 100-01 no gatillado)"

patterns-established:
  - "Panel de senales precomputadas: agrupar por tipo_senal preservando orden RPC, un BentoTile por grupo, cero reordenar por conteo cross-camara (T-52-13)"

requirements-completed: [PANEL-02]

# Metrics
duration: ~20min
completed: 2026-07-24
---

# Phase 100 Plan 02: panel-actualidad.tsx (Wave 2) Summary

**Componente RSC PanelActualidad que lee las señales precomputadas de la RPC bounded `actualidad_senales_panel` (cero agregación on-read), las agrupa por `tipo_senal` y renderiza cada grupo como un BentoTile con framing factual, cobertura declarada, fuente+fecha y supresión honesta verbatim — más su vista pura `TileSenal` cubierta por RTL con fixtures activa/suprimida/(sin materia). Los tres guards (anti-insinuación + cero-hex + tipografía) ahora muerden sobre la superficie real y quedan verdes.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-24
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `components/panel-actualidad.tsx` (287 líneas): `PanelActualidad()` async llama `sb.rpc("actualidad_senales_panel", { p_tipo: null })` vía `createServerSupabase` (service_role, Camino A, server-only), lanza (`throw new Error`) en error real — el único `?? []` es el path legítimo de 0 filas.
- Agrupa las filas por `tipo_senal` en un `Map` preservando el orden que ya impone la RPC; renderiza un `BentoTile` por grupo dentro de un fragmento (para montar bajo `<Suspense>` en Plan 03). NO reordena por conteo entre cámaras (T-52-13).
- Vista pura `TileSenal` (exportada, testeable): supresión → causa VERBATIM como cuerpo (`text-sm text-muted-foreground`), nunca lista vacía ni "0" mudo; activa → conteo `font-mono` + framing factual LOCKED + chip de cobertura + footer "Fuente: … · datos al …".
- `agrupacion_materia` con `materia='(sin materia)'` se renderiza verbatim como título de fila, sin fabricar tema.
- Barra cívica 3px derivada del literal de cobertura (`bg-[var(--camara)]`/`bg-[var(--senado)]`, v4 form), OMITIDA cuando la cámara es null (regla A).
- `rotuloFecha` codifica la distinción de contrato: `agenda_*` → `diaCalendarioCitacion` (date-only-midnight-UTC, sin tz shift); resto → `fechaCorta` (timestamp real, es-CL).
- `panel-actualidad.test.tsx`: 7 tests RTL sobre `TileSenal` con 3 fixtures (activa/suprimida/(sin materia)) — framing + fuente/fecha + supresión verbatim (strings de 0065) + tolerancia de `(sin materia)` + ausencia de vocabulario de ranking.
- Suite completa verde (1263/1263, +7), tsc limpio, guards (anti-insinuación + cero-hex + tipografía) verdes SOBRE la superficie real.

## Task Commits

Each task was committed atomically:

1. **Task 1: panel-actualidad.tsx (RSC + vistas puras)** - `8cedc56` (feat)
2. **Task 2: RTL panel-actualidad.test.tsx con fixtures** - `5b73edb` (test)

## Files Created/Modified

- `app/components/panel-actualidad.tsx` (created) - RSC `PanelActualidad()` + vista pura `TileSenal` + helpers `rotuloFecha`/`fuenteLabel` + `interface SenalRow` (9 columnas de 0066). Copy LOCKED de títulos/framing del UI-SPEC.
- `app/components/panel-actualidad.test.tsx` (created) - 3 fixtures `SenalRow[]` (activa/suprimida/(sin materia)); asevera el contrato de honestidad del render.

## Decisions Made

- **fuenteLabel deriva la fuente** de `tipo_senal`/`cobertura_camara` en lugar de extender la RPC 0066 para re-emitir `origen`/`dataset` (fuera de alcance; 100-PATTERNS L76 recomienda derivar). La cobertura declara cámara como PROVENIENCIA, nunca como "más activa".
- **agenda_citacion + agenda_sala comparten título** `Agenda próxima` (ambos mapean a "Agenda próxima" en `TITULO`), pero el rótulo de fecha se calcula por-fila con el `tipo_senal` real → el contrato date-only-midnight-UTC (`diaCalendarioCitacion`) solo se aplica a las señales de agenda, y `fechaCorta` a las de timestamp real.
- **NEGACIONES_LOCKED sin cambios:** el copy del panel es framing positivo-factual ("N trámites en 7 días", "N urgencias fechadas en 30 días"); no introduce ninguna leyenda que NIEGUE un término prohibido, así que el recordatorio del 100-01-SUMMARY (Pitfall 2) NO se gatilla. Verificado: los guards quedan verdes sin tocar `NEGACIONES_LOCKED`.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Los guards de Wave 0 (Plan 01) ya declaraban `panel-actualidad.tsx` en las tres superficies con tolerancia de archivo-ausente, por lo que la creación del componente los activó sin ninguna modificación adicional.

## Authentication Gates

None.

## Known Stubs

None — el componente lee la RPC real precomputada y renderiza cada señal con fuente+fecha o su supresión verbatim. No hay datos hardcodeados que fluyan a la UI. El único `?? []` es el path legítimo de 0 filas (regla D), no un stub que oculte error.

Nota de montaje: `PanelActualidad` NO se monta aún en `app/app/page.tsx` (eso es Plan 100-03, Wave 3) — su ausencia en la página es intencional y esperada por el plan.

## Threat Flags

None — no se introduce superficie de red/auth/schema nueva. El componente es RSC puro (sin "use client"; T-100-04 mitigado: service_role queda fuera del bundle vía `import "server-only"` en supabase.ts) y solo llama la RPC no-PII `actualidad_senales_panel` ya allowlisted (T-100-05/06 mitigados/aceptados). Error real → throw (T-100-07 mitigado); framing factual + supresión verbatim + '(sin materia)' tolerado, asertado por RTL (T-100-08 mitigado).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 (componente) CERRADA: `PanelActualidad` + `TileSenal` listos y cubiertos por RTL.
- Plan 100-03 (Wave 3) monta `<Suspense fallback={<BloqueSkeleton span={N}/>}><PanelActualidad /></Suspense>` en `app/app/page.tsx`, reemplazando el BODY de los 3 tiles germen (hero + accent + entry tiles LOCKED; `force-dynamic` LOAD-BEARING intacto).
- Plan 100-04: benchmark BrowserOS + cold-read gate sobre el deploy real (candados verificados por `getComputedStyle`).

## Self-Check: PASSED

- FOUND: `.planning/phases/100-panel-p1c-landing-panel/100-02-SUMMARY.md`
- FOUND: `app/components/panel-actualidad.tsx`
- FOUND: `app/components/panel-actualidad.test.tsx`
- FOUND commit: `8cedc56` (Task 1)
- FOUND commit: `5b73edb` (Task 2)

---
*Phase: 100-panel-p1c-landing-panel*
*Completed: 2026-07-24*
