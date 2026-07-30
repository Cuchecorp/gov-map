---
phase: 130-votos-real-b-01-el-numero-falso-muere
verified: 2026-07-30T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
deferred:
  - truth: "totalProyectos y el chart '¿Cuándo votó?' derivan del listado capado (≤1000 filas)"
    addressed_in: "Backlog OQ-1 / WR-05 (requiere RPC nueva ⇒ DDL sobre 0082 aplicada e intocable)"
    evidence: "Declarado en 130-03-SUMMARY §Deuda residual (OQ-1) y en 130-REVIEW WR-05; mitigado con rótulos honestos verificados en el HTML real. Fuera de DEBT-01, que nombra 'conteo de votos' y 'composición' (desglose por selección)."
  - truth: "order by v.seleccion en el limit del agregado (WR-08)"
    addressed_in: "Migración futura (0083+)"
    evidence: "0082 aplicada e intocable; riesgo cazado antes por los asserts 11-12 del pgTAP (CHECK vivo + cierre de dominio GLOBAL NULL-aware), verificados 12/12 contra PROD en esta corrida."
  - truth: "Confirmación sobre el deploy vivo en Cloudflare Workers"
    addressed_in: "Phase 138 (deploy conjunto del milestone v13.0)"
    evidence: "130-03-SUMMARY §Alcance de la verificación; el runtime de Workers es transporte, no participa del cálculo del número."
  - truth: "Rotación B26 de la credencial de PROD (CR-03)"
    addressed_in: "Operador"
    evidence: "130-REVIEW CR-03: redacción aplicada en artefactos del repo (verificada en esta corrida); la rotación es acción de operador."
---

# Phase 130: VOTOS-REAL — B-01 el número falso muere — Verification Report

**Phase Goal:** Las 71/186 fichas muestran el conteo REAL de votos (testigo D1165 = 3.752, no 1000) con composición no distorsionada; un clamp NO es un fix.
**Verified:** 2026-07-30
**Status:** passed
**Re-verification:** No — verificación inicial

## Goal Achievement

### Observable Truths (= 4 Success Criteria del ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RPC de conteo ADITIVA con la aguja completa aplicada a PROD | ✓ VERIFIED | `supabase/migrations/0082_*.sql`: secdef + `search_path=''` + schema-qualified + `statement_timeout=5s` + `limit 1000` + doble-revoke + post-check fail-closed. **pgTAP contra PROD en esta corrida: `1..12`, ok 1..12** (asserts 1-7 cubren existencia/secdef/anon-sin-execute/authenticated-sin-execute/search_path/timeout/shape PII-safe `(seleccion,n)`). Alta en `PUBLIC_RPC_ALLOWLIST` (`app/lib/lockdown-guard.test.ts:225`). |
| 2 | Número mostrado == recálculo SQL verbatim (`psql -tA`, jamás REST) | ✓ VERIFIED | Vivo en esta corrida: `RPC_SUM=3752` vs `RAW=3752` (count directo sobre `voto ⋈ votacion`, `estado_vinculo='confirmado'`). Render real (130-03-SUMMARY, evidencia aceptada, no re-corrida): D1165 html=3752=sql, D1170 html=3773=sql; assert negativo apareado `Ver detalle (1000)`/`Emitió 1000`/etc = 0 en ambos HTML, con control positivo previo (bytes>10KB, sin error de entorno embebido). |
| 3 | Composición no distorsionada (desglose deja de salir del `order by fecha desc` capado) | ✓ VERIFIED | Desglose vivo D1165: `si=1764, no=1772, abstencion=171, pareo=16, ausente=29` — **1:1 con el `aria-label` del HTML renderizado** documentado en 130-03-SUMMARY. Wiring real: `page.tsx:612` pasa `conteosGlobales={conteos.votosBreakdown}` y `votos-por-parlamentario.tsx:1032-1034` sustituye conteos+total por el agregado cuando no hay tema activo. |
| 4 | Cero clamp; test que muerde si el cap de la RPC vieja vuelve a gobernar | ✓ VERIFIED | RPC vieja **intacta** en PROD: `votos_de_parlamentario(p_id text, p_limit integer, p_offset integer)` (D-03 respetado, 42P13 evitado); `p_limit: 1000` sin tocar (`votos-por-parlamentario.tsx:1131`). Centinela D-05 (`page.test.tsx:453-548`) muerde por ambos lados: positivo `Ver detalle (3752)` + assert sobre la línea a11y de la sección `A favor 1764 · En contra 1772 · …` (el fix sugerido por el review era falso-verde por `renderToStaticMarkup` + Suspense; se corrigió con render directo awaited + source-scan del prop, mutación verificada). |

