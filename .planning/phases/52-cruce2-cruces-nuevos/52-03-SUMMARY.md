---
phase: 52-cruce2-cruces-nuevos
plan: 03
subsystem: frontend-ficha-proyecto
tags: [SC2, SC3, lobby-tramitacion, citacion, degrade-honesto, anti-insinuacion, RSC, RTL]
requires:
  - "RPC lobby_en_tramitacion(p_boletin) — contrato LOCKED por 52-02 (0048, no aplicada a PROD hasta 52-06)"
  - "citacion / citacion_punto (0010, public-read, no-PII)"
  - "EstadoActualBlock F51 (¿Dónde está hoy?)"
provides:
  - "LobbyEnTramitacionSection (RSC) + LobbyEnTramitacionView (pura) — carril SC2"
  - "citacionVigente() derivación pura + EstadoActual.citacionVigente — línea SC3"
  - "<section id='lobby-tramitacion' className='mt-12'> montado en la ficha de proyecto"
affects:
  - "app/app/proyecto/[boletin]/page.tsx (nuevo carril hermano)"
tech-stack:
  added: []
  patterns:
    - "Degrade honesto de 3 caminos sobre RPC ausente (PGRST202/function-missing→null, 0 filas→empty honesto, error real→throw #34) sin blanket-catch"
    - "h2 DENTRO del componente (no en la page) para que el degrade path-1 no deje heading huérfano — espejo de EstadoActualView que emite su propia <section>"
    - "omit-when-not-derivable para la línea de citación (espejo de urgenciaVigente)"
key-files:
  created:
    - app/components/lobby-en-tramitacion.tsx
    - app/components/lobby-en-tramitacion.test.tsx
  modified:
    - app/components/estado-actual-block.tsx
    - app/components/estado-actual-block.test.tsx
    - app/app/proyecto/[boletin]/page.tsx
decisions:
  - "El h2 del carril lobby vive DENTRO de LobbyEnTramitacionView, no en page.tsx: así el degrade honesto path-1 (Section→null) no deja un heading sin banda. El wrapper <section mt-12> en la page permanece (frontier rule: mt-12 nunca se colapsa aunque esté degradado), pero sin heading/band visible cuando la RPC no está aplicada."
  - "SC3 citacionVigente() compara contra el INICIO del día de hoy (setHours(0,0,0,0)), no contra la hora exacta: una citación de HOY sigue vigente hasta el fin del día, no expira a la medianoche del propio día."
  - "El embed to-one citacion:citacion(...) se normaliza a objeto|array|null en el Server Component (Supabase tipa el embed según el shape de la relación); flatMap defensivo evita romper si llega array."
metrics:
  duration_min: 9
  tasks: 3
  files: 5
  tests_added: 22
  suite_after: 519
  completed: 2026-07-06
---

# Phase 52 Plan 03: Carril lobby×tramitación (SC2) + línea de citación (SC3) Summary

Dos superficies nuevas en la ficha de proyecto `/proyecto/[boletin]`, ambas yuxtaposición de hechos fechados con fuente y cero causal: un carril `mt-12` "Reuniones de lobby registradas en el mismo período" que consume la RPC `lobby_en_tramitacion` con degrade honesto de 3 caminos pre-apply, y una línea derivable "Citado en {comisión} el {fecha}." dentro del bloque F51 "¿Dónde está hoy?" con omit-when-not-derivable.

## What Was Built

