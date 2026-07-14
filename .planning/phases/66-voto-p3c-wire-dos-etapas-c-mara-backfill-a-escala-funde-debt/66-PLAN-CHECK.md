# Phase 66 - Plan Check Verdict

**Phase:** 66 - VOTO P3c - Wire dos-etapas Camara + backfill a escala (funde DEBT-01)
**Plans checked:** 2 (66-01 auto, 66-02 operator-LOCAL)
**Verdict:** PASS WITH CONCERNS
**Date:** 2026-07-13

## Goal-backward summary

Phase goal: poblar el voto individual de Camara a escala por ingesta dos-etapas
(fuente->R2->Supabase), fundiendo DEBT-01 (dos-etapas / --from-r2) y cumpliendo VOTO-01.
Requirements VOTO-01 + DEBT-01 aparecen en `requirements:` de AMBOS planes. Coverage OK.

The research finding is correct and verified against source: the two-stage pattern
(incl. --from-r2) already exists in ingest-cli.ts + runIngest. The phase is genuine
plumbing, not net-new subsystems.

## Verified claims (all TRUE against real code)

- (a) plan forwards r2Store/snapshotWriter/fromR2 into runIngest; runner really lacks it today
  -> TRUE. run-camara-votos.ts:155-164 calls runIngest WITHOUT the 3 opts. RunIngestOpts
     (ingest-run.ts:91-97) accepts r2Store/snapshotWriter. Etapa 1 R2 runs at 275-318 BEFORE
     upsert at 332-345 -> Etapa-1-primero is real.
- (b) --from-r2 genuinely avoids re-fetch (Fetcher not called), mirrors ingest-cli
  -> TRUE. ingest-cli.ts:221-263 reads getObject, builds camaraFake/senadoFake, calls runIngest
     with fakes - zero source fetch. Plan Task 2 mirrors this envelope shape.
- (c) LIVE WAF backfill + PROD write are operator-LOCAL / autonomous:false, NOT auto-run
  -> TRUE. Plan 02 autonomous:false; Task 2 is checkpoint:human-action gate="blocking";
     command gated by VOTOS_LIVE=1; live test file exists + glob-excluded. Agent does not run it.
- (d) reconciler/parser/golden NOT modified
  -> TRUE. files_modified lists only votos runner/cli/cobertura/tests + runbook. Task 2
     acceptance asserts git diff empty on reconciliar-camara/parse-camara-votacion/golden-dipid
     + migrations.
- (e) idempotency key + coverage invariant testable offline
  -> TRUE. Writer upserts onConflict votacion_id,fuente_voter_id (0009 adds the column + unique).
     estado_vinculo (0008), ausente CHECK (0019). Golden PERIODO_VIGENTE=2026-2030 +
     id_diputado_camara support the invariant query. Tests use FakeR2Store + in-memory writer +
     fake supabase-js client.
- SC#4 confirmado% does not drop at scale
  -> TRUE by design. reconciliarVotosCamara never name-matches; D-SC4-MET reports absolute N/M
     AND the hard invariant "0 DIPID-maestra vigente no_confirmado" (correct metric per Pitfall 3).

Import correctness: R2Store/SnapshotWriter are exported from @obs/ingest (ingest/src/index.ts:36-40);
@obs/ingest is a votos dependency (package.json:16) and run-camara-votos.ts:20 already imports
Fetcher/HostRateLimiter/RobotsGuard from it. Plan import instruction is accurate.

Dependency graph: 66-01 (wave 1, depends_on []) -> 66-02 (wave 2, depends_on ["66-01"]).
Acyclic, valid. Scope: 66-01 = 3 tasks / 5 files (within budget); 66-02 = 1 doc + 1 checkpoint.
No scope blocker.

## Concerns (WARNING - execution can proceed, executor must be alert)

