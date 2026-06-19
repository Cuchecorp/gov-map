---
phase: 16-money-agregaci-n-contratos-aportes-por-contraparte
verified: 2026-06-19T19:10:00Z
status: human_needed
score: 3/3 must-haves verified
mode: mvp
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification. Code-review (16-REVIEW.md) already resolved CR-01 + WR-01..WR-05 in code; this verification confirms the shipped fixes against the codebase and runs the tests."
human_verification:
  - test: "Apply migration 0025_agregacion.sql to the remote Postgres (sa-east-1), then run pgTAP 0026_agregacion.test.sql against the APPLIED schema."
    expected: "All 22 asserts PASS — RPC exists + security-definer + anon EXECUTE + public NOT; functiondef filters 'juridica' and contains none of rut_donante/donante_id/contratista.nombre/donante.nombre; data-level CR-01 (jurídica projects, natural returns 0 rows, natural name never in any payload); contrato.rut_proveedor column exists; contratista AND donante still deny-by-default; WR-05 cap helper exists + not granted to anon + conteo is real count(*) while filas is capped."
    why_human: "CI/typecheck do NOT execute DDL (Pitfall 2 — build-green is a false positive). The RPC and the contrato.rut_proveedor column do not exist in production until the operator applies the migration. The migration was edited TWICE in code-review (WR-03 listing-RPC removal + WR-05 payload cap), so remote re-apply is mandatory; the pgTAP was bumped to 22 asserts and must be run against the applied schema. .env has a UTF-8 BOM → pass --db-url explicitly from git-bash, not PowerShell (per MEMORY env-credentials-reality.md)."
  - test: "Run the LIVE ChileCompra (Phase 14) and SERVEL (Phase 15) ingests so the contrato/aporte fact tables hold real jurídica rows, then visit /contraparte/<id> for a known company."
    expected: "Contratos and aportes lanes render real traced rows (ProvenanceBadge + fecha + enlace). Until the ingests run, both lanes honestly render the weak 'aún no consolidado… esto no significa que no existan' empty state — not an error, not a verified-zero."
    why_human: "Phase 16 is a pure consumer; it ships zero connectors and zero ingest. Real data appears only after the operator runs the Phase 14/15 LIVE ingest checkpoints. Requires running external scrapers against gov sources (rate-limited, out-of-band)."
  - test: "After legal sign-off (F13), set MONEY_PUBLIC_ENABLED=true and confirm /contraparte/[id] renders; confirm with the flag UNSET the route returns the 404 surface (not-found.tsx) with no MONEY heading, h1, lane heading, or RPC call in the served HTML."
    expected: "Flag UNSET (default): whole route 404s before any RPC/heading (verified by RTL but confirm in a running build). Flag ON after legal sign-off: the jurídica header + two mt-12 lanes render."
    why_human: "Enabling MONEY_PUBLIC_ENABLED requires the human legal sign-off (F13 operator debt, docs/legal/13-LEGAL-DOSSIER.md). The default-OFF gate is intentional; flipping it is a human/legal decision, not a code change. End-to-end served-HTML confirmation needs a running Next build."
---

# Phase 16: MONEY Agregación — Contratos/aportes por contraparte — Verification Report

**Phase Goal:** El ciudadano puede ver contratos y aportes agregados por contraparte (donante o empresa), usando las sub-maestras construidas en los bloques MONEY — hechos agregados con fuente, sin insinuación.
**Verified:** 2026-06-19T19:10:00Z
**Status:** human_needed
**Mode:** mvp
**Re-verification:** No — initial verification (code-review fixes confirmed against shipped code)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Ciudadano ve contratos/aportes agregados por contraparte usando las sub-maestras, cada fila trazable a fuente/fecha/enlace | ✓ VERIFIED | RPC `agregado_por_contraparte` aggregates `contrato`/`aporte` by contraparte (`0025_agregacion.sql:77-169`); each `filas` jsonb object carries `origen/fecha_captura/fecha_corte/enlace/licencia`. Lanes render a mandatory `<ProvenanceBadge capturedAt sourceName sourceUrl={enlace}/>` per row (`contratos-por-contraparte.tsx:162-168`, `aportes-por-contraparte.tsx:181-188`). `pnpm test contraparte` → 22/22 pass. |
| 2 | La vista NO compone una contraparte de dinero junto a un voto en una unidad de UI; sin lenguaje causal/afinidad | ✓ VERIFIED | `page.tsx` imports/renders NO votes component (grep `votos\|VotosSection` → none). Contratos and aportes are SIBLING `<section>`s separated by `mt-12` (`page.tsx:71-93`). RTL asserts the rendered DOM matches no causal/affinity regex (component tests pass). No money total/ranking/% anywhere. |
| 3 | La agregación describe hechos públicos independientes (X aparece N veces) sin afirmar conexión ni intención | ✓ VERIFIED | Count-only neutral aggregate (`conteo = count(*)`); zero `SUM(`/`::numeric` in the RPC or components; count line "{N} contrato(s)/aporte(s) registrado(s)." Honest 2-state empty copy ("aún no consolidado… esto no significa que no existan") never asserts verified-zero. |

