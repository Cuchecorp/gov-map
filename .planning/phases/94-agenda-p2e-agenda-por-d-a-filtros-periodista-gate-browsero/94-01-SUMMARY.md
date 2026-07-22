---
phase: 94
plan: 01
subsystem: agenda
tags: [agenda, tz-chile, cobertura-declarada, citacion-estado, cit-03, cit-05]
requires:
  - "estado-actual-block.tsx: idiom DIA_CALENDARIO_CHILE (reutilizado)"
  - "93-AUDITORIA-CITACIONES.md §7/§8: insumo del banner"
provides:
  - "AgendaCobertura: banner de cobertura declarada (Server Component puro)"
  - "CitacionCard.estado: marca de cancelación sobria (backward-compatible)"
  - "CitacionCard badge en tz America/Santiago"
  - "/agenda agrupada por día-calendario-Chile (dayKey/diaFmt/dayLabel)"
affects:
  - "app/app/agenda/page.tsx"
  - "app/components/citacion-card.tsx"
  - "app/components/agenda-cobertura.tsx"
tech-stack:
  added: []
  patterns:
    - "count exacto sin cap 1k: select('*', { count:'exact', head:true })"
    - "min/max de fecha via .order(...).limit(1) (sin traer filas)"
    - "banner en <Suspense> con frontera de error honesta (#34)"
key-files:
  created:
    - "app/components/agenda-cobertura.tsx"
    - "app/components/agenda-cobertura.test.tsx"
  modified:
    - "app/app/agenda/page.tsx"
    - "app/components/citacion-card.tsx"
    - "app/components/citacion-card.test.tsx"
decisions:
  - "El banner deriva SOLO la celda comisiones×Cámara (N/S/rango); las 3 celdas restantes son texto estructural fijo LOCKED (límite de fuente, no derivable)"
  - "Semanas ISO se DERIVAN del rango min→max (no count(distinct) exacto) — declarado como rango, cero cap 1k"
  - "dayLabel se rotula desde la Date representativa del grupo, NUNCA desde `${dayKey}T00:00:00Z` (que re-inyecta UTC)"
metrics:
  duration: "~15 min"
  completed: 2026-07-22
  tasks: 2
  files: 5
---

# Phase 94 Plan 01: /agenda por día tz Chile + banner de cobertura declarada Summary

Corrige el bug núcleo de la fase (agrupación de /agenda por día UTC → America/Santiago), monta el banner de cobertura DECLARADA (Cámara comisiones derivada dinámicamente + 3 celdas estructurales LOCKED + leyenda "estado ausente ≠ vigente"), y hace visible el estado de cancelación honesto (Suspendida/Sin efecto sobrio) en la card. CIT-03 + CIT-05.

## What Was Built

**Task 1 — Banner + estado en CitacionCard (TDD, commit 35d1e7b):**
- `agenda-cobertura.tsx`: Server Component PURO de presentación. Recibe `CoberturaCamaraMetrica` por props (NO consulta Supabase). Banda sobria `rounded-lg border border-border bg-muted/40`, heading h2 "Cobertura de la agenda", intro LOCKED, `<ul>` de 4 celdas (Cámara comisiones interpola N/S/rango en `font-mono`; 3 estructurales fijas verbatim), leyenda de estado LOCKED. Tono neutro: cero `--destructive`/ámbar/rojo.
- `citacion-card.tsx`: **BLOCKER resuelto** — `horaFmt` pasa de `timeZone:"UTC"` a `"America/Santiago"` (el badge de fecha era el bug 21:00-CL en persona). Nueva prop `estado?: string|null` (opcional, backward-compatible) → marca sobria `· {estado}` en `text-muted-foreground` cuando existe; NADA cuando ausente (nunca "Vigente"/"Confirmada").
- Tests RTL: banner (intro/celdas derivadas mono/estructurales verbatim/leyenda/tono sobrio) + card (badge 00:00Z → día 21 Chile, Suspendida/Sin efecto visibles, null sin marca, prop omitida backward-compatible).

**Task 2 — dayKey/diaFmt tz Chile + banner montado + estado a cada card (commit 3967536):**
- **FIX NÚCLEO:** `dayKey` deriva de `DIA_CALENDARIO_CHILE.format(new Date(c.fecha))` (día-calendario-Chile), NO de `c.fecha.slice(0,10)` (día UTC almacenado). El Map guarda `{rows, fechaRef}` para rotular en tz Chile sin re-inyectar UTC. `diaFmt` de rotulación (CitacionesSection y ResultadosBusqueda) pasa a `America/Santiago`.
- `estado={c.estado}` fluye a cada `<CitacionCard>`.
- `CoberturaBanner` (async, en `<Suspense>` bajo `<h1>` y antes de `<WeekNav>`, solo vista semanal): deriva la métrica Cámara con `count:"exact", head:true` (conteo exacto sin transportar filas) + min/max fecha vía `.order(...).limit(1)`; nº de semanas ISO derivado del rango min→max (`semanasEntre`). Frontera de error honesta (#34): un fallo real de DB se lanza, nunca banner con métricas cero fabricadas.

## Deviations from Plan

None — plan ejecutado tal como está escrito. Un ajuste menor de test (no de código): el fixture de tz esperaba `/21 jul/i` pero `es-CL month:short` emite `"21-jul"` (guion) — se corrigió el regex del test a `/21-jul/i`. La implementación (día 21 = día-Chile correcto) es la correcta.

## Verification

- Grep de sanidad: CERO `timeZone: "UTC"` en `app/app/agenda/page.tsx`; `citacion-card.tsx` usa `America/Santiago`.
- Suite completa verde: **1171/1171** (91 test files). Incluye agenda-cobertura (6) + citacion-card (15, con badge tz + estado) + agenda/page (4, sin regresión).
- `tsc --noEmit`: **exit 0** (cero errores).
- Banner: celda Cámara derivada (mono) + 3 estructurales verbatim + leyenda "estado ausente ≠ vigente"; card estado presente → marca sobria, ausente → nada.

## NEGACIONES_LOCKED / Linter

El copy del banner ("no es un calendario completo", "no confirma que la sesión se realizará") usa "completo"/"confirma", que NO están en `TERMINOS_PROHIBIDOS` del `anti-insinuacion-guard`. La superficie `agenda-cobertura.tsx` tampoco está en los arrays escaneados por el linter. Por tanto NO se requirió registrar negaciones nuevas — el linter pasa sin cambios (verificado: suite verde incluye `anti-insinuacion-guard.test.ts`).

## Threat Flags

Ninguna superficie nueva de seguridad. La métrica del banner son conteos agregados no-PII (T-94-01 accept). La integridad temporal por día-Chile mitiga T-94-02. Cero paquete nuevo (T-94-SC).

## Self-Check: PASSED

- FOUND: app/components/agenda-cobertura.tsx
- FOUND: app/components/agenda-cobertura.test.tsx
- FOUND: commit 35d1e7b (feat 94-01 banner + estado + tz card)
- FOUND: commit 3967536 (feat 94-01 día-Chile + banner montado)
