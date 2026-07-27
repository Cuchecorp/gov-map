---
phase: 72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte
verified: 2026-07-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (migration correct-by-construction; PROD apply operator-gated)
overrides_applied: 0
human_verification:
  - test: "Aplicar 0052 a PROD y correr el pgTAP contra el schema APLICADO"
    expected: "0 not ok (7/7); count(*) from cruce_senal where tipo_senal='lobby_sector_aporte' = 0; MONEY_PUBLIC_ENABLED sigue OFF"
    why_human: "Task 2 de 72-02 es checkpoint blocking-human (autonomous:false, patrón operador-LOCAL). El agente NO toca PROD; build/typecheck son falso positivo de CI (Pitfall 5). La única prueba válida del DDL en PROD es el operador corriendo psql --db-url --single-transaction + pgTAP contra el remoto."
---

# Phase 72: DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte` Verification Report

**Phase Goal:** Sumar la señal de aporte por sector a la capa de cruces como conteo factual — el token ya está reservado para esta fase.
**Verified:** 2026-07-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is achieved **correct-by-construction at the migration level**, verified NOT by trusting the SUMMARY but by applying `0039` + `0052` verbatim to a live Postgres 17.6 scratch schema and running both pgTAP suites. The only outstanding item is the deliberately operator-gated PROD apply (blocking-human checkpoint, autonomous:false) — hence `human_needed`, which is the expected terminal state for an operator-LOCAL DDL phase whose migration is proven sound.

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `cruce_senal` incluye la señal de aporte por sector vía RUT de empresas ligadas, como CONTEO factual con evidencia jsonb (enlaces de fuente), NUNCA un score de correlación | ✓ VERIFIED | Nueva rama `lobby_sector_aporte` en `cruces.materializar_cruces()` (0052:114-170): `count(*)` factual + `jsonb_build_object` con `monto_verbatim`/`codigo_orden`/`enlace_fuente`/`fecha`. Join `contrato ⨝ contratista ⨝ empresa_sector` por RUT de empresa. Ningún score/correlación. Live pgTAP asserts 2,3,6 pass. |
| 2 | Migración aditiva (nuevo CHECK del token + rama del insert) y materializador FULL REBUILD transaccional | ✓ VERIFIED | Bloque 1: `drop constraint` + `add constraint ... in ('lobby_sector','lobby_sector_aporte')` (live: `CHECK ((tipo_senal = ANY (ARRAY['lobby_sector','lobby_sector_aporte'])))`). Bloque 2: `create or replace`, ÚNICO `delete from public.cruce_senal` (0052:76), rama `lobby_sector` **byte-idéntica** a 0039:91-120 (diff = IDENTICAL). |
| 3 | La señal solo cuenta parlamentarios con RUT presente (depende de RUT-01); sin RUT/edge rinde vacío honesto, no falso; NUNCA por parlamentario_id | ✓ VERIFIED | Puente = `cta.rut_proveedor = ct.rut_proveedor` (RUT de la EMPRESA), NO `parlamentario_id` (que solo acota universo, 0052:168). CTE `empresa_sector ... where false` → 0 filas correcto-por-construcción. Live pgTAP assert 3: rama aporte = 0 filas aun con contrato confirmado sembrado; assert 4: lobby_sector sobrevive (>=5). |
| 4 | Ninguna afirmación causal ("financió su voto") aparece en la señal ni en su etiqueta | ✓ VERIFIED | Scan del cuerpo: sin "a cambio de"/"financió su voto"/"contraprestación"/"quid pro quo". El único match de grep es la línea de cabecera que **describe la prohibición** (0052:52), no una afirmación. Token/label = `'lobby_sector_aporte'` neutro. Evidencia = enlaces + hechos públicos. |

