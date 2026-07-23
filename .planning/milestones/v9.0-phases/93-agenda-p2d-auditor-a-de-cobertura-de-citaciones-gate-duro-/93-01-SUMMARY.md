---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
plan: 01
subsystem: agenda-auditoria
tags: [auditoria, cobertura, citaciones, endpoints, frescura, gate-94]
requires: []
provides:
  - "93-AUDITORIA-CITACIONES.md §1-4 (matriz N/M, veredictos endpoints, hallazgos, frescura)"
affects:
  - "Plan 02 (wiring frontend BrowserOS) y Plan 03 (declaración cobertura + backfill acotado) consumen este reporte"
  - "Gate de Phase 94 (fix UI /agenda + ficha) — base cuantitativa"
tech-stack:
  added: []
  patterns:
    - "Medición N por psql -tA directo (sin cap 1k PostgREST)"
    - "Re-sondeo endpoints curl rate-limited ≥3s, UA identificatorio / header-set navegador para Cámara"
key-files:
  created:
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-AUDITORIA-CITACIONES.md
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-01-SUMMARY.md
  modified: []
decisions:
  - "Path Cámara comisiones corregido a /legislacion/comisiones/ (el bloque <interfaces> apuntaba a /sesiones_sala/, que 302→error404)"
  - "Header-set de navegador COMPLETO (headers-camara.ts) es obligatorio HOY para www.camara.cl (UA simple 302); refina el research 'GET simple pasa el WAF'"
  - "Endpoint alterno opendata wscamaradiputados.asmx/getComisiones_Vigentes está UP (el path WSComisiones.asmx del research sigue DOWN)"
metrics:
  duration: ~20min
  tasks: 2
  files: 2
  completed: 2026-07-22
---

# Phase 93 Plan 01: Auditoría de cobertura de citaciones — secciones medibles Summary

Reporte `93-AUDITORIA-CITACIONES.md` con la matriz N/M de las 4 celdas {sala,comisiones}×{Cámara,Senado} re-medida por psql verbatim (cero deriva vs research), los veredictos de 10 endpoints re-sondeados con curl, los 3 hallazgos previos confirmados + la refutación "Cámara citaciones tiene histórico", el % de estado de cancelación poblado, y la verificación del cron `agenda-weekly.yml`.

## Qué se construyó

- **§1 Matriz N/M** — 4 celdas con N (DB), M (universo hoy), rango de fecha min→max, % cruzable a boletín, % estado de cancelación, semanas ISO distintas, y la QUERY VERBATIM (5 bloques `sql`) que produjo cada número. Cada celda marcada THIN o AL DÍA-en-su-ventana. Re-corrida idéntica al research (cero deriva; mismo día).
- **§2 Veredictos de endpoints** — 10 probes curl rate-limited (≥3s/host): las 4 celdas productivas UP, con HTTP code + bytes + muestra recortada e histórico SÍ/NO por endpoint.
- **§3 Hallazgos** — (a) Senado comisiones forward-only CONFIRMADO; (b) Cámara sala thin CONFIRMADO; (c) comisiones unidas/especiales presentes CONFIRMADO; (NUEVO) Cámara forward-only REFUTADO (histórico probado con prmSemana=2026-20 mayo → 200).
- **§4 Frescura** — cron `agenda-weekly.yml` EXISTE (lunes 11:00 UTC + workflow_dispatch, 7 secrets SUPABASE/DEEPSEEK/R2, mismo CLI de operador). Gap declarado: ejecución en GH no verificable desde el código (billing intermitente) + el cron no hace backfill histórico Cámara.

## Métricas medidas (verbatim)

| Celda | N (DB) | Rango | % boletín | % estado | Semanas ISO |
|-------|--------|-------|-----------|----------|-------------|
| comisiones × Cámara | 34 | 2026-06-22→07-07 | 100% | ~9% | 2 (W26, W28) |
| comisiones × Senado | 104 | 2026-06-23→07-24 | ~71% | ~6% | 5 (W26–W30) |
| sala × Cámara | 1 sesión / 19 items | 2026-06-22 | ~79% | — | — |
| sala × Senado | 11 sesiones / 27 items | 2026-06-23→07-15 | ~81% | — | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Path y headers de Cámara comisiones corregidos**
- **Found during:** Task 2
- **Issue:** El bloque `<interfaces>` del plan (y el research) apuntaba a `www.camara.cl/legislacion/sesiones_sala/citaciones_semana.aspx`. Ese path devuelve **302→/error404.aspx** (no existe). Además, un GET con solo UA identificatorio devolvió 302 (el WAF de Cloudflare exige hoy el fingerprint de navegador).
- **Fix:** Re-sondeé con el path REAL del conector (`connector-camara.ts:80`, `BASE=.../legislacion/comisiones`) y el header-set de navegador completo (`headers-camara.ts`). Ambos probes (vigente 2026-30 y pasada 2026-20) devuelven **200** con `article.citaciones` y fechas reales. Documentado como "Corrección #1" en §2 del reporte.
- **Files modified:** 93-AUDITORIA-CITACIONES.md (§2)
- **Commit:** 03b92e2

**2. [Rule 2 - Missing critical info] Endpoint alterno opendata UP anotado**
- **Found during:** Task 2
- **Issue:** El path del research `/camaradiputados/WServices/WSComisiones.asmx/getComisiones_Vigentes` sigue DOWN (302 mantención). Pero un path alterno responde vivo.
- **Fix:** Anoté que `opendata.camara.cl/wscamaradiputados.asmx/getComisiones_Vigentes` está **UP (200 con XML `<Comisiones>` vivo)** — contradice "todo WSComisiones caído". No cambia la matriz de citaciones (lista comisiones, no citaciones con fecha), pero se registra como "Corrección #2" para no perder el hallazgo.
- **Files modified:** 93-AUDITORIA-CITACIONES.md (§2)
- **Commit:** 03b92e2

## Authentication Gates

Ninguno — todos los endpoints son públicos (GET anónimo); psql con `SUPABASE_DB_URL` de `.env` (ya presente).

## Self-Check: PASSED

- FOUND: .planning/phases/93-.../93-AUDITORIA-CITACIONES.md (196 líneas, §1-4 pobladas)
- FOUND: commit ef50325 (Task 1 — matriz N/M)
- FOUND: commit 03b92e2 (Task 2 — veredictos + hallazgos + frescura)
- Verificaciones automatizadas de ambas tasks: PASS (Matriz N/M presente, 5 bloques sql, Veredictos/REFUTADO/forward-only presentes, yml existe)
