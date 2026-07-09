---
phase: 57-cron-fix-hardening-dos-etapas-hash-check-crons-verdes
verified: 2026-07-08T20:45:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Esperar corrida SCHEDULED de leyes-weekly o agenda-weekly un día L–V (lunes a viernes)"
    expected: "gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 1 muestra conclusion=success para una corrida activada por el schedule (cron trigger), no solo workflow_dispatch"
    why_human: "La corrida E2E verificada (2026-07-09T00:10:34Z) fue dispatch manual. El criterio CRON-04 exige 'crons corren verdes L–V' — solo observable en la ventana de schedule diario."
---

# Phase 57: CRON-FIX — Hardening dos-etapas + hash-check + crons verdes — Verification Report

**Phase Goal:** Cada conector cumple DOS ETAPAS re-ejecutables + hash-check antes de descargar; crons corren verdes L–V (secrets cargados o fallback local documentado).
**Verified:** 2026-07-08T20:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R2Store.getObject(r2Path) devuelve Uint8Array del objeto almacenado | VERIFIED | `packages/ingest/src/r2-store.ts` lines 88–96: método `getObject` completo, SigV4 via AwsClient.sign, retorna `new Uint8Array(await res.arrayBuffer())` |
| 2 | putImmutable retorna `{ r2Path: string; existed: boolean }` — 412 mapea a existed=true | VERIFIED | `r2-store.ts` line 63: tipo de retorno `Promise<{ r2Path: string; existed: boolean }>`, line 79: `existed = res.status === 412` |
| 3 | upsertEventos con lote que contiene el mismo evento dos veces NO lanza ON CONFLICT | VERIFIED | `writer-supabase.ts` contiene `dedupePorClave` (grep confirma binario); test G4 en `writer-supabase.test.ts` con `contains: "G4"` (PLAN 02) |
| 4 | tramitacion/ingest-cli con `--from-r2 <path>` no emite ningún fetch a senado.cl ni camara.cl | VERIFIED | `ingest-cli.ts` lines 215–220: modo `--from-r2` lee crudo desde R2 via `r2Store.getObject` y usa conectores fake inyectados; tests usan `fakeConnectors()` (objetos mock sin red) — cero fetch gubernamental garantizado por diseño |
| 5 | Log `[skip] sin novedades` presente en conectores | VERIFIED | `tramitacion/ingest-run.ts` line 280: `log('[skip] sin novedades — tramitacion ${boletinFull}')` exacto; `lobby/ingest-run.ts` line 147: análogo. Test en `ingest-cli.test.ts` line 272 aserta el string completo |
| 6 | lobby-camara-weekly.yml sin schedule activo + comentario WAF | VERIFIED | YAML lines 16–20: schedule DESHABILITADO, `on: workflow_dispatch:` únicamente, comentario G7 explicando WAF de camara.cl |
| 7 | docs/runbooks/cron-local-fallback.md existe con instrucciones lobby-camara local + gh secret set cookbook | VERIFIED | Archivo existe en `docs/runbooks/cron-local-fallback.md`; commit `bd44202` muestra 174 líneas con 5 secciones (prereqs, lobby-camara local, gh secret set cookbook, re-enable schedule, verificación post-corrida) |
| 8 | gh secret list Cuchecorp/gov-map muestra los 5 nombres nuevos (R2×4 + DEEPSEEK) | VERIFIED | Salida directa: `DEEPSEEK_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_ENDPOINT_URL`, `R2_SECRET_ACCESS_KEY` — todos con timestamp 2026-07-09T00:10 |
| 9 | Al menos 1 corrida workflow_dispatch de leyes-weekly termina con conclusion=success | VERIFIED | `gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 1` → `completed success` en `2026-07-09T00:10:34Z`, duración 23m17s |
| 10 | Corrida SCHEDULED (cron L–V) verde | PENDING HUMAN | Corrida verificada fue dispatch manual; schedule aún no ha activado una corrida cron post-hardening |

