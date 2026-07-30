---
phase: 131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
verified: 2026-07-30T18:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Paridad DOM real (conteo de `Hito del` en el HTML del deploy) contra el numero congelado 85"
    addressed_in: "Phase 138"
    evidence: "ROADMAP.md §Phase 131 SC#1 anota explicitamente: 'paridad DOM real delegada a Phase 138 sobre el deploy del milestone'. El fixture .esperado.json declara las 2 precondiciones (sin ?urgencias=uN; todas las fechas plausibles) para que 138 no lea un mismatch como regresion."
---

# Phase 131: DEBT-FICHA — Regla del timeline + co-autoria sin truncamiento — Verification Report

**Phase Goal:** La regla de seleccion del timeline queda gobernada por una query escrita con criterio declarado, y la co-autoria de /comparar emite membresia de par completa sin truncamiento silencioso.
**Verified:** 2026-07-30
**Status:** passed
**Re-verification:** No — verificacion inicial, contra el codigo ACTUAL post-fixes del REVIEW (85c04eb..22325eb)

## Goal Achievement

### Observable Truths (ROADMAP SC 1-4)

| # | Truth | Status | Evidence (VIVO, no SUMMARY) |
|---|-------|--------|-----------------------------|
| 1 | Regla del timeline escrita como query con criterio declarado; explica 99→85 en `14309-04`; determinista; render obedece la regla (paridad por unit) | VERIFIED | `psql -tA -F'\|' -v boletin=14309-04 -f supabase/queries/timeline-regla-de-seleccion.sql` → `99\|14\|5\|85`, **identico** al fixture congelado `timeline-14309-04.esperado.json` (99/14/5/85). Identidad `99−14=85` cierra sin residuo. El `.sql` declara QUE ENTRA / QUE SE AGRUPA / QUE SE EXCLUYE / POR QUE + orden total + nota date-only (0 usos de `America/Santiago`) + reconciliacion del numero viejo + precondiciones de `hitos_del` (WR-02). El orden total vive espejado en `page.tsx:487-489` (`.order("fecha").order("id")`) y el `row_number()` espeja `fechaPlausible` (fix WR-01). 45/45 tests en `components/timeline-view.test.tsx` (incl. paridad regla↔builder importando el fixture, cero literal horneado). |
| 2 | RPC v2 PARALELA, firma viva jamas alterada, sin truncamiento a 20, aguja completa + pgTAP contra el schema aplicado | VERIFIED | pgTAP `supabase/tests/0083_coautoria_v2.test.sql` contra PROD: **14 ok / 0 not ok** (`1..14`, ROLLBACK) — incluye secdef, stable, `search_path=''`, `statement_timeout=5s`, firma pareada con la viva, viva conserva `limit 20`, v2 `limit 1000`, cero-grant en los TRES principals (anon/authenticated/PUBLIC — fix WR-05/IN-01/IN-02), sin `rut`/`donante_id`, control positivo >20 filas. Migracion `0083` con doble-revoke, cero grant, cero DML. |
| 3 | `/comparar` consume la v2; conteo mostrado == recalculo SQL de PROD; cero truncamiento silencioso | VERIFIED | Recalculo independiente sobre `proyecto_autor` (D1178×D1099) = **92**; RPC v2 en ambas direcciones = **92** y **92** ⇒ A==B==92 (derivado vivo, no leido del SUMMARY). Wiring real: `app/app/comparar/page.tsx:124` llama `sb.rpc("coautores_de_parlamentario_v2")`; el eje pasa `CAP_RPC_COAUTORES` explicito (`page.tsx:406`), constante `= 1000` (l.602), y la frase de indeterminacion cita `${CAP_RPC_COAUTORES}` (l.437). `CAP_RPC = 20` (militancia) intacto con control apareado vivo en `page.test.tsx`. 33/33 tests. |
| 4 | Suite + guards verdes; RPC vieja intacta y funcional (paralela, no reemplazada en caliente) | VERIFIED | `cd app && pnpm guards` → **11 archivos / 334 tests passed**. Tests por nombre (timeline-view, comparar, proyecto page, lockdown-guard) → **129/129 passed**. En PROD: `coautores_de_parlamentario('D1178')` devuelve **20** filas (viva intacta, techo viejo) vs v2 **91** filas; la viva para el par D1178→D1099 devuelve **0** (control apareado: el defecto era real, no vacuo). `parlamentario/[id]/page.tsx:201` sigue consumiendo la RPC vieja sin cambios. |