**Score:** 3/3 truths verified

### Load-Bearing Property Verification

| Property | Status | Evidence |
| -------- | ------ | -------- |
| PII guarantee — RPC filters `tipo_persona='juridica'`, never projects persona-natural name / donante_id / rut_donante; never references sub-maestras | ✓ VERIFIED | RPC body keys off fact-row columns only (`contrato.proveedor_nombre`/`aporte.donante_nombre`), filters `where ... tipo_persona = 'juridica'` on the FACT row (`0025_agregacion.sql:118,163`); grep confirms NO `public.contratista`/`public.donante`, NO `donante_id`/`rut_donante`, NO `SUM(`/`::numeric`. pgTAP 0026 introspects functiondef (4 negative `not ilike` guards) + data-level inserts proving a natural returns 0 rows and its name never appears in any payload (`0026_agregacion.test.sql:104-123`). |
| CR-01 fixed — SERVEL parser normalizes `tipo_persona` to `'juridica'\|'natural'` enum so the filter MATCHES stored data; fail-closed | ✓ VERIFIED | `normalizarTipoPersona()` (`parse-servel.ts:41-60`): accent-insensitive, maps any "juridica" mention → `'juridica'`, everything else (natural/unknown/empty/null) → `'natural'` (fail-closed). Wired at `parse-servel.ts:263` (`tipoPersona: normalizarTipoPersona(cruda.tipoAportante)`). Type tightened to enum (`model-servel.ts:58`, zod `z.enum(["juridica","natural"])` at `:89,141`). Writer persists it (`writer-supabase-servel.ts:56` `tipo_persona: f.tipoPersona`). Tests assert "Persona Jurídica"→'juridica', natural never reaches filter (`parse-servel.test.ts:144-187`). `npx vitest run packages/dinero` → 88/88 pass. The aportes lane is no longer dead. |
| Whole-page gate fail-closed — `moneyPublicEnabled(process.env)` → `notFound()` as FIRST statement; non-jurídica → notFound() | ✓ VERIFIED | `page.tsx:48-50` — `if (!moneyPublicEnabled(process.env)) notFound();` is the first statement, before `await params` and any RPC/heading. `HeaderSection` (`page.tsx:122-125`) `tipo_persona` not 'jur' → `notFound()` (defense-in-depth). Gate is fail-closed (`money-gate.ts:33` — only literal "true" enables; default OFF). RTL (page.test.tsx, 7 tests) proves gate-OFF never builds the client/RPC. |
| Anti-insinuación — no vote data/import; separate lanes; count-only; honest states | ✓ VERIFIED | See Truths 2 & 3. Attribution per dataset: ChileCompra "mención de la fuente", SERVEL "términos de uso por verificar"; no "CC BY 4.0" in any Phase 16 shipped file. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0025_agregacion.sql` | rut_proveedor reconcile + jurídica-only aggregation RPC | ✓ VERIFIED (code) | RPC + cap helper + revoke/grant; WR-03 listing RPC removed; WR-05 cap applied. NOT yet applied to remote (operator). |
| `supabase/tests/0026_agregacion.test.sql` | pgTAP PII + deny-by-default + data-level asserts | ✓ VERIFIED (code) | `plan(22)`; existence/grants + functiondef PII + contrato.rut_proveedor + both sub-maestras deny-by-default + CR-01 data-level + WR-05 cap. Must run against APPLIED schema (operator). |
| `app/app/contraparte/[id]/page.tsx` | page-level notFound gate + CONTRAPARTE_ID_RE + two mt-12 lanes | ✓ VERIFIED | Gate first; regex validated before DB; sibling lanes; no votes. |
| `app/app/contraparte/[id]/not-found.tsx` | sober 404 (also gate-OFF surface), no MONEY heading | ✓ VERIFIED | "Contraparte no encontrada" + Volver al inicio; no MONEY content. |
| `app/components/contratos-por-contraparte.tsx` | gate → RPC → 2-state View → ProvenanceBadge | ✓ VERIFIED | Section + View; conteo from real `conteo`; pagination over capped filas. |
| `app/components/aportes-por-contraparte.tsx` | gate → RPC → 2-state View → ProvenanceBadge; donante RUT never rendered | ✓ VERIFIED | Grouped by elección DESC; candidate as separate muted fact; no RUT. |
| `app/lib/buscar.ts` CONTRAPARTE_ID_RE | validate id before DB; Unicode-safe (WR-02) | ✓ VERIFIED | `/^[cd]:[\p{L}\p{N} .\-_&]+$/u` — anchored, linear, accent/ñ-safe, no traversal. |
| `app/lib/types.ts` AgregadoContraparteRpcRow | RPC output shape | ✓ VERIFIED | `facet:'contrato'\|'aporte'`, contraparte_nombre, tipo_persona, conteo, filas. |
| `packages/dinero/src/parse-servel.ts` + `model-servel.ts` (CR-01) | normalize tipo_persona to enum, fail-closed | ✓ VERIFIED | See CR-01 row above. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| page.tsx | moneyPublicEnabled(process.env) | first-statement notFound gate | ✓ WIRED | `page.tsx:48` |
| contratos/aportes Section | agregado_por_contraparte RPC | createServerSupabase().rpc | ✓ WIRED | both Sections call `sb.rpc("agregado_por_contraparte",{p_id:id})` |
| 0025 migration | contrato.rut_proveedor | GROUP BY on writer-persisted column | ✓ WIRED (code) | `alter table ... add column if not exists rut_proveedor` |
| SERVEL writer | aporte.tipo_persona | f.tipoPersona (canonical enum) | ✓ WIRED | `writer-supabase-servel.ts:56` ← normalized at parse |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Contraparte UI + route tests | `pnpm test contraparte` | 22/22 passed (3 files) | ✓ PASS |
| SERVEL parser CR-01 + dinero suite | `npx vitest run packages/dinero` | 88/88 passed (11 files) | ✓ PASS |

### Probe Execution

pgTAP `0026_agregacion.test.sql` is a remote-applied-schema probe. It CANNOT be run here (no DDL applied to remote; operator checkpoint) → routed to human verification, not executed. Status: deferred to operator (see human_verification item 1).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MONEY-05 | 16-01, 16-02 | Vistas agregadas por contraparte usando sub-maestras; hechos con fuente, sin insinuación | ✓ SATISFIED (code) | DB half (RPC) + UI half (route/lanes) shipped; tests green. Live data + remote apply are operator checkpoints. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No debt markers (TODO/FIXME/XXX/TBD) in any Phase 16 shipped file | ℹ️ Info | The only "TODO" grep hit is the Spanish word "computo" in an unrelated `packages/llm/src/types.ts`; "CC BY 4.0" appears only in unrelated `parlamentario/[id]/page.tsx`. Phase 16 files clean. |
| app/lib/buscar.test.ts | 156 | Pre-existing tsc strictness error (DI-16-01) | ℹ️ Info | From phase 07 (`86073bf`), present before Phase 16; zero Phase 16 diff. Logged in deferred-items.md. Not a Phase 16 gap. |

### Human Verification Required

1. **Apply migration 0025 + run pgTAP 0026 against the remote** — CI does not execute DDL; the migration was re-edited twice in code-review (WR-03 + WR-05), so remote re-apply is mandatory and pgTAP (now 22 asserts) must pass against the applied schema. Use git-bash + explicit `--db-url` (.env BOM).
2. **Run the LIVE ChileCompra/SERVEL ingests (Phases 14/15 operator checkpoints)** — Phase 16 is a pure consumer; lanes are honestly empty until real jurídica rows are ingested.
3. **Enable `MONEY_PUBLIC_ENABLED` after legal sign-off (F13)** — default-OFF gate is intentional; flipping it is a human/legal decision; confirm gate-OFF 404 + gate-ON render in a running build.

### Gaps Summary

No code gaps. All three ROADMAP success criteria are observably true in the shipped code, and every load-bearing security/honesty property holds:

- The PII chokepoint (`agregado_por_contraparte`) filters jurídica on the fact row, never touches the deny-by-default sub-maestras, and never projects a donor RUT/key — proven by functiondef introspection AND data-level pgTAP asserts.
- CR-01 is genuinely fixed: the SERVEL parser normalizes `tipo_persona` to the canonical `'juridica'|'natural'` enum (fail-closed), the writer persists it, and unit tests lock the behavior — so the aportes-lane PII filter now matches stored data instead of being dead/coincidental.
- The whole-page gate is fail-closed and is the first statement; non-jurídica → notFound; no vote data/import anywhere; separate `mt-12` lanes; count-only with honest 2-states.
- Tests run clean: contraparte 22/22, dinero 88/88.

Status is **human_needed** (not gaps_found) solely because the phase ships GATED OFF with three intentional OPERATOR checkpoints — remote migration re-apply + pgTAP, LIVE ingest, and the legal-signoff gate enable. These are deliberate deferrals documented in the plans/summaries/CONTEXT, not missing implementation.

---

_Verified: 2026-06-19T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
