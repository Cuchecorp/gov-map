---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
plan: 01
subsystem: database
tags: [audit, psql, relaciones, militancia, lobby, coalicion, servel, anti-insinuacion]

# Dependency graph
requires:
  - phase: 91-personas-p2c (0060/0061 RPCs)
    provides: cross-link RPCs montadas (copartidarios/misma-zona/co-comisionados/coautores) + militancias_de_parlamentario display
provides:
  - "101-AUDIT-RELACIONES.md — matriz N/M por relación (dato-disponible vs superficie-mostrada) verbatim psql PROD"
  - "Zona-gap headline: eje SOLO Senado (diputados 155->0 distrito/circ/región)"
  - "Decisión lobby-misma-contraparte: DIFERIDA (contraparte_id 0/17681; name-match con conflación CGE)"
  - "N LOCKED militancia histórica net-new = 696 (vs shared-ever 1966) para copy Plan 02/03"
  - "Veredicto coalición: Servel pactos VIABLE (dos-etapas R2 documentada) / comités Senado DIFERIDA (host firewalled)"
affects: [101-02 (bloque relaciones ficha), 101-03 (/comparar + militancia histórica RPC 0067), coalicion-ingest-future, comites-senado-future]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit N/M reproducible psql -tA verbatim (espejo 93), NUNCA PostgREST (cap 1k)"
    - "Probe fuente oficial curl-first (UA identificatorio, rate-limit 2-3s, robots.txt) sin write PROD/R2"
    - "Decisión provenance name-match: DIFERIDA por default, evidencia de conflación antes de shippear"

key-files:
  created:
    - ".planning/phases/101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali/101-AUDIT-RELACIONES.md"
  modified: []

key-decisions:
  - "Militancia histórica: net-new-only (696) LOCKED sobre shared-ever (1966) — el 5º bloque añade info que copartidarios no da"
  - "Lobby-misma-contraparte DIFERIDA: contraparte_id 100% NULL (0/17681) + name-match con conflación (CGE en 4 grafías) => no ship sin decisión operador + normalización"
  - "Zona eje SOLO Senado (31); Cámara-zona = tarea de INGESTA fuera de alcance (Future Requirement), NO se fabrica distrito"
  - "Coalición Servel pactos VIABLE (5 pactos party-level, robots-allowed); comités Senado DIFERIDA por bloqueo de red (sitio.senado.cl timeout 21s), re-probe desde red no bloqueada"

patterns-established:
  - "El audit GATEA el diseño UI: sus N/M alimentan el copy de cobertura declarada de Plan 02/03"

requirements-completed: [REL-01, REL-04, REL-05]

# Metrics
duration: 14min
completed: 2026-07-24
---

# Phase 101 Plan 01: Auditoría de brecha de RELACIONES Summary

**Matriz N/M por relación re-medida verbatim contra PROD (militancia 363/186/177, comisiones 386/34, co-autoría 9937) + zona-gap headline (eje SOLO Senado) + decisión lobby DIFERIDA + N militancia histórica net-new 696 LOCKED + veredicto coalición Servel VIABLE / comités Senado DIFERIDA**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-24T19:43:00Z
- **Completed:** 2026-07-24T19:57:00Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- **§1-4 matriz N/M reproducible** con queries psql `-tA` verbatim contra PROD (2026-07-24), cada N con su query pegada y resultado real. Todas las cifras del research CONFIRMADAS salvo una corrección RULE-1.
- **§2 zona-gap (headline):** `diputados|155|0|0|0` — el 100% de la Cámara sin distrito/circunscripción/región → `de_la_misma_zona` rinde 0 para todo diputado; eje declarado **SOLO Senado (31)**. NO se fabrica distrito; Cámara-zona = Future Requirement de ingesta.
- **§3 decisión lobby DIFERIDA con N:** `contraparte_id` NOT NULL = **0 de 17.681** (identidad no resuelta); name-match fallback = 3.749 pares / 134 parl, con evidencia de **conflación** (CGE fragmentado en 4 grafías `cge`/`cge s.a`/`cge s.a.`/`compañía general de electricidad`). No se shippea sin decisión operador + normalización.
- **§4 militancia histórica:** `1966|1270|696` → **net-new 696 LOCKED** para el copy de Plan 02/03; Pitfall 1 confirmado (DC/Liberal/PPD mapean 2 `partido_alias` c/u → cruzar por alias, nunca por display).
- **§5 probe coalición:** Servel pactos 2025 **VIABLE** (200 OK, robots-allowed, 5 pactos party-level machables vía militancia; ruta dos-etapas R2 documentada NO ejecutada); comités Senado **DIFERIDA** (`sitio.senado.cl` inalcanzable — timeout de conexión 21s incluso con IP resuelta = bloqueo IP/firewall del egress).

## Task Commits

Ambas tareas producen el mismo artefacto (`101-AUDIT-RELACIONES.md`, §1-4 = Task 1, §5 = Task 2); se comitearon juntas al cerrar el documento gate:

