---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
verified: 2026-07-14T04:35:00Z
status: human_needed
score: 4/4 must-haves verified (wire + guards); LIVE crawl = operator checkpoint
overrides_applied: 0
human_verification:
  - test: "Crawl LIVE de ChileCompra operador-LOCAL (2 etapas, cuota 10k/día, multi-día reanudable) siguiendo 70-BACKFILL-CHILECOMPRA-RUNBOOK.md"
    expected: "N contratos / K contratistas aterrizan en Supabase PROD con fuente/fecha/enlace + monto VERBATIM; `pnpm freshness` muestra la fila chilecompra pasando de STALE (n/d) a un ingestado_hasta real; MONEY_PUBLIC_ENABLED sigue OFF"
    why_human: "autonomous:false (70-03-PLAN) — consume MERCADOPUBLICO_TICKET secreto + cuota LIVE; depende DURO de RUT-01 (Phase 69) poblado en la maestra remota. El agente NO debe gastar cuota ni escribir a PROD. Los DATOS reales solo existen tras esta corrida; el wire + guards ya están verificados en código."
  - test: "Checkpoint RUT-01 (Phase 69) — poblar entidad_tercero.rut / parlamentario.rut en la maestra remota antes del crawl"
    expected: "count(entidad_tercero.rut) > 0 — sin RUTs cruzables el crawl no tiene universo"
    why_human: "Dependencia dura upstream (Phase 69), checkpoint operador pendiente; no verificable programáticamente sin acceso a PROD ni sin el write de RUT-01"
---

# Phase 70: DINERO P5b — Wire dos-etapas ChileCompra por RUT — Verification Report

**Phase Goal:** Poblar los contratos del Estado por RUT exacto vía ingesta de dos etapas — construido detrás del flag, con el mismo wire que mata la deuda de dos-etapas para ChileCompra.
**Verified:** 2026-07-14T04:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase splits cleanly into a **code contract** (the two-stage wire + RUT-exact fail-closed guard + gate OFF + freshness + redaction) which is **fully verifiable and VERIFIED**, and a **LIVE data outcome** (the actual contracts in PROD) which is an explicit `autonomous:false` operator-LOCAL checkpoint depending on RUT-01. Every code truth passed adversarial verification; the LIVE crawl routes to human by design (matches Phases 66/67).

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | ChileCompra fuente→R2→Supabase re-runnable (`--from-r2`), serial per RUT 2-3s, MERCADOPUBLICO_TICKET redacted in logs | ✓ VERIFIED (wire) / ? human (LIVE run) | `ingest-run.ts:251-302` Etapa 1 `putImmutable("dinero",…)` BEFORE upsert (304-338); `--from-r2` at :110-135 uses fake connector + disables r2Store (:134). Redaction test real (see (c)). Serial per-RUT loop (:144); rate-limit 2-3s is LOCKED in `HostRateLimiter` (LIVE-only). |
| 2 | Behind MONEY_PUBLIC_ENABLED OFF, contracts of RUT-linked companies exist w/ fuente/fecha/enlace, monto VERBATIM | ✓ VERIFIED (wire+gate) / ? human (data) | Gate OFF confirmed: `.env` absent, `.env.example=false`, `money-gate.ts` fail-closed `=== "true"` unchanged by phase. Contratista carries `enlace`+`fecha_captura` (:322-325). monto VERBATIM proven via LOCKED-2 guard + Test E. Actual rows = LIVE crawl (operator). |
| 3 | Juridica branch reconciles ONLY by exact RUT fail-closed — never correrPipeline/LLM/name-match | ✓ VERIFIED | `reconciliar-contrato.ts` git diff EMPTY (16ffe62~1→HEAD, exit 0). Guard `c.tipoPersona !== "natural"` (:310) returns before `correrPipeline` (:330); juridica resolves via `matchDeterministaEntidad` (:511). frozen-guard test with mutation self-check bites on every weakening (13 tests pass). |
| 4 | Quota (10k/day) → multi-day LOCAL resumable; freshness covers ChileCompra staleness | ✓ VERIFIED (freshness) / ? human (crawl) | `catalog.ts:275-281` chilecompra entry (contratos_ingesta_estado.ingestado_hasta, 30d). evaluate.test.ts 31 pass (incl. 5 chilecompra). Multi-day partition = runbook (281 lines) + SPIKE doc. Crawl = operator. |

**Score:** 4/4 code-contract truths VERIFIED; LIVE crawl + RUT-01 = human checkpoint (by design, autonomous:false).

### Adversarial Checks (a)–(f) — all PASS

