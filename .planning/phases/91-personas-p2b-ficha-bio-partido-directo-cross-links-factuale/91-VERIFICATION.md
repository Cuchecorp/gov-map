---
phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale
verified: 2026-07-22T13:45:00Z
status: passed
score: 4/4 roadmap success criteria + 20/20 plan must_haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification. Code review (91-REVIEW.md) found 6 warnings, all FIXED via 0061 + commits 98e22e6/b0b6eef/7547644/629bf94 BEFORE this verification."
deploy_note: >
  El deploy LIVE actual (e0c969af) es PRE-fixes de review (0061 + WR-fixes). Los fixes de UI
  (total_n honesto, tooltip=false, truncamiento visible) están APLICADOS al código y a la DB
  (0061 en PROD, pgTAP 16/16) pero NO al bundle desplegado. El próximo deploy (Phase 92) los
  llevará live. NO es un gap de esta fase — declarado por instrucción del orquestador.
---

# Phase 91: PERSONAS P2b — Ficha bio + partido directo + cross-links factuales — Verification Report

**Phase Goal:** Montar el titular de la pasada 2 — parlamentario 360 con bio oficial y partido directo, cruzado con las demás variables — sin insinuar afinidad.
**Verified:** 2026-07-22T13:45:00Z
**Status:** passed
**Re-verification:** No — initial verification (review already fixed pre-verify)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | La ficha muestra la bio oficial (región/distrito, períodos, comisiones, demás campos) con fuente+fecha+enlace | ✓ VERIFIED | `parlamentario_publico_v2` emite region/distrito/circunscripcion/periodo/origen/fecha_captura/enlace (PROD firma verificada); `comisiones_de_parlamentario` emite nombre/tipo/cargo + provenance; `ComisionesDeParlamentario` montado en header, `MilitanciasDeParlamentario` como section. Profesión omitida honestamente (bio 0 filas). |
| SC2 | Partido DIRECTO correlacionado (ficha/filtros/cruces) "según fuente al [fecha]", partido≠comité, histórico vs actual | ✓ VERIFIED | PROD: listado v2 = 186/186 con partido; D1074 header = "Independientes \| camara-bio-diputados \| 2026-07-22". `PartidoChip` neutro (bg-muted idéntico por partido) con "según {fuente} al {fecha}". Militancias: vigente en capa-1 + acordeón histórico. Filtro island en /parlamentarios (25 facetas). Partido derivado SOLO de `parlamentario_militancia` (nunca comité). |
| SC3 | Cross-links factuales 4 bloques, leyenda anti-causal, orden neutral, counts honestos, jamás afinidad inferida | ✓ VERIFIED | 4 RPCs bounded (LIMIT 20) + `CrossLinkBloque` con `LEYENDA_CROSS_LINK` VERBATIM 1×/bloque; orden neutral alfabético REAL (PROD co_comisionados: Alejandro, Alejandro, Andrea — WR-03 fix); total_n honesto (D1074 copartidarios: 24 total / 20 rows, truncamiento declarado — WR-01/WR-02 fix); `n_proyectos` nunca criterio de orden; bloque N=0 omitido. |
| SC4 | Cero PII terceros/RUT en superficies públicas (RPCs no emiten rut/email; Block-B verde) | ✓ VERIFIED | PROD `pg_get_function_result` de las 8 RPCs: cero columna rut/email; `partido_alias` sólo en JOIN, nunca emitido. anon execute = f para todas. pgTAP 0060 30/30 + 0061 16/16 verde. lockdown-guard + PII-guard verdes. |

**Score:** 4/4 roadmap success criteria verified

### Plan Must-Haves (20 truths across 3 plans)