### Task 1 — LobbyEnTramitacionSection + View (SC2, degrade honesto) — `a036059`
- `LobbyEnTramitacionView` (pura, RTL-testeable) + `LobbyEnTramitacionSection` (RSC), sin `"use client"`.
- Content-gate header 9 puntos adaptado (carril aislado, coincidencia-no-causa, conteo neutro, identidad confirmada plain-text, provenance por fila, vacío = hecho).
- Vista: caveat anti-causal 1×/sección sobre banda `--muted`; summary de conteo NEUTRO con `{N}` en Mono (una línea si una sola semana; una línea por semana `"Semana {semanaISO} · comisión {comisión}: {N} reuniones."` si varias); fila por audiencia con `{nombre} — {materia}` (nombre h3-weight TEXTO PLANO, no enlazado), meta Mono `"Reunión registrada el {fecha} · semana {semanaISO}"`, y link "Ver fuente oficial ↗" (min-h-11, petróleo) a `enlace_detalle`; empty honesto (0 filas).
- **Degrade honesto (LOAD-BEARING):** `if (error?.code === 'PGRST202' || /does not exist|schema cache/i.test(error?.message ?? '')) return null;` (path 1) · `if (error) throw` (path 3, #34) · con data → View (path 2, incl. empty). Sin blanket-catch.
- 12 tests RTL (agrupación por semana, empty, banned-vocab + RUT negative-match, nombre no enlazado, invariantes de fuente).

### Task 2 — Línea de citación SC3 en EstadoActualBlock — `67a7733`
- `EstadoActual` +`citacionVigente?: { comision: string; fecha: Date }`.
- `citacionVigente(citaciones, hoy)` puro y exportado: descarta sin-comisión/sin-fecha-válida, filtra `fecha >= inicio del día de hoy`, devuelve la de MENOR fecha (más próxima) o null.
- `derivarEstadoActual` extendido con `citaciones`/`hoy` opcionales — firma previa (2 args) intacta.
- `EstadoActualBlock`: tercera query no-PII `citacion_punto × citacion(comision, fecha, semana_iso)` en el `Promise.all`; error real → throw #34; embed aplanado a `{ comision, fecha }`.
- `EstadoActualView` renderiza `"Citado en {comisión} el {fecha}."` con fecha Mono; omite la línea si `citacionVigente` ausente.
- 10 tests nuevos (derivación pura, más-próxima, omit, view render/omisión).

### Task 3 — Wiring del carril en la page — `1c45256`
- Import + `<section id="lobby-tramitacion" className="mt-12">` hermano tras `#votaciones` (antes de `#idea-matriz`), con `<Suspense fallback={<LobbyTramitacionSkeleton/>}>`.
- **h2 movido DENTRO del componente** para honrar el degrade path-1: cuando la Section retorna null, no queda heading huérfano; el wrapper `mt-12` preserva la frontera aunque el contenido esté ausente (frontier rule).
- `EstadoActualBlock` intacto (la línea SC3 vive dentro del block). Sin `force-dynamic` (la page ya es dinámica por segmento `[boletin]`).

## Verification

- `pnpm --dir app test -- --run` → **519 passed / 48 files** (baseline 497 + 22 nuevos).
- `pnpm --dir app exec tsc -b` → **limpio** (exit 0).
- `lockdown-guard` → **8/8**: `citacion_punto`/`citacion` son no-PII (public-read 0010), `lobby_en_tramitacion` ya allowlisted (52-02). Cero `.from()` PII nuevo, cero RPC no-allowlisted.
- Negative-match banned-vocab (§6) verde sobre el copy nuevo (carril lobby + línea citación).

## Deviations from Plan

### Auto-fixed / clarified

**1. [Rule 3 - Blocking clarification] h2 del carril lobby dentro del componente, no en la page**
- **Found during:** Task 3.
- **Issue:** El plan permitía el h2 "en el propio componente O en la section". Ponerlo en la page rompía el degrade honesto path-1: con la RPC ausente (Section→null) quedaría un `<h2>Reuniones de lobby…</h2>` huérfano sin banda — exactamente la "banda vacía fabricada" que la §Degrade honesto prohíbe ("No heading, no band, no 500").
- **Fix:** El h2 se emite dentro de `LobbyEnTramitacionView` (empty y populated). La page conserva `<section id="lobby-tramitacion" className="mt-12">` (satisface el must_have `contains: "lobby-tramitacion"` y la frontier rule: el gap mt-12 nunca se colapsa aunque esté degradado), pero sin heading/band cuando la RPC no está aplicada. Espejo del patrón F51 `EstadoActualView` (que emite su propia `<section>` y retorna null sin dejar nodo).
- **Files:** app/components/lobby-en-tramitacion.tsx, app/app/proyecto/[boletin]/page.tsx.
- **Commits:** a036059 (heading en View añadido en Task 3 edit) / 1c45256.

No hubo bugs ni funcionalidad crítica faltante más allá de esta clarificación de contrato.

## Anti-insinuación / Threat coverage

- **T-52-08 (insinuación causal)** mitigado: caveat obligatorio 1×/sección; carril mt-12 propio nunca compuesto con voto; nombre plain-text no enlazado; negative-match banned-vocab + RUT en RTL.
- **T-52-09 (RPC ausente pre-apply)** mitigado: degrade honesto de 3 caminos, sin blanket-catch; verificado por tests de invariantes de fuente (PGRST202 + function-missing + throw presentes en el código).
- **T-52-10 (PII directa)** aceptado: `citacion`/`citacion_punto` no-PII; el carril lobby lee vía RPC allowlisted. lockdown-guard 8/8.
- **T-52-11 (boletín no confiable)** mitigado: `BOLETIN_RE.test` ya gatea la page; `p_boletin` va parametrizado a la RPC.

## Known Stubs

Ninguno. El carril degrada honesto pre-apply por diseño (RPC 0048 se aplica en 52-06, checkpoint operador); NO es un stub sino el comportamiento contractual del degrade honesto. Post-apply el carril renderiza en vivo sin cambios de código.

## Notes for the next plan

- **Deuda operador (52-06):** aplicar `0047` + `0048` por `psql --db-url --single-transaction` (PGCLIENTENCODING=UTF8 en Windows) + pgTAP contra el schema aplicado + deploy CF. Hasta entonces el carril lobby retorna null (nodo ausente) en PROD — sin 500.
- El supuesto A1 de la RPC (`at time zone 'America/Santiago'` para la coincidencia de semana ISO) sólo se puede confirmar contra un par real `(fecha, semana_iso)` en PROD (52-06).

## Self-Check: PASSED

- Archivos creados/modificados: 5/5 FOUND.
- Commits: a036059, 67a7733, 1c45256 — 3/3 FOUND.