**Score:** 4/4 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | `totalProyectos` + chart derivados del listado capado | Backlog OQ-1 / WR-05 | Declarado en 130-03-SUMMARY; rótulos honestos medidos en HTML real. Fuera de DEBT-01. |
| 2 | `order by` en el agregado de 0082 (WR-08) | Migración futura (0083+) | 0082 intocable; riesgo cazado por asserts 11-12 (verificados ok). |
| 3 | Confirmación sobre Cloudflare Workers | Phase 138 | Deploy conjunto del milestone. |
| 4 | Rotación B26 de la credencial | Operador | CR-03 parcial por diseño. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/0082_votos_conteo_de_parlamentario.sql` | RPC agregada con aguja completa | ✓ VERIFIED | Aplicada a PROD (la RPC responde y el pgTAP la encuentra). Aditiva, no toca 0078. |
| `supabase/tests/0082_*.test.sql` | pgTAP contra schema aplicado | ✓ VERIFIED | `plan(12)`, 12/12 ok contra PROD en esta verificación. |
| `app/lib/parlamentario-resumen-conteos.ts` | Llamada al RPC + agregación | ✓ VERIFIED | L286 `.rpc("votos_conteo_de_parlamentario")`, degrade a `conteosDesconocidos()` (3-estado, no ceros fabricados). |
| `app/components/votos-por-parlamentario.tsx` | Total/desglose desde `conteosGlobales` | ✓ VERIFIED | Prop cableado; `SELECCION_ORDEN` como base única de total y barra. |
| `app/app/parlamentario/[id]/page.tsx` | Chip + sección cambian simultáneamente | ✓ VERIFIED | L612 prop real; L633 rama `no_ingerido` con `conteosGlobales={null}` (WR-01 cerrado: el error-path ya no es vacuo). |
| `app/components/capa1/votos-capa1.tsx` | Omite cifras si el estado no es `dato` | ✓ VERIFIED | CR-02 fixed (espejo de `LobbyCapa1`). |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `parlamentario-resumen-conteos.ts` | `votos_conteo_de_parlamentario` (PROD) | `.rpc()` | ✓ WIRED (RPC existe y responde 3752) |
| `page.tsx` | `VotosSection` | prop `conteosGlobales` | ✓ WIRED (source-scan + test de mutación) |
| `VotosSection` | barra/copy | `SELECCION_ORDEN` sobre `conteosGlobales` | ✓ WIRED |
| `lockdown-guard` | RPC nueva | `PUBLIC_RPC_ALLOWLIST` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Variable | Fuente | Datos reales | Status |
|---|---|---|---|---|
| `VotosSection` | `conteos`/`totalVotos` | RPC 0082 (agregado SQL) | Sí — 3752 vivo == recálculo SQL | ✓ FLOWING |
| `VotosCapa1` | `breakdown` | mismo agregado, con `CarrilEstado` | Sí; omite cifras si no es `dato` | ✓ FLOWING |
| chart / `totalProyectos` | filas cargadas (≤1000) | listado 0078 | No (subconjunto) | ⚠️ declarado OQ-1 con rótulo honesto → deferred |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| pgTAP 0082 contra PROD | `psql -tA -f supabase/tests/0082_*.test.sql` | `1..12` + 12 `ok` | ✓ PASS |
| Paridad agregado vs raw count | `select sum(n) …` / `count(*) …` D1165 | 3752 / 3752 | ✓ PASS |
| Desglose vivo | `select seleccion,n …` | 1764/1772/171/16/29 (= HTML) | ✓ PASS |
| RPC vieja intacta | `pg_get_function_identity_arguments` | `p_id text, p_limit integer, p_offset integer` | ✓ PASS |
| Tests de la fase | `vitest run` (3 archivos) | 130/130 passed | ✓ PASS |
| Guards | `pnpm guards` | verde (exit 0) | ✓ PASS |
| E2E render real | (evidencia 130-03-SUMMARY, no re-corrida por indicación) | 3752/3773 exactos + composición 1:1 | ✓ ACEPTADA |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| DEBT-01 | Conteo REAL de votos con composición no distorsionada, RPC aditiva con aguja completa, chip+`VotosSection` simultáneos, sin clamp | ✓ SATISFIED | Truths 1-4 verificados vivos contra PROD y contra el código actual post-fixes. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | Cero `TBD`/`FIXME`/`XXX` en los 6 archivos de producción/test de la fase | — | Ninguno |
| `.planning/milestones/v1.0-phases/07-…/07-01-SUMMARY.md` | 176 | Host del pooler regional + project ref en un SUMMARY de v1.0 | ℹ️ Info | **Preexistente, fuera de esta fase.** Los artefactos de la fase 130 sí están redactados (`[REDACTADO — ver nota de rotación B26]`, verificado). No es un gap de 130; sí es insumo para la rotación B26. |

### Human Verification Required

Ninguna. El único ítem clásicamente humano (render real de la ficha) fue medido con evidencia verbatim en 130-03-SUMMARY (control positivo previo al assert negativo, HTML de tamaños distintos por sujeto, paridad HTML↔`psql` en la misma corrida) y su núcleo numérico se re-confirmó vivo aquí contra PROD. Los pendientes de operador (rotación B26) y de deploy (Phase 138) están registrados como deferred, no como verificación bloqueante.

### Gaps Summary

Ninguno. Los 4 criterios del ROADMAP son verdaderos en el código actual y en PROD: la RPC 0082 existe con la aguja completa (12/12 pgTAP vivo), el número mostrado deriva del agregado y coincide con el recálculo SQL (3752 == 3752), el desglose es byte-a-byte el del universo completo, y no hay clamp — la RPC vieja conserva su firma y su `p_limit: 1000` intacto, con centinela D-05 que muerde por ambos lados y cuya mutación fue verificada. Las 12 findings del review resolvieron 10; los 2 diferidos (WR-05, IN-01) más WR-08 son deuda declarada que exige DDL sobre una migración aplicada o queda fuera del alcance de DEBT-01, y su riesgo está cubierto por asserts que se ponen rojos antes de que el defecto pueda manifestarse.

---

_Verified: 2026-07-30_
_Verifier: Claude (gsd-verifier)_