**Score:** 4/4 truths verified (migration correct-by-construction)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql` | Migración aditiva: CHECK ampliado + `create or replace materializar_cruces()` con rama lobby verbatim + rama aporte stub | ✓ VERIFIED | 179 líneas. Aplica limpio verbatim a Postgres 17.6 (ALTER×2 + CREATE FUNCTION). Correcto por construcción. |
| `supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql` | pgTAP 7 aserciones (CHECK/lobby-preservado/empty-honest/PII-safe/no-PII/anon-42501) | ✓ VERIFIED | `plan(7)` exacto. **Corrido en vivo: 7/7 ok, 0 not ok, rollback limpio.** |
| `72-APPLY-RUNBOOK.md` | Runbook operador-LOCAL de apply + verificación pgTAP + rollback | ✓ VERIFIED | Creado (commit 41fc207). Documenta psql --db-url, verificación de constraint pre-drop, gate MONEY OFF, rollback aditivo. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| 0052 rama lobby_sector | 0039 rama lobby_sector | byte-exact copy | ✓ WIRED | `diff` de 0039:91-120 vs 0052:83-112 = IDENTICAL. El FULL REBUILD no vacía la señal lobby. |
| rama aporte | RUT de empresa | `cta.rut_proveedor = ct.rut_proveedor` (NO parlamentario_id) | ✓ WIRED | Entidad-compartida por RUT; parlamentario_id solo acota universo. "Máquina de sospechas" persona-nivel RECHAZADA (verificado: lobby_audiencia/lobby_contraparte NO aparecen en la rama aporte). |
| rama aporte | arista empresa→sector | CTE `empresa_sector where false` | ✓ WIRED (stub honesto) | 0 filas correcto-por-construcción; sustancia diferida de MONEY-03 documentada en mayúsculas en el SQL. |
| cron `cruces-materializar` (0039) | proc extendido | `create or replace` (misma firma) | ✓ UNTOUCHED | 0052 NO re-emite `cron.schedule`. Live: 1 job, schedule `23 3 * * *` (0039). Hereda la rama nueva. |
| RPC 0040 `cruces_de_parlamentario` | token nuevo | genérico por `tipo_senal` | ✓ UNTOUCHED | 0052 no toca 0040; no añade grants/policies. Deny-by-default heredado. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| rama `lobby_sector_aporte` | `cruce_senal` filas token aporte | CTE `empresa_sector` (`where false`) | No — 0 filas HONESTAS por diseño | ✓ STUB ESTRUCTURAL (correcto-por-construcción, NO hollow-bug) |

La rama rinde 0 filas por DOS razones honestas independientes: (a) la arista `<company-rut → sector>` no existe en el schema (razón estructural, `where false`), y (b) RUT-01 a 0% + backfill ChileCompra pendiente (razón de datos). Esto es CORRECTO por requisito (MONEY-03 sustancia diferida), no un stub-defecto: los tipos son correctos, el vacío es intencional y documentado, y la rama se poblará sin re-arquitectura cuando exista un `sector_id` clasificado por empresa.

### Behavioral Spot-Checks (Probe Execution — pgTAP corrido en vivo)

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 0052 pgTAP contra schema aplicado | `psql -tA -f supabase/tests/0052_*.test.sql` (Postgres 17.6 scratch, 0039+0052 verbatim) | `1..7` / 7× `ok` / 0 `not ok` / rollback | ✓ PASS |
| 0039 pgTAP regresión (bajo extensión) | `psql -tA -f supabase/tests/0039_*.test.sql` | `1..10` / 10× `ok` / 0 `not ok` | ✓ PASS |
| CHECK ampliado live | `pg_get_constraintdef` | `ARRAY['lobby_sector','lobby_sector_aporte']` | ✓ PASS |
| cron intacto | `select jobname,schedule from cron.job` | `cruces-materializar / 23 3 * * *` (1 job) | ✓ PASS |

**Verificación genuina (no confianza en SUMMARY):** apliqué 0039+0052 verbatim a un schema scratch con las dependencias mínimas (parlamentario/sector/lobby_audiencia/lobby_contraparte/contrato/contratista) en el Postgres 17.6 local (contenedor supabase_db, DB `postgres`, cero colisión de nombres), corrí ambos pgTAP, y desmonté todo (0 residuo: sin cron job, sin schema `cruces`, sin tablas). El claim del SUMMARY (7/7 ok) es CONSISTENTE y REPRODUCIDO.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MONEY-03 | 72-01 | Cruces dinero × sector como conteos factuales en `cruce_senal` (`lobby_sector_aporte`) — nunca correlación/causa | ✓ SATISFIED (sustancia diferida documentada) | Token + rama + evidencia PII-safe + CHECK ampliado; stub estructural honesto-vacío. La arista real empresa→sector es trabajo remanente documentado en el SQL y el runbook. |

Sin requisitos huérfanos: MONEY-03 mapea exclusivamente a Phase 72 en REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| 0052 | 130-137 | `where false` (rama aporte 0 filas) | ℹ️ Info | STUB ESTRUCTURAL intencional + documentado en mayúsculas como sustancia diferida MONEY-03. NO es un stub-defecto: tipos correctos, vacío honesto por requisito. No es blocker. |

Sin markers de deuda (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) en los archivos de la fase. Sin lenguaje causal. Sin PII (rut/partido/donante_id) bajo el guard `\y(partido|rut)\y` — `rut_proveedor`/`rut_empresa` no lo trip (verificado live, assert 5).

### Human Verification Required

#### 1. Aplicación de 0052 a PROD + pgTAP contra schema APLICADO (checkpoint blocking-human)

**Test:** Ejecutar el runbook `72-APPLY-RUNBOOK.md`:
1. `psql "$SUPABASE_DB_URL" -tAc "select conname from pg_constraint where conrelid='public.cruce_senal'::regclass and contype='c';"` → confirmar `cruce_senal_tipo_senal_check` (ajustar el drop si difiere — Pitfall A1).
2. `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0052_*.sql` (NUNCA `supabase db push`; UNA vez; esquivar BOM del .env).
3. `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0052_*.test.sql`.
4. `select count(*) from cruce_senal where tipo_senal='lobby_sector_aporte';`.
5. Confirmar `MONEY_PUBLIC_ENABLED` OFF.

**Expected:** pgTAP = 0 `not ok` (7/7); count = 0 HOY (vacío honesto correcto); MONEY sigue OFF.

**Why human:** Task 2 de 72-02 es checkpoint blocking-human por diseño (autonomous:false, patrón operador-LOCAL de 0023/0038/0039/0049). El agente NO toca PROD. build/typecheck son falso positivo de CI (Pitfall 5); la única prueba válida del DDL en el remoto la corre el operador. El flip legal de MONEY (Candado B) es acto humano separado de Phase 73.

**Resume-signal:** el operador escribe `"aplicado"` con el resultado del pgTAP y `count=0`, o describe el fallo (nombre de constraint distinto / error de apply / pgTAP rojo → rollback §6).

### Gaps Summary

**Sin gaps bloqueantes.** Los 4 success criteria del ROADMAP están VERIFIED correct-by-construction, validados en vivo (no por confianza en el SUMMARY): CHECK genuinamente ampliado, rama lobby_sector byte-preservada (diff IDENTICAL), rama aporte por RUT de empresa (NO parlamentario_id) rindiendo 0 filas honestas por CTE `where false`, evidencia PII-safe, sin causalidad, cron+RPC 0040 intactos. Ambos pgTAP (0052 7/7, 0039 10/10 regresión) pasan contra un schema aplicado real.

El único trabajo pendiente es la **aplicación a PROD**, deliberadamente diferida como checkpoint blocking-human de operador (autonomous:false) — por eso el status es `human_needed`, el estado terminal esperado para una fase de DDL operador-LOCAL cuya migración está probada sólida. La sustancia real de MONEY-03 (la arista `<company-rut → sector>`) queda como trabajo remanente honesto-documentado en el SQL y el runbook; el vacío de la señal HOY es correcto por requisito, no un bug.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
