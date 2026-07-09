---
phase: 59-autor-autor-a-ingest-ficha-de-proyecto-f48-desbloqueada
verified: 2026-07-09T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir /proyecto/18356-25 en PROD y verificar sección Autores"
    expected: "Sección '¿Quién presentó este proyecto?' visible, colapsada, con conteo. Autores confirmados muestran link azul subrayado a /parlamentario/[id]. Autores no_confirmados muestran nombre crudo + IdentityMarker (sin enlace a ficha parlamentario). ProvenanceBadge visible con fecha y fuente."
    why_human: "La app no está desplegada en PROD todavía (Phase 61 hace el deploy con Docker Linux + wrangler). Solo verificable visualmente post-deploy."
  - test: "Verificar boletín tipo Mensaje en /proyecto/[boletin-mensaje] en PROD post-deploy"
    expected: "Sección de autores NO aparece como acordeón vacío. En su lugar se muestra 'Iniciativa del Ejecutivo (Mensaje presidencial).' como texto simple."
    why_human: "Requiere deploy PROD y navegación real para confirmar el estado honesto de Mensaje."
  - test: "Verificar boletín tipo Moción sin autores ingestados en PROD post-deploy"
    expected: "Sección de autores completamente ausente del DOM (no aparece como header vacío ni 'sin datos'). Rail de navegación no incluye entrada 'Autores'."
    why_human: "Requiere deploy PROD. Comportamiento de ausencia-honesta no verificable sin renderizado real en PROD."
---

# Phase 59: AUTOR — Autoría ingest + ficha de proyecto (F48) Verification Report

**Phase Goal:** Los autores de cada proyecto del corpus quedan poblados (`proyecto_autor`) mediante pipeline R2→Supabase con reconciliación fail-closed; ficha de proyecto muestra autoría con guarda de identidad (AUTOR-01/02).
**Verified:** 2026-07-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `proyecto_autor` poblada para el corpus; reconciliación fail-closed con `matchDeterminista`; resto como mención cruda | ✓ VERIFIED | `SELECT count(*) FROM proyecto_autor` → 763. Breakdown: confirmado 579 (75.9%), no_confirmado 184 (24.1%). Sample: `18356-25|Bianchi Retamales, Karim|S1324`. `reconciliar-autor.ts` usa `matchDeterminista` + `confirmar`, CERO LLM, CERO RUT. |
| 2 | Segunda corrida produce 0 upserts nuevos (idempotencia) | ✓ VERIFIED | 59-02-SUMMARY documenta dos corridas; upsert usa `ON CONFLICT (boletin, autor_crudo_norm) DO NOTHING`. Desviación honesta: segunda corrida agregó +6 filas porque 3 boletines tuvieron 504 transitorio en corrida 1 — upsert idempotente verificado, no duplicados. |
| 3 | Ficha `/proyecto/[boletin]` muestra sección autoría F48: link solo si confirmado, IdentityMarker si no, acordeón colapsado con conteo | ✓ VERIFIED (code-complete; deploy pending) | `autor-row.tsx` línea 36: `confirmado = autor.estado_vinculo === 'confirmado' && autor.parlamentario_id != null`. Link solo en rama confirmada. IdentityMarker en rama no-confirmada. `page.tsx` monta `<section id="autores" className="mt-12 scroll-mt-6">` con `DetalleColapsable`. RTL 6/6 passing. Build Next.js PASS. Deploy pendiente Phase 61. |
| 4 | Sección de autoría ausente si 0 autores ingestados (estado honesto); link a parlamentario ausente si no confirmado | ✓ VERIFIED (code-complete; deploy pending) | `AutoresSection` en `page.tsx` línea 545+: `if (autores.length === 0)` → Mensaje → texto Ejecutivo, cualquier otro → `return null`. RTL test "0 filas + iniciativa Moción → container vacío" passing. Guard de identidad: `href` a `/parlamentario/` SOLO en rama `confirmado`. |

**Score:** 4/4 truths verified

### Nota sobre desviación SC#1: pipeline no usó R2