| Check | Result | Evidence |
| ----- | ------ | -------- |
| (a) r2Store threaded on NORMAL path; put BEFORE Supabase write; put-failure GATES write (not just replay) | ✓ | Test A (order-capture via shared monotonic clock: put[0] < upsert[0]); Test C (throwing putImmutable → RUT in errores, upsertContratos NOT called, `contratos.size===0`). Runner :251-274 `continue` on catch. |
| (b) `--from-r2` doesn't fetch the source | ✓ | Test B: fake connector THROWS on both methods under `--from-r2`; `res.contratos===1` reconstructed from envelope. Guard: fromR2 without r2Store throws (B-guard). |
| (c) MERCADOPUBLICO_TICKET never plaintext (real redaction test) | ✓ | CLI test injects `ticket=<SECRET>` in an error URL → asserts output masks to `ticket=***` and no field contains SECRET. connector test asserts R2 envelope bytes never contain SECRET (:97-119). |
| (d) monto stored VERBATIM | ✓ | LOCKED-2 guard (interface `string\|null` + Zod `z.string().nullable()`, mutation self-check bites on `number`/`z.number()`). Test E: crude string byte-identical after replay; monto null by CR-02 design (not re-parsed). |
| (e) reconciliar-contrato.ts / model.ts / 0023 git diff EMPTY + frozen-guard bites | ✓ | `git diff --stat 16ffe62~1 HEAD -- <3 files>` exit 0 (empty). frozen-guard mutation self-check proves detector is not a no-op (base valid → 0 offenders; each broken axis → ≥1 offender). |
| (f) MONEY_PUBLIC_ENABLED OFF, not flipped | ✓ | Absent in `.env` (fail-closed default), `.env.example=false`, `money-gate.ts` git diff empty over phase. money-gate.test 5 pass (only literal "true" enables). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/dinero/src/ingest-run.ts` | runIngestDinero w/ r2Store/snapshotWriter/fromR2, Etapa1 put-gates-upsert | ✓ VERIFIED | putImmutable("dinero",…) :259; gate on catch :260-274; --from-r2 :110-135 |
| `packages/dinero/src/ingest-run.test.ts` | Fake-R2 tests A/B/C/D/E + order-capture | ✓ VERIFIED | 6 tests pass; MonotonicClock shared order proof; conectorQueLanza for 0-fetch |
| `packages/dinero/src/run-dinero-masivo-cli.ts` | Operator CLI builds real R2Store from .env + --from-r2 | ✓ VERIFIED | R2Store from R2_* :152-158; threads fromR2 :217; ticket env-only :148; redact all output |
| `packages/dinero/src/reconciler-frozen-guard.test.ts` | Guard bites on reconciler/model/0023 weakening | ✓ VERIFIED | Static guard + mutation self-check + no-false-positives; 13 tests pass |
| `packages/freshness/src/catalog.ts` | ChileCompra staleness signal | ✓ VERIFIED | Entry :275-281 (ingestado_hasta, 30d) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| ingest-run.ts | opts.r2Store.putImmutable | Etapa 1 R2 before upsert | ✓ WIRED (:259, precedes upsert :330) |
| run-dinero-masivo-cli.ts | runIngestDinero | threads r2Store/fromR2 | ✓ WIRED (:209-219) |
| catalog.ts chilecompra | evaluate.ts | declarative CATALOG entry | ✓ WIRED (reused as-is; 5 tests) |

### Behavioral Spot-Checks (test suites executed)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| dinero wire + guards | `pnpm --filter @obs/dinero test` | 128 passed / 16 files | ✓ PASS |
| freshness incl. chilecompra | `pnpm --filter @obs/freshness test` | 31 passed | ✓ PASS |
| frozen files unchanged | `git diff --stat 16ffe62~1 HEAD -- reconciliar-contrato.ts model.ts 0023_dinero.sql` | exit 0 (empty) | ✓ PASS |
| money-gate unchanged | `git diff --stat … money-gate.ts .env.example` | exit 0 (empty) | ✓ PASS |
| MONEY flag OFF | `grep MONEY_PUBLIC_ENABLED .env` | absent = OFF | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| MONEY-01 | Contratos del Estado por RUT exacto, gated OFF, fuente/fecha/enlace, monto VERBATIM | ✓ SATISFIED (wire) / partial (data pending LIVE crawl — operator) | Wire + gate + freshness verified; PROD data = operator checkpoint (documented, not closed) |
| DEBT-01 | Dos-etapas + `--from-r2` para ChileCompra (funde deuda) | ✓ SATISFIED | Etapa 1 R2 put-gates-upsert + `--from-r2` replay 0-fetch; tests A/B/C/D pass |

### Anti-Patterns Found

None. No unreferenced TBD/FIXME/XXX debt markers in modified files. The `ingest-run.ts:13` "R2 BLOQUEADO" text is in the top-of-file historical comment describing the OLD behavior and is superseded by the implemented wire; not a debt marker. `chilecompra-weekly.yml` absence is documented as intentional (flip = Phase 73), not a stub. `monto=null` is CR-02 design (ChileCompra listado has no guaranteed monto), not a hollow value.

### Human Verification Required

**1. LIVE crawl operador-LOCAL (SC#1 live run, SC#2 data, SC#4 crawl)**
- Test: Run `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` end-to-end (2 etapas, cuota 10k/día, multi-día reanudable, replay `--from-r2` para Etapa 2).
- Expected: N contratos / K contratistas en Supabase PROD con fuente/fecha/enlace + monto VERBATIM; `pnpm freshness` chilecompra STALE → ingestado_hasta real; `MONEY_PUBLIC_ENABLED` sigue OFF.
- Why human: `autonomous:false` (70-03-PLAN) — consume ticket secreto + cuota LIVE; el agente no debe gastar cuota ni escribir a PROD.

**2. Checkpoint RUT-01 (Phase 69)**
- Test: `count(entidad_tercero.rut) > 0` en la maestra remota.
- Expected: hay RUTs cruzables antes del crawl (dependencia dura del universo).
- Why human: write RUT-01 es checkpoint operador pendiente (Phase 69); no verificable sin PROD.

### Gaps Summary

No code gaps. The entire two-stage wire, RUT-exact fail-closed reconciliation (frozen + guarded), MONEY gate OFF (unflipped), ticket redaction (real test), monto VERBATIM (guard + replay test), and ChileCompra freshness signal are VERIFIED against the actual codebase and by running both test suites (128 + 31 pass). The only outstanding items are the operator-LOCAL LIVE crawl and its RUT-01 dependency — both explicitly `autonomous:false` and routed to human, exactly as the phase design intends (mirror of Phases 66/67). Status is `human_needed`: the wire is solid; the DATA outcome awaits the operator.

---

_Verified: 2026-07-14T04:35:00Z_
_Verifier: Claude (gsd-verifier)_