**Score:** 4/4 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Paridad DOM real del conteo `Hito del` sobre el deploy | Phase 138 | ROADMAP §131 SC#1 lo delega explicitamente; precondiciones declaradas en el fixture y en la cabecera del `.sql` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/queries/timeline-regla-de-seleccion.sql` | Regla documental con criterio declarado | VERIFIED | ~120 lineas, ejecutable, parametrizada por variable psql; incluye fix CR-01 (`coalesce(descripcion,'')` en `es_urg`/`es_retiro`) y WR-01 (plausibilidad como primera clave) |
| `app/components/__fixtures__/timeline-14309-04.json` + `.esperado.json` | Fixture congelado, sede unica del numero | VERIFIED | 99 eventos reales; `.esperado.json` = sede unica de 99/14/5/85 + precondiciones |
| `app/app/proyecto/[boletin]/page.tsx` | Orden total + lectura completa | VERIFIED | `.order("fecha").order("id").range(...)` con paginacion en bucle (fix WR-04, cap PostgREST 1.000; max real medido 733) |
| `supabase/migrations/0083_coautoria_v2.sql` | RPC v2 paralela APLICADA | VERIFIED | Viva en PROD (pgTAP la resuelve); espejo verbatim de 0064 salvo `_v2` y `limit 1000` |
| `supabase/tests/0083_coautoria_v2.test.sql` | pgTAP contra schema aplicado | VERIFIED | 14/14 ok ejecutado por el verificador |
| `app/app/comparar/page.tsx` | Consumo de la v2 con cap propio | VERIFIED | Ver truth 3 |
| `app/lib/lockdown-guard.test.ts` | Allowlist +1 | VERIFIED | `coautores_de_parlamentario_v2` en `PUBLIC_RPC_ALLOWLIST` (l.204); guard verde |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `comparar/page.tsx` | `coautores_de_parlamentario_v2` (PROD) | `sb.rpc(...)` en `getCoautores` | WIRED (RPC existe y responde 92/91) |
| `comparar/page.tsx` eje co-autoria | `CAP_RPC_COAUTORES=1000` | parametro explicito en `interseccionPar` | WIRED |
| `parlamentario/[id]/page.tsx` | `coautores_de_parlamentario` (vieja) | `crossLinkReader` | WIRED e INTACTO |
| `page.tsx` lectura de eventos | `construirItems` (timeline-view) | orden total heredado por sort estable | WIRED (test de orden total con control positivo apareado) |
| `.sql` documental | fixture `.esperado.json` | medicion contra PROD | WIRED (reproducido vivo: 99\|14\|5\|85) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| `/comparar` eje co-autoria | `coautA`/`coautB` | RPC v2 en PROD | Si — 91 filas para D1178, `n_proyectos=92` para el par | FLOWING |
| ficha timeline | `tramitacion_evento` paginado | Supabase | Si — 99 eventos reales en 14309-04 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Regla documental reproduce el numero congelado | `psql -f timeline-regla-de-seleccion.sql -v boletin=14309-04` | `99\|14\|5\|85` | PASS |
| pgTAP de la v2 contra schema aplicado | `psql -tA -f supabase/tests/0083_coautoria_v2.test.sql` | `1..14`, 14 ok | PASS |
| Conteo == recalculo (testigo) | consulta compuesta en PROD | `92\|92\|92\|20\|91\|0` | PASS |
| Tests por nombre | `pnpm exec vitest run <4 archivos>` | 129 passed | PASS |
| Guards de regimen | `cd app && pnpm guards` | 11 files / 334 passed | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| DEBT-03 (H-06) | Regla del timeline gobernada por query escrita con criterio declarado | SATISFIED | Truth 1; REQUIREMENTS.md:38 marcado `[x]` con puntero a evidencia |
| DEBT-04 (fila 3.3) | Co-autoria de /comparar sin truncamiento silencioso a 20 | SATISFIED | Truths 2-4; REQUIREMENTS.md:39 marcado `[x]` |

Cero requisitos huerfanos: REQUIREMENTS.md mapea exactamente DEBT-03 y DEBT-04 a la Phase 131.

### Anti-Patterns Found

| File | Pattern | Severity |
|------|---------|----------|
| — | Cero `TBD`/`FIXME`/`XXX` en los 5 archivos nucleares de la fase | — |

Cero stubs. Cero mocks en produccion. Cero dependencias nuevas.

### Deudas declaradas (legitimas, no gaps)

1. Techo movil `now + 5 anos` de `fechaPlausible` — espejado en query y builder y **declarado** en la cabecera del `.sql`; cerrarlo exige rediseñar `fechaPlausible`, transversal a la app.
2. `descripcion` tipada `string` sobre columna nullable — el codigo usa `?? ""`, y la query ahora aplica `coalesce(descripcion,'')` simetricamente (fix CR-01).
3. 14 call-sites sin migrar al helper de lectura paginada — el call-site critico de esta fase (`tramitacion_evento`) SI esta paginado.

### Gaps Summary

Ninguno. Los 4 success criteria del ROADMAP se sostienen con comandos ejecutados por el verificador contra PROD y contra el codigo actual post-fixes del REVIEW (10/10 findings verificados presentes en el codigo: CR-01 coalesce, WR-01 plausibilidad, WR-02 precondiciones, WR-03 mock que assertea la cadena, WR-04 paginacion, WR-05/IN-01/IN-02 pgTAP 12→14 asserts, IN-03 comentario del cap). La unica pieza no verificable aqui — la paridad DOM sobre el deploy — esta explicitamente delegada a Phase 138 por el propio ROADMAP y queda registrada como deferred, no como gap.

---

_Verified: 2026-07-30_
_Verifier: Claude (gsd-verifier)_