1. **Task 1 (matriz N/M + zona-gap + decisión lobby + militancia histórica) + Task 2 (probe coalición)** - `22ed455` (docs)

**Plan metadata:** (final commit con SUMMARY/STATE/ROADMAP)

## Files Created/Modified

- `.planning/phases/101-.../101-AUDIT-RELACIONES.md` - documento-gate: §1 matriz N/M, §2 zona-gap, §3 lobby DIFERIDA, §4 militancia histórica net-new, §5 coalición, §6 insumos Plan 02/03, §7 integridad (382 líneas)

## Decisions Made

- **Net-new-only (696) LOCKED** para militancia histórica sobre shared-ever (1966): el 5º bloque debe añadir info que "Del mismo partido" (1270 copartidarios vigentes) no da.
- **Lobby-misma-contraparte DIFERIDA por default:** contraparte_id 100% NULL + name-match con conflación demostrada = provenance débil; ambas rutas documentadas para decisión operador, sin ship.
- **Zona eje SOLO Senado:** honestidad de dato, NO se fabrica distrito; Cámara-zona diferida como ingesta.
- **Coalición Servel VIABLE** con ruta dos-etapas R2 documentada (NO ejecutada); comités Senado diferido por bloqueo de red, no por inviabilidad de fuente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Corrección de snapshot] Conteo de parlamentarios del name-match lobby = 134, no 136**
- **Found during:** Task 1 (§3.2 decisión lobby)
- **Issue:** El research snapshot decía "3.749 pares / 136 parl"; la re-corrida verbatim (query simétrica union(a,b)) da 134 parlamentarios distintos.
- **Fix:** Registrado como corrección RULE-1 en §3.2 y §7; pares 3.749 CONFIRMADOS idénticos, solo el conteo de parlamentarios se ajusta a 134.
- **Files modified:** 101-AUDIT-RELACIONES.md
- **Verification:** Query re-corrida contra PROD; resultado 134 reproducible.
- **Committed in:** `22ed455`

**2. [Rule 1 - Evidencia empírica] Comités Senado: no es "301 recuperable" sino host firewalled**
- **Found during:** Task 2 (§5.2 probe coalición fuente B)
- **Issue:** El research (LOW confidence) asumía "301 desde www recuperable siguiendo redirect". El probe empírico mostró que el redirect apunta a `sitio.senado.cl`, host que hace timeout de conexión TCP (21s) incluso con IP resuelta vía `--resolve` = bloqueo IP/firewall del egress, no un 301 seguible.
- **Fix:** Documentado con evidencia cruda (301 location + curl(6) DNS + curl(28) timeout + www 404 en _next/data + sitemap sin comité); veredicto DIFERIDA con re-probe recomendado desde red no bloqueada.
- **Files modified:** 101-AUDIT-RELACIONES.md
- **Verification:** curl reproducible; www.senado.cl raíz 200 pero ruta comités solo en host bloqueado.
- **Committed in:** `22ed455`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — corrección de snapshot / evidencia empírica que refina un supuesto LOW-confidence del research). Ambas son la razón de ser del audit: re-medir el gate, no confiar en snapshots.
**Impact on plan:** Cero scope creep. El audit cumple su función de gate: corrige el research donde la realidad difiere.

## Issues Encountered

- **`sitio.senado.cl` inalcanzable desde el egress de la corrida:** DNS falla vía curl (error 6) aunque `getent`/`nslookup` resuelven a 200.28.4.130; con `--resolve` la conexión TCP a :443 hace timeout a 21s (error 28). BrowserOS usaría el mismo egress firewalled → no se forzó un timeout largo. Resuelto documentando DIFERIDA con evidencia y recomendando re-probe desde red no bloqueada. NO bloquea REL-05 porque Servel ya da una fuente VIABLE.

## User Setup Required

None - no external service configuration required por este plan (audit de solo lectura).

## Next Phase Readiness

- **Plan 02 (bloque relaciones en la ficha)** DESBLOQUEADO: N/M de cobertura listos — copartidarios/comisiones/co-autoría MOSTRADAS; zona SOLO-Senado (copy "solo senadores"); militancia histórica net-new 696 como candidato al 5º bloque; lobby DIFERIDO (no entra).
- **Plan 03 (/comparar + RPC 0067)** DESBLOQUEADO: militancia histórica cruza por `partido_alias` (RPC nueva 0067, net-new 696); comisiones/co-autoría intersectables desde RPCs existentes; zona vacío-honesto para dos diputados; co-autoría boletines-por-par = decisión de plan.
- **Futuros (fuera de v10.0 pasada 2):** ingesta zona-Cámara; ingesta coalición Servel (dos-etapas R2 documentada); re-probe + ingesta comités Senado desde red no bloqueada; resolución de identidad de contraparte de lobby.

---
*Phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali*
*Completed: 2026-07-24*

## Self-Check: PASSED
- FOUND: .planning/phases/101-.../101-AUDIT-RELACIONES.md (382 líneas)
- FOUND commit: 22ed455