### W-1 [key_links_planned] fromR2 replay must reuse the ALREADY-resolved writer, not re-derive it
Severity: warning. Plan 01.
ingest-cli.ts handles fromR2 inside main() BEFORE it resolves the normal writer, so it
re-derives dryRun + constructs its own writer inside the block. In runCamaraVotos the writer is
resolved EARLIER (lines 140-153). Task 2's action correctly says to call
runIngest({ boletines:[envelope.boletin], maestra, camara:camaraFake, senado:senadoFake,
writer, log }) using the already-resolved writer - the RIGHT adaptation, NOT a verbatim copy.
Risk: an executor told to "copy VERBATIM the ingest-cli block" may re-introduce a second writer
resolution and diverge. Fix hint: stress that the fromR2 block in runCamaraVotos threads the
already-resolved writer/maestra - verbatim on envelope+fakes shape but NOT on writer construction.

### W-2 [key_links_planned] masivo CLI has no R2Store today -> --from-r2 is inert unless one is built
Severity: warning. Plan 01, Task 3.
run-votos-masivo-cli.ts currently constructs NO R2Store (grep empty). For --from-r2 to read the
envelope, the CLI must build an R2Store from R2_* env vars (mirroring ingest-cli.ts:207-213) and
pass it as r2Store to runCamaraVotos. Task 3's action DOES mention this ("junto al r2Store
construido de env vars R2_*") but acceptance only greps from-r2|fromR2, not the R2Store
construction. Risk: --from-r2 wired as a flag but with no store -> runtime throw or silent no-op.
Fix hint: add an acceptance assertion that run-votos-masivo-cli.ts constructs an R2Store from
R2_* env and forwards it; AND that the NORMAL (non-replay) path also passes r2Store so Etapa 1
actually produces the first vote snapshots (SC#1). Without threading r2Store on the normal path,
the backfill populates Supabase but writes 0 R2 crudo - missing the DEBT-01 core.

### W-3 [coverage-gap watch] "the first vote snapshots" depends on r2Store on the normal path
Severity: warning. Plan 01 + Plan 02.
The headline outcome ("votos producen sus primeros snapshots R2, hoy 0") is only achieved if
runCamaraVotos receives r2Store on the NORMAL ingest path AND the masivo CLI passes it. Task 2
acceptance greps r2Store "en la llamada a runIngest" (good); Task 3 must pass r2Store from the
CLI. runIngest treats a missing r2Store as best-effort no-op (snapshots stay 0 with no error),
so this is silent if missed. Plan 02 Task 1 already lists .env R2_* as a pre-check - keep it as
a hard gate so Etapa 1 is not silently skipped.

## Nyquist / validation

Dimension 8 applicable (RESEARCH has Validation Architecture). All three auto tasks carry
<automated> verify commands (pnpm --filter @obs/votos test ...). Wave 0 test task (Task 1)
creates tests RED-first against the target signature; Task 2 turns them GREEN. Sampling
continuity fine (3/3 auto tasks have automated verify). Plan 02 Task 1 is a doc with a grep-based
automated verify; its checkpoint sibling is human-action (correctly non-automated). No Nyquist
blocker.

## Context compliance

CONTEXT.md decisions are LOCKED rules (two-stage, rate-limit 2-3s, backfill LOCAL, PostgREST
.range(), DIPID-determinista, cobertura reported). All honored:
- Two-stage + --from-r2: Plan 01 core. OK.
- Rate-limit 2-3s: inherited from buildCamaraConnector, NOT touched (T-66-02). OK.
- Backfill LOCAL: Plan 02 autonomous:false, VOTOS_LIVE gated. OK.
- PostgREST pagination: Task 3 acceptance requires .order().range() on listings + head+count. OK.
- DIPID determinista / no name-match: reconciler untouched; invariant enforces it. OK.
Deferred ideas (P68 ficha UI, P67 Senado) correctly EXCLUDED - no task builds UI or Senado. OK.

## No blockers

No BLOCKER-severity issues. Requirement coverage complete, task structure complete, dependencies
acyclic, scope within budget, no scope reduction, deferred ideas excluded, reconciler/parser/golden
protected by grep-gate, LIVE work correctly operator-LOCAL.

The three warnings all cluster on "the wire actually carries r2Store end-to-end". They do not
block execution but, if missed, would let the phase pass its tests while still producing 0 R2
snapshots (the exact thing DEBT-01 must fix). Recommend the planner tighten Task 3 acceptance to
assert R2Store construction + normal-path threading. Execution may proceed.
