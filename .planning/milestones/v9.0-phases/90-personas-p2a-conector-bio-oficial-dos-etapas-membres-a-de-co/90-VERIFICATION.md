---
phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co
verified: 2026-07-22T10:20:00Z
status: passed
score: 17/17 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
gaps: []
---

# Phase 90: PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones (GATE de 91) — Verification Report

**Phase Goal:** Poblar la biografía oficial del Congreso por ingesta de dos etapas con allowlist de campos — sin columna de bio ni membresía de comisiones, la ficha no puede montar el header de 91.
**Verified:** 2026-07-22T10:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + 3 plans' must_haves, merged/deduped)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Conector dos-etapas fuente→R2→Supabase: `retornarDiputadosPeriodoActual` (opendata.camara.cl) diputados + BCN senadores | ✓ VERIFIED | `run-bio.ts:131` `putImmutable` Etapa 1 antes del write; `:140` `existed` short-circuit "sin novedades"; `:115-122` `--from-r2` replay leyendo crudo de R2 sin fetch; `run-bio-cli.ts:29,130` ensambla Fetcher+R2Store reales; endpoint `retornarDiputadosPeriodoActual` en cli |
| 2 | ALLOWLIST de campos: PII de terceros/familiares en R2 crudo, JAMÁS en tablas Supabase | ✓ VERIFIED | `model.ts` NO declara fechaNacimiento/rut/sexo; 4 schemas `.strict()`; `model.test.ts` 11 tests (rechaza rut/fechaNacimiento/sexo); `parse-diputados.test.ts:33-41` fixture SÍ tiene PII, modelo parseado NO (`not.toContain 12345678/FechaNacimiento/Femenino`); migración 0059 sin columnas PII |
| 3 | Membresía de comisiones ingerida y modelada (hoy NO existe) | ✓ VERIFIED | 0059 crea `comision` + `comision_membresia`; PROD: `comision`=34, `comision_membresia`=386; parse-comisiones fail-closed (membresía solo por DIPID exacto) |
| 4 | Solo identidad confirmado/determinista (fail-closed); rate-limit 2-3s; backfill LOCAL | ✓ VERIFIED | `run-bio.ts:174-177` diputados `matches.length !== 1 → skip` (nunca name-match, Pitfall 4); `:213` senadores `enlazarSenadoresPorParlid` determinista; `:270-273` comisiones DIPID exacto; PROD: FK fabricados militancia=0, membresía=0 |
| 5 | @obs/bio existe, resuelve en workspace, suite corre (no CI-DARK) | ✓ VERIFIED | `packages/bio/vitest.config.ts` presente; `pnpm --filter @obs/bio test` = 8 files / 65 tests pass |
| 6 | Modelo tipado NO declara PII — imposible persistir por construcción | ✓ VERIFIED | Truth 2 evidence; `.strict()` en los 4 schemas |
| 7 | 0059 crea 4 tablas con provenance inline, RLS deny-by-default, cero grant anon | ✓ VERIFIED | 0059 tiene 4× `create table` + 4× `enable row level security` + 4× `revoke all … from anon, authenticated`; grep grant-to-anon = false |
| 8 | pgTAP 0059 verifica RLS on, cero policies, cero grant anon | ✓ VERIFIED | ledger: 28 ok / 0 not ok; PROD live re-check: 4 tablas RLS=t, policies=0, anongrant=0 |
| 9 | Parser diputados dropea PII por construcción (fixture PII → modelo sin PII) | ✓ VERIFIED | `parse-diputados.test.ts` 9 tests pass, PII-drop test bites |
| 10 | Parser mapea Militancia→{partido,desde,hasta,esActual}, "actual"≠primera del XML | ✓ VERIFIED | model.ts Militancia; parse-diputados test cubre militancia vigente por FechaInicio más reciente |
| 11 | Match fail-closed: DIPID exacto diputados; parlid/nombre senadores; sin match único → skip, NUNCA fabrica FK | ✓ VERIFIED | Truth 4 evidence; PROD FK-fabricado = 0 en ambas tablas |
| 12 | Orquestador dos-etapas: crudo a R2 primero, --from-r2 reconstruye sin fetch | ✓ VERIFIED | Truth 1 evidence; `run-bio.test.ts` 9 tests (incluye replay sin red + short-circuit) |
| 13 | Writer upsert idempotente (2× run = conteos idénticos) + refresca parlamentario.partido desde actual | ✓ VERIFIED | `writer.ts` KEY_SEP `\|` (CR-02 fix); `run-bio.ts:195,231` partido update solo si exactamente 1 actual (A1/WR-01); PROD: partido refrescado 2026-07-22 = 186 (155 dip + 31 sen) |
| 14 | Parser comisiones enlaza membresía SOLO por identidad confirmada; sin integrantes → catálogo sin membresía | ✓ VERIFIED | `run-bio.ts:264` sin fuente integrantes → skip; `:271` fail-closed DIPID; ledger: fuente SÍ trajo integrantes (34 com / 386 memb / 1 skip) |
| 15 | CLI ensambla colaboradores reales + --dry-run/--from-r2/--xml-file + loadEnv BOM-safe | ✓ VERIFIED | `run-bio-cli.ts:204,208` flags; `:230` r2Store solo en LIVE con creds; `:251-255` WR-02 replay bajo dry-run; run-bio-cli.test.ts 8 tests pass |
| 16 | 0059 APLICADA a PROD + pgTAP verde contra schema aplicado | ✓ VERIFIED | ledger §1-2; PROD live: 4 tablas existen, RLS/policy/anongrant confirmados |
| 17 | Camino SENADORES INTENTADO + veredicto DECLARADO en ledger (degradación declarada, no silenciosa) | ✓ VERIFIED | ledger §3-B: query `bio:Senador` daba 0 → corregida a `bio:idSenado` join determinista por parlid_senado; 31 confirmados / 85 históricos sin match (fail-closed); PROD: origen bcn-senadores=48, 31 senadores con parlid_senado |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/bio/vitest.config.ts` | config para suite (no CI-DARK) | ✓ VERIFIED | presente; 65 tests corren |
| `packages/bio/src/model.ts` | allowlist sin PII | ✓ VERIFIED | 146 líneas, 4 interfaces + `.strict()` schemas, sin PII |
| `packages/bio/src/parse-diputados.ts` | XML allowlist + militancia vigente | ✓ VERIFIED | 10328 bytes; PII-drop test bites |
| `packages/bio/src/run-bio.ts` | orquestador dos-etapas fail-closed | ✓ VERIFIED | 12968 bytes; putImmutable + fromR2 + match ===1 |
| `packages/bio/src/writer-supabase.ts` | upsert idempotente + partido update | ✓ VERIFIED | 6256 bytes; onConflict clave natural |
| `packages/bio/src/run-bio-cli.ts` | entry-point dos-etapas | ✓ VERIFIED | 13160 bytes; flags + colaboradores reales |
| `supabase/migrations/0059_bio_comisiones.sql` | 4 tablas deny-by-default | ✓ VERIFIED | RLS on + revoke anon, 0 grant anon |
| `supabase/tests/0059_bio_comisiones.test.sql` | pgTAP deny-by-default + provenance | ✓ VERIFIED | 28 ok / 0 not ok (ledger + PROD re-check) |
| `90-BIO-LEDGER.md` | apply + pgTAP + cobertura + veredicto comisiones | ✓ VERIFIED | contiene apply, 28 ok, cobertura N/M por fuente |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| run-bio.ts | R2Store.putImmutable | Etapa 1 crudo; --from-r2 sin red | ✓ WIRED | `:131` putImmutable, `:115-122` replay |
| run-bio.ts | identidad fail-closed | id_diputado_camara===dipid, ===1 | ✓ WIRED | `:174-177` |
| model.ts | allowlist minimización | no declara PII | ✓ WIRED | `.strict()` × 4 |
| 0059 | lockdown-guard Block A | revoke all from anon, cero grant | ✓ WIRED | grep grant-to-anon=false |
| run-bio-cli.ts | @obs/ingest reales | Fetcher+HostRateLimiter+R2Store | ✓ WIRED | `:29,130,218` |
| 0059 aplicada | pgTAP schema aplicado | psql --single-transaction | ✓ WIRED | PROD live re-check confirma |

### Data-Flow Trace (Level 4 — PROD)

| Data | Source | Produces Real Data | Status |
| ---- | ------ | ------------------ | ------ |
| parlamentario_militancia | conector bio → R2 → Supabase | Sí: 363 filas (315 dip + 48 sen) | ✓ FLOWING |
| comision | camara.cl catálogo | Sí: 34 filas | ✓ FLOWING |
| comision_membresia | integrantes.aspx DIPID-matched | Sí: 386 filas, 0 FK fabricado | ✓ FLOWING |
| parlamentario.partido | militancia actual | Sí: 186 refrescados 2026-07-22 | ✓ FLOWING |
| parlamentario_bio | (profesión) | 0 filas — Known Stub declarado (91) | ⚠️ STUB INTENCIONAL (no bloquea gate) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| bio suite | `pnpm --filter @obs/bio test` | 8 files / 65 tests pass | ✓ PASS |
| tsc | `pnpm --filter @obs/bio exec tsc -b` | exit 0 | ✓ PASS |
| root suite | `pnpm -r test` | todos los paquetes pass, cero failures | ✓ PASS |
| migración sin grant anon | node grep | grant-to-anon = false | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| pgTAP 0059 | `psql -tA -f 0059_...test.sql` | 28 ok / 0 not ok (ledger); PROD live re-check RLS/policy/anongrant=0 | PASS |
| PROD counts | `psql` bio tables | m=363, c=34, cm=386, b=0, fk_bad_mil=0, fk_bad_memb=0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| BIO-01 | 90-01/02/03 | Conector bio dos-etapas (fuente→R2→Supabase), PII de terceros solo en R2 | ✓ SATISFIED | Truths 1,2,4; PROD poblado |
| BIO-05 | 90-01/02/03 | Membresía de comisiones ingerida y modelada | ✓ SATISFIED | Truth 3; PROD 34 com / 386 memb |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | TBD/FIXME/XXX scan | — | Cero debt markers en packages/bio/src |

`parlamentario_bio`=0 es un Known Stub DECLARADO (profesión no estructurada en fuentes probadas → 91), no un anti-patrón oculto; el gate de 91 (modelo + militancia + partido + comisiones) NO lo requiere.

### Human Verification Required

Ninguna. Toda la fase es conector/ingesta/DB verificable programáticamente contra PROD.

### Gaps Summary

Sin gaps. Los 17 must-haves de los 3 planes + los 4 Success Criteria del ROADMAP están verificados contra el código y contra PROD (live psql read-only). El code-review previo (2 críticos + 5 warnings) está `status: fixed` con commits; los fixes clave (CR-02 KEY_SEP, WR-01 guard senadores, WR-02 replay bajo dry-run) están presentes en el código verificado. La única "ausencia" (`parlamentario_bio`=0) es un stub intencional declarado en el ledger que no bloquea el gate de 91. Cero FK fabricado confirmado en la DB viva (invariante rector). Gate de 91 DESBLOQUEADO.

---

_Verified: 2026-07-22T10:20:00Z_
_Verifier: Claude (gsd-verifier)_