Plan 01 (7 truths): 8 RPCs PII-safe (cabecera/militancias/comisiones/listado + 4 cross-links) ✓; listado v2 con partido sin re-query ✓; cero rut/email ✓; 0060 aplicada a PROD + pgTAP 30/30 ✓ — ALL VERIFIED.
Plan 02 (6 truths): PartidoChip neutro "según fuente al [fecha]" ✓; comisiones + empty honesto ✓; militancias vigente + acordeón histórico ✓; chip omitido si null ✓; profesión no renderizada ✓; header sin RUT/email/foto ✓ — ALL VERIFIED.
Plan 03 (7 truths): 4 bloques cross-link con leyenda anti-causal ✓; section mt-12 + conteo honesto + truncamiento ✓; bloque vacío omitido ✓; auto-exclusión (RPC where <> p_id) ✓; filtro partido island ✓; PartidoChip en directorio ✓; linter extendido + mutation self-check muerde ✓ — ALL VERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0060_bio_partido_publico.sql` | 8 RPCs security-definer, doble-revoke CERO grant | ✓ VERIFIED | 8 create-or-replace, security definer set search_path='', doble-revoke VERBATIM cada una, cabecera documenta reversión operador 2026-07-21 vs 0020 |
| `supabase/migrations/0061_cross_links_conteo_honesto_orden.sql` | REVIEW-FIX: total_n + DISTINCT + orden alfabético | ✓ VERIFIED | 4 cross-links re-emitidas con total_n (count(*) over()), distinct on wrapped + re-ordenado por nombre (WR-01/03/06). Aplicada a PROD |
| `supabase/tests/006[01]_*.test.sql` | pgTAP contra schema aplicado | ✓ VERIFIED | Ejecutado LIVE contra PROD: 0060 = 30 ok / 0 not ok; 0061 = 16 ok / 0 not ok |
| `app/lib/types.ts` | Row-types + total_n en CrossLinkRow | ✓ VERIFIED | ParlamentarioPublicoRow/ListadoRow ampliados; MilitanciaRow/ComisionRow/CrossLinkRow (total_n?: number); cero rut/email |
| `app/components/partido-chip.tsx` | Chip neutro, null si sin dato, tooltip prop | ✓ VERIFIED | bg-muted idéntico por partido; return null si vacío; tooltip=false variante plana (WR-04) |
| `app/components/cross-links-parlamentario.tsx` | 4 bloques, leyenda LOCKED, truncamiento visible | ✓ VERIFIED | LEYENDA_CROSS_LINK exportada 1×/bloque; return null si N=0; "Mostrando los primeros N de M" cuando truncado |
| `app/components/militancias-de-parlamentario.tsx` | vigente + acordeón histórico | ✓ VERIFIED | section mt-12, vigente capa-1, DetalleColapsable histórico, empty honesto, fechas font-mono |
| `app/components/parlamentarios-filtro.tsx` | island cero-Supabase | ✓ VERIFIED | "use client"; sin import @/lib/supabase / .rpc / .from (solo docstring lo niega) |
| `app/lib/anti-insinuacion-guard.test.ts` | SUPERFICIES_PERSONAS + mutation self-check | ✓ VERIFIED | 7 superficies en el bucle; LEYENDA_CROSS_LINK en NEGACIONES_LOCKED; test (2) inyecta "cercano a su bloque"/"afín"/"coordina con" → guard muerde |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `page.tsx` (ficha) | 4 cross-link RPCs + v2 + comisiones + militancias | `.rpc()` React.cache server-only | ✓ WIRED | getCopartidarios/getMismaZona/getCoComisionados/getCoautores + parlamentario_publico_v2 + comisiones + militancias todos presentes (grep confirmado) |
| `page.tsx` | total_n (0061) | `totalReal(filas)` lee fila[0].total_n | ✓ WIRED | 4 wrappers usan totalReal → totalN, no filas.length |
| `parlamentarios/page.tsx` | `parlamentarios_publico_v2` | DirectoryList | ✓ WIRED | slice serializado al island, filtro SSR + client ortogonales |
| `directory-row` | `PartidoChip` | tooltip=false (WR-04) | ✓ WIRED | chip plano dentro del `<Link>`, sin trigger anidado |
| 0060/0061 RPCs | tablas maestras | security definer search_path='' | ✓ WIRED | schema-qualified public.parlamentario_militancia/comision_membresia/proyecto_autor |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| PartidoChip (header/directorio) | partido | parlamentario_militancia es_actual | ✓ 186/186 con partido en PROD | ✓ FLOWING |
| CrossLinkBloque | filas + total_n | 4 cross-link RPCs | ✓ D1074: copartidarios 24 total/20 rows, co_comisionados alfabético | ✓ FLOWING |
| MilitanciasDeParlamentario | militancias | militancias_de_parlamentario | ✓ D1074: 6 militancias | ✓ FLOWING |
| ComisionesDeParlamentario | comisiones | comisiones_de_parlamentario | ✓ D1074: 3 comisiones | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| anon no puede ejecutar RPCs | has_function_privilege('anon',...,'execute') | f (copartidarios, parlamentario_publico_v2) | ✓ PASS |
| partido poblado en listado | count filter partido not null | 186/186 | ✓ PASS |
| conteo honesto total_n > cap | max(total_n) vs count(*) D1074 copartidarios | 24 total / 20 rows | ✓ PASS |
| orden alfabético REAL (WR-03) | co_comisionados first 3 nombres | Alejandro, Alejandro, Andrea (por nombre, no id) | ✓ PASS |
| cero PII en firma RPC | pg_get_function_result 8 RPCs | cero rut/email | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP 0060 | psql -f 0060_bio_partido_publico.test.sql | 30 ok / 0 not ok | PASS |
| pgTAP 0061 | psql -f 0061_cross_links_conteo_honesto_orden.test.sql | 16 ok / 0 not ok | PASS |
| suite app | vitest run | 1111/1112 (1 timeout flake) | PASS* |
| tsc | tsc -b | exit 0 | PASS |
| anti-insinuación + lockdown guards | vitest run (aislado) | 30/30 verde | PASS |
| money-antiflip (aislado) | vitest run --testTimeout 60000 | 20/20 verde en 84ms | PASS |

*El único fallo de la suite full-run es `money-antiflip-guard.test.ts` por timeout (5s) — un guard de v7.0 que camina el filesystem, NO tocado por Phase 91. Aislado con timeout mayor: 20/20 verde en 84ms. Es un flake de entorno, no una regresión de esta fase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BIO-02 | 91-01/02 | Bio oficial (región/distrito, períodos, comisiones) con fuente+fecha+enlace | ✓ SATISFIED | RPC v2 + comisiones RPC + componentes montados |
| BIO-03 | 91-01/02/03 | Partido DIRECTO correlacionado, "según fuente al [fecha]", histórico vs actual | ✓ SATISFIED | 186/186 partido, chip neutro, militancias, filtro island |
| BIO-04 | 91-01/03 | Cross-links factuales, jamás afinidad inferida | ✓ SATISFIED | 4 bloques anti-causales, orden neutral, linter extendido |
| FILT-01 (personas) | 91-03 | Filtro por partido en /parlamentarios | ✓ SATISFIED | island parlamentarios-filtro, 25 facetas, counts honestos |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ningún debt marker (TBD/FIXME/XXX) en archivos de la fase | — | ninguno |
| militancias-de-parlamentario.tsx | 26-27 | `new Date(isoDate)` (IN-02: UTC/local drift potencial en fechas date-only) | ℹ️ Info | Off-by-one-day cosmético en tramos de militancia; no bloqueante (ya notado en review como Info) |
| types.ts | 257 | ComisionRow.camara "senadores" vs "senado" en el resto (IN-04) | ℹ️ Info | Cosmético — comisiones solo string-join la cámara; no compara contra literal |

### Human Verification Required

Ninguno adicional. El gate BrowserOS ya se ejecutó en 91-03 (partido con fuente+fecha, 3 leyendas cross-link, "De la misma zona" N=0 omitido, 25 facetas de partido confirmados en PROD via search_dom sobre el deploy e0c969af).

### Gaps Summary

Sin gaps. Los 4 success criteria del ROADMAP y los 20 must_haves de los 3 planes están verificados contra el código y contra PROD (psql read-only). Las 6 warnings del code review fueron corregidas ANTES de esta verificación (migración 0061 aplicada a PROD, pgTAP 16/16; commits WR-01/02/03/04/05/06). La única deuda declarada es de DEPLOY, no de código: el bundle live (e0c969af) es pre-fixes de review; los fixes de UI (total_n honesto, tooltip=false, truncamiento declarado) están en el código y en la DB pero se desplegarán con Phase 92 — declarado por instrucción del orquestador, no contabilizado como gap. Los 3 Info del review (IN-02 fecha UTC drift, IN-04 spelling camara) son cosméticos y no bloqueantes.

---

_Verified: 2026-07-22T13:45:00Z_
_Verifier: Claude (gsd-verifier)_