**Score:** 9/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ingest/src/r2-store.ts` | getObject + putImmutable retorna {r2Path, existed} | VERIFIED | Ambos métodos presentes, correctamente implementados |
| `packages/tramitacion/src/writer-supabase.ts` | dedupePorClave aplicada en upsertEventos | VERIFIED | Grep confirma presencia de dedupePorClave (binario con caracteres especiales) |
| `packages/tramitacion/src/ingest-cli.ts` | --from-r2 flag + Etapa 1 R2 + hash-check | VERIFIED | lines 18, 54, 124–127, 194, 213–220 |
| `packages/lobby/src/ingest-cli.ts` | R2Store import + --from-r2 + Etapa 1 | VERIFIED | lines 51, 106–109, 145 |
| `docs/runbooks/cron-local-fallback.md` | Runbook WAF + gh secret cookbook | VERIFIED | Existe; 174 líneas; commit bd44202 |
| `.github/workflows/lobby-camara-weekly.yml` | schedule deshabilitado, dispatch-only + WAF comment | VERIFIED | `on: workflow_dispatch:` únicamente; comentario G7 presente |
| `.github/workflows/agenda-weekly.yml` | 7 secrets en env: incluyendo DEEPSEEK_API_KEY y 4 R2 | VERIFIED | lines 58–62 confirman los 5 secrets nuevos en bloque env: |
| `.github/workflows/probidad-weekly.yml` | assert consultados=[1-9] | VERIFIED | line 69: `grep -qE 'consultados=[1-9][0-9]*'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tramitacion/ingest-cli.ts` | `ingest/r2-store.ts` | getObject call en modo --from-r2 | VERIFIED | line 220: `r2Store.getObject(opts.fromR2)` |
| `lobby/ingest-cli.ts` | `ingest/r2-store.ts` | R2Store import de @obs/ingest | VERIFIED | grep confirma `R2Store` en ingest-cli.ts (line 145+) |
| `probidad/run-probidad-todos-cli.ts` | `probidad/run-probidad-todos.ts` | campo consultados en resultado | VERIFIED | grep confirma `consultados` en run-probidad-todos-cli.ts |
| `leyes-weekly.yml` | GH Actions runner | workflow_dispatch disparado manualmente | VERIFIED | corrida success 2026-07-09T00:10:34Z |

### Data-Flow Trace (Level 4)

No aplica — esta fase produce conectores CLI y YAML de CI, no componentes de UI con datos dinámicos.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite completa 720 tests | `pnpm -w test --run` | 720 passed, 68 files | PASS |
| Typecheck sin errores | `pnpm -w typecheck` | exit 0, sin output de error | PASS |
| leyes-weekly E2E verde | `gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 1` | completed success 23m17s | PASS |
| 5 secrets presentes en repo | `gh secret list --repo Cuchecorp/gov-map` | 5 nombres R2+DEEPSEEK confirmados | PASS |

### Probe Execution

No hay probe scripts `scripts/*/tests/probe-*.sh` declarados para esta fase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CRON-02 | 57-01, 57-03 | R2Store.getObject + --from-r2 en conectores | SATISFIED | getObject implementado; --from-r2 en tramitacion y lobby CLI |
| CRON-03 | 57-01, 57-03 | hash-check early-exit con log [skip] | SATISFIED | Log `[skip] sin novedades` en tramitacion line 280 y lobby line 147; test aserta el string |
| CRON-04 | 57-02, 57-03, 57-04 | dedupePorClave + secrets + corrida verde | SATISFIED (parcial — schedule pendiente) | G4 fix aplicado; 5 secrets cargados; corrida dispatch success; corrida schedule pendiente (human) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (ninguno) | — | — | — | Grep sobre commits ops (bd44202, 36460c9): sin valores de secrets, solo nombres y referencias a `secrets.*`; runbook explícita "NUNCA copiar/pegar en terminal" |

No se encontraron marcadores TBD/FIXME/XXX sin referencia a issue en los archivos modificados por la fase.

### Human Verification Required

#### 1. Corrida SCHEDULED verde (cron L–V)

**Test:** Esperar que el schedule `leyes-weekly.yml` (cron `0 20 * * 5` — viernes 20:00 UTC) o `agenda-weekly.yml` (cron `0 12 * * 1` — lunes 12:00 UTC) active una corrida automatica. Ejecutar:
```
gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 3
```
**Expected:** Al menos 1 entrada con `EVENT=schedule` y `STATUS=completed conclusion=success`
**Why human:** La unica corrida verificada en este phase (2026-07-09T00:10:34Z) fue `workflow_dispatch` manual. El criterio CRON-04 "crons corren verdes L–V" solo puede verificarse cuando el scheduler de GitHub Actions active una corrida por trigger `schedule`. Esa ventana no habia ocurrido al momento de esta verificacion (fase completada 2026-07-09, proximo viernes = 2026-07-11 20:00 UTC).

### Gaps Summary

No hay gaps bloqueantes. El unico item pendiente es observacional: verificar que la proxima corrida activada por schedule (no dispatch) también termina verde. El código, los secrets y los YAML estan correctamente configurados — el pipeline disparo por dispatch confirmó que el código funciona de extremo a extremo en GH Actions con los 5 secrets nuevos.

---

_Verified: 2026-07-08T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