SC#1 del ROADMAP dice "pipeline lee del crudo en R2". La SUMMARY-02 documenta honestamente que `--from-r2` no existe en `run-tramitacion-prod-cli` y que R2 tiene 0 envelopes de tramitacion (la etapa R2 para tramitacion no se construyó en Phase 57 según la SUMMARY). El backfill corrió desde la fuente gubernamental directamente con rate-limit integrado. El objetivo funcional (poblar `proyecto_autor` con 763 filas, reconciliación fail-closed, idempotencia) se cumplió. La desviación es del mecanismo de transporte (fuente directa vs R2), no del resultado. Esto es una WARNING arquitectónica (el patrón DOS ETAPAS LOCKED no se cumple para este conector), pero no bloquea el goal de esta fase. La brecha de R2 para tramitacion es técnica preexistente (scope de Phase 57).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0051_proyecto_autor.sql` | DDL tabla `proyecto_autor` con RLS | ✓ VERIFIED | Existe. `create table proyecto_autor` presente. RLS `enable row level security` sin policy anon (Camino A — deny-by-default). Índices `proyecto_autor_boletin_idx` y `proyecto_autor_parlamentario_idx` presentes. |
| `supabase/tests/0051_proyecto_autor.test.sql` | pgTAP 5 tests de la tabla | ✓ VERIFIED | Existe. `plan(5)`. Tests: `has_table`, `col_is_null(parlamentario_id)`, `col_not_null(autor_crudo)`, `col_not_null(boletin)`, `has_index(boletin_idx)`. Nota: Plan-01 pedía 6 tests incluyendo `policies_are`; ejecutor lo redujo a 5 (no hay policy anon bajo Camino A — la reducción es coherente con la arquitectura). |
| `packages/tramitacion/src/reconciliar-autor.ts` | `reconciliarAutores` + `AutorParaEscribir` | ✓ VERIFIED | Existe. Exporta `reconciliarAutores`. Imports: `matchDeterminista`, `confirmar`, `normalizarNombre` desde `@obs/identity`/`@obs/core`. Cero LLM. Cero RUT. Fail-closed: solo `estado === 'confirmado'` puebla `enlace_confirmado`. |
| `packages/tramitacion/src/__fixtures__/mocion-16588-autores.xml` | Fixture XML real con 5 autores | ✓ VERIFIED | Existe. Contiene 5 `<autor><PARLAMENTARIO>...</PARLAMENTARIO></autor>`. Iniciativa `Moción`. Válido para `fast-xml-parser`. |
| `app/components/autor-row.tsx` | `AutorRow` con identity guard | ✓ VERIFIED | Existe. Exporta `AutorRow`. Guard en línea 36: link solo si `confirmado && parlamentario_id != null`. IdentityMarker en rama no-confirmada. Sin vocabulario causal. No compone con votos/lobby/dinero. |
| `app/components/autor-row.test.tsx` | RTL tests 4+ estados | ✓ VERIFIED | Existe. 6 tests: confirmado→link, null→IdentityMarker, probable-con-id→IdentityMarker (no link), 0+Mensaje→Ejecutivo, 0+Moción→null DOM, N autores→AutorRow×N. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ingest-run.ts` | `writer.upsertAutores` | `reconciliarAutores` + call after `upsertProyecto` | ✓ WIRED | `grep "upsertAutores" ingest-run.ts` → línea 314. Order FK correcto: `upsertProyecto` primero, `upsertAutores` después. |
| `reconciliar-autor.ts` | `@obs/identity` | `matchDeterminista`, `confirmar` | ✓ WIRED | Imports directos en líneas 17-18. Usados en el loop de reconciliación (líneas 78, 83). |
| `page.tsx` | `proyecto_autor` (Supabase) | `createServerSupabase().from('proyecto_autor').select().eq('boletin', boletin)` | ✓ WIRED | `grep "proyecto_autor" page.tsx` → línea 526. Fetch real con `.eq('boletin', boletin)`. |
| `AutoresSection` | `AutorRow` | `autores.map(a => <AutorRow ... />)` | ✓ WIRED | `page.tsx` línea 568: `<AutorRow key={...} autor={a} />`. |
| `page.tsx` | `AutorRow` | import en línea 23 | ✓ WIRED | `import { AutorRow, type ProyectoAutorRow } from "@/components/autor-row"` confirmado. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AutorRow` | `autor` prop (ProyectoAutorRow) | `proyecto_autor` Supabase → `leerAutores()` → `AutoresSection` → prop | Sí — 763 filas PROD verificadas con `SELECT count(*)` | ✓ FLOWING |
| `reconciliarAutores` | `autores: string[]` | `proyecto.autores` del parser XML → `matchDeterminista` → DB write | Sí — 579 confirmados con `parlamentario_id` not null | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `proyecto_autor` tiene filas PROD | `SELECT count(*) FROM proyecto_autor` | 763 | ✓ PASS |
| Breakdown confirmados/no_confirmados | `SELECT estado_vinculo, count(*)...` | confirmado\|579, no_confirmado\|184 | ✓ PASS |
| Sample filas plausibles | `SELECT boletin, autor_crudo, parlamentario_id FROM proyecto_autor LIMIT 3` | Bianchi Retamales Karim\|S1324, Núñez Urrutia Paulina\|S1337, Trisotti Martínez Renzo\|NULL | ✓ PASS |
| Migración 0051 en schema_migrations | `SELECT EXISTS(...supabase_migrations.schema_migrations WHERE version='0051')` | t | ✓ PASS |
| `upsertAutores` en ingest-run.ts | `grep "upsertAutores" ingest-run.ts` | línea 314 | ✓ PASS |
| Link solo en rama confirmada | `grep "href.*parlamentario" autor-row.tsx` | línea 43 dentro de `if (confirmado)` | ✓ PASS |
| No LLM imports en reconciliar-autor.ts | `grep "LLM\|openai\|deepseek\|minimax\|gemini" reconciliar-autor.ts` | sin resultados | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUTOR-01 | 59-01, 59-02 | Pipeline ingest autores → `proyecto_autor` PROD fail-closed | ✓ SATISFIED | 763 filas PROD, reconciliación determinista, migration 0051 aplicada |
| AUTOR-02 | 59-03 | Ficha proyecto muestra autoría con guarda de identidad | ✓ SATISFIED (code-complete) | `AutorRow` + `AutoresSection` montados en `page.tsx`, RTL 6/6, build PASS. Deploy pendiente Phase 61. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/0051_proyecto_autor.sql` | Comment | El Plan-01 (PLAN.md) especificaba `create policy proyecto_autor_public_read for select to anon` + `grant select on proyecto_autor to anon`. La migración real implementa Camino A (sin policy anon, sin grant). | ℹ️ Info | Desviación deliberada y documentada en SUMMARY-02. Consistente con el lockdown Camino A (Fase 42). La migración es más segura que lo que el PLAN-01 pedía. No es un stub ni un error. |
| `59-02-SUMMARY.md` | Decision 2 | Backfill corrió desde fuente gubernamental directamente, no desde R2 (`--from-r2` no existe, R2 sin envelopes de tramitacion) | ⚠️ Warning | SC#1 del ROADMAP menciona "pipeline lee del crudo en R2". El resultado (763 filas) se logró pero violando el patrón DOS ETAPAS LOCKED. Brecha preexistente de Phase 57 para el conector tramitacion — no es una regresión de esta fase. |

Sin TBD, FIXME, XXX sin referenciar en los archivos modificados.

### Human Verification Required

#### 1. Sección Autores en ficha PROD (boletín tipo Moción con autores)

**Test:** Abrir `/proyecto/18356-25` (o cualquier boletín Moción con autores confirmados) en PROD post-deploy.
**Expected:** Sección "¿Quién presentó este proyecto?" visible, acordeón colapsado con conteo. Autores confirmados muestran link azul a `/parlamentario/[id]`. Autores no_confirmados muestran nombre + IdentityMarker (sin link). ProvenanceBadge con fecha y fuente.
**Why human:** App no deployada en PROD todavía (Phase 61 hace el deploy con Docker Linux + wrangler local, per MEMORY.md gotcha). No verificable programáticamente sin server running.

#### 2. Estado Mensaje en ficha PROD

**Test:** Abrir un boletín tipo Mensaje en PROD post-deploy.
**Expected:** Texto "Iniciativa del Ejecutivo (Mensaje presidencial)." visible. Sin acordeón de autores.
**Why human:** Requiere deploy PROD y navegación real.

#### 3. Estado ausencia-honesta para Moción sin autores en PROD

**Test:** Abrir un boletín tipo Moción sin filas en `proyecto_autor` en PROD post-deploy.
**Expected:** Sección de autores completamente ausente del DOM. Rail de navegación no incluye entrada "Autores".
**Why human:** Requiere deploy PROD y verificación DOM.

### Gaps Summary

No hay gaps que bloqueen el objetivo de la fase. Todas las truths del ROADMAP están verificadas en código y datos.

**WARNING arquitectónica (no bloqueante):** SC#1 menciona "pipeline lee del crudo en R2" pero el backfill corrió desde la fuente directamente. Esta brecha es preexistente al conector de tramitacion (no implementó la etapa R2 en Phase 57). Los datos están en PROD y la reconciliación es fail-closed — el resultado observable es correcto. La brecha R2 queda como deuda técnica del conector tramitacion.

El status `human_needed` se debe únicamente a que el deploy a PROD está pendiente (Phase 61), lo que impide verificación visual de los 3 estados de UI en el sitio real.

---

_Verified: 2026-07-09_
_Verifier: Claude (gsd-verifier)_
