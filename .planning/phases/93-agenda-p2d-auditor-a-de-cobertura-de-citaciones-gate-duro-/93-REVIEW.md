---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/agenda/src/ingest-run.ts
  - packages/agenda/src/connector-camara.ts
  - packages/agenda/src/ingest-run.test.ts
  - packages/agenda/src/run-agenda-prod-cli.ts
  - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-AUDITORIA-CITACIONES.md
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: fixed
fixed_at: 2026-07-22
fixes:
  WR-01: { status: fixed, commit: e5fdd39 }
  WR-02: { status: fixed, commit: 7ada448 }
  WR-03: { status: fixed, commit: 28a6791 }
  IN-01: { status: fixed, note: "subsumido por WR-01 (e5fdd39)" }
  IN-02: { status: fixed, commit: b87c5f4 }
  IN-03: { status: fixed, commit: b99b645 }
  IN-04: { status: fixed, commit: 0999d81 }
---

# Phase 93: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Etapa 1 R2 wiring (`ingest-run.ts` step 1 + `connector-camara.fetchSemanaBytes`),
the CLI that drives it (`run-agenda-prod-cli.ts`), the new R2 tests, and the audit report
(`93-AUDITORIA-CITACIONES.md`) for internal consistency.

The core mechanism is sound and matches the LOCKED two-stage pattern. Verified adversarially:

- **Etapa 1 R2 is correct.** Bytes are fetched via `fetchSemanaBytes` BEFORE any parse/write; the
  SAME `bytes` object is both persisted (`putImmutable`) and decoded (`new TextDecoder().decode(bytes)`)
  — no risk of persisting one payload and parsing another. Content-addressing is real: `sha256Hex(bytes)`
  feeds the R2 key, and `R2Store.putImmutable` sends `If-None-Match: *` with 412→idempotent handling
  (`r2-store.ts:56-81`). Best-effort is real: the `putImmutable` call is wrapped in its own try/catch
  that only logs and lets Etapa 2 proceed (`ingest-run.ts:141-158`). Tests (f)/(g)/(h) cover fires /
  gated / best-effort respectively.
- **Rate-limit is respected in the week loop.** Each week's fetch flows through `fetchBytes` →
  `rateLimiter.wait(parsed.host)` (`connector-camara.ts:97`) BEFORE the network call; the loop is
  serial (`for...of` with `await`), so the 2-3s per-host throttle is enforced per week. No burst.
- **Cron retrocompat holds.** `fetchSemana` is retained and now delegates to `fetchSemanaBytes`;
  the cron CLI (`run-agenda-prod-cli.ts`) and `ingest-cli.ts` both construct the real
  `CitacionesCamaraConnector` class (which has both methods), so `runIngest`'s new dependency on
  `fetchSemanaBytes` cannot break them. Existing `connector-camara.test.ts` still exercises `fetchSemana`.

No Critical issues. Findings are three Warnings (one real correctness edge in the R2 date path, two
honesty/consistency defects in the audit report that directly feed the 94 gate) and four Info items.

## Warnings

### WR-01: R2 content-addressed key uses wall-clock `date` — same bytes on two different days produce two objects (idempotency hole for the future hash-check)

> **FIXED** (`e5fdd39`) — la partición de la key R2 pasó de `new Date()` a la semana ISO ingerida (`clave` / `semanaIsoKey`), estable y day-independent; re-fetch idéntico → misma key → 412 idempotente. Aplicado a `citaciones-semana` (HTML) y `tabla-sala` (PDF). Subsume IN-01.

**File:** `packages/agenda/src/ingest-run.ts:143` (and mirror at `:260`)
**Issue:** The R2 key is `camara/citaciones-semana/<date>/<sha256>.html` where
`date = new Date().toISOString().slice(0,10)` (the run's wall-clock day). The object is
content-addressed by `sha256` but *partitioned by run-date*. If the identical HTML for a week is
fetched on two different calendar days (e.g. the cron on Monday, then a re-run/backfill on Tuesday),
`If-None-Match: *` will NOT collide — the keys differ by the `<date>` segment — so R2 stores the
same bytes twice under two dates and both PUTs return 201 (not 412). The SUMMARY (§5) explicitly
claims this crudo "queda disponible" for a future "hash-check pre-descarga (sha256 / If-None-Match)
… resuelve MINOR-1", but a hash-check that must scan across an unbounded set of `<date>/` prefixes to
find a prior sha is not O(1) and defeats the point of content-addressing. This is not a data-loss bug
(the bytes are safe), but the deduplication guarantee the report leans on is weaker than stated.
**Fix:** Either drop the wall-clock date from the citaciones key and address purely by
`source/resource/sha` (pure content-addressing — a re-fetch of unchanged bytes then 412s idempotently
regardless of day), or key by the *week being ingested* (`clave`, e.g. `2026-W20`) instead of the run
date so the partition is stable and the hash-check has a bounded prefix to probe:
```ts
// content-addressed, day-independent:
const { r2Path: key } = await opts.r2.putImmutable(
  "camara", "citaciones-semana", clave /* not new Date() */, sha, "html", bytes,
);
```
(Note: this is the pre-existing convention inherited from the sala-PDF step 4, so it is a shared
defect — but §5's dedup claim makes it load-bearing for phase 93.)

### WR-02: Audit §7 states a self-contradictory min-fecha for the Cámara comisiones cell that feeds the 94 banner

> **FIXED** (`7ada448`) — §7 dejó de declarar `min 2026-06-22` (stale pre-backfill); ahora declara el rango de semanas W20…W28 con la semana mínima W20 (mayo, Probe 4b) + la query psql reproducible que mide el `min(fecha)` real. El banner honesto de 94 ya no muestra una fecha falsa.

**File:** `.planning/phases/.../93-AUDITORIA-CITACIONES.md:282`
**Issue:** The §7 DECLARACIÓN row for **comisiones × Cámara** reads
`N=164, 6 semanas ISO (min 2026-06-22 → tras backfill se agregó desde mayo/W20)`. This is internally
contradictory: it asserts `min = 2026-06-22` AND that the backfill added data from May (W20). Per §2
Probe 4b and §5, W20 = "11 DE MAYO", so after the backfill the true `min(fecha)` is in May 2026, not
2026-06-22. The `2026-06-22` value is the stale pre-backfill figure carried over verbatim from §1.1
(which was measured in Plan 01, when N=34). Because §7 is the explicit input to the 94 cobertura
banner ("94 debe mostrar … el rango real de semanas/fechas cubierto"), shipping a wrong min-date
would make the honest-coverage banner itself dishonest — the exact failure mode the report's rector
principle forbids.
**Fix:** Re-measure `min(fecha)` post-backfill (`select min(fecha)::date from citacion where
camara='camara'`) and replace `min 2026-06-22` with the real May date, or remove the concrete min and
state the week range only (W20…W28) to avoid asserting an unverified date.

### WR-03: Audit reports the sala × Cámara item count inconsistently (19 vs 22) without reconciling which is current

> **FIXED** (`28a6791`) — el conteo vigente se pin a **22 ítems** (último upsert de §5, reemplazó la sesión de 19 por clave natural); el 19 quedó etiquetado como PRE-backfill en §1.2/§1.3; §7 dejó de hedge-ar "19-22" y cita la query reproducible. Se declara explícito que la extracción DeepSeek-desde-PDF es no determinista (19→22 = drift esperable).

**File:** `.planning/phases/.../93-AUDITORIA-CITACIONES.md:42, 217, 284`
**Issue:** The sala × Cámara cell is reported as **19 items** in the §1.2 matrix (measured Plan 01),
as **22 ítems** in §5 ("la tabla de sala de Cámara vía DeepSeek-desde-PDF (22 ítems…)", from the
backfill run's DeepSeek extraction), and as a hedged **"19-22 ítems"** in the §7 declaration row
(`:284`). DeepSeek-from-PDF extraction is non-deterministic (LLM), so a 19→22 drift across runs on the
"same" vigente PDF is plausible, but the report never states which count the DB actually holds after
the backfill upsert, nor whether the upsert replaced the 19-item session with a 22-item one or left a
mix. For a report whose whole premise is "every number is reproducible by psql", an un-reconciled
19/22/`19-22` for the cell 94 will render is a consistency defect.
**Fix:** Re-run the §1.3 sala query post-backfill (`select s.camara, count(*) from sesion_tabla_item
sti join sesion_sala s on s.id=sti.sesion_id where s.camara='camara'`) and pin the single current
count in §1.2, §5 and §7; note explicitly that DeepSeek extraction is non-deterministic if the count
is expected to vary run-to-run.

## Info

### IN-01: `date` computed per-week inside the loop instead of once per run

> **FIXED** (subsumido por WR-01, `e5fdd39`) — la key ya no usa wall-clock `date` en absoluto; la partición es la semana ISO, eliminando el edge de cruce de medianoche por completo.

**File:** `packages/agenda/src/ingest-run.ts:143`
**Issue:** `const date = new Date().toISOString().slice(0,10)` runs once per week iteration. Across a
midnight boundary during a long backfill, consecutive weeks could land under different `<date>/`
prefixes. Minor given rate-limit makes multi-hour runs unlikely to cross midnight often, and it is
subsumed by WR-01, but computing the run-date once before the loop would be cleaner and remove the
edge entirely.
**Fix:** Hoist `const runDate = new Date().toISOString().slice(0,10);` above the `for (const semana…)`
loop and reuse it (or apply WR-01's key change, which removes the wall-clock date).

### IN-02: R2 best-effort failure is invisible in the final result/exit code

> **FIXED** (`b87c5f4`) — un fallo de `putImmutable` ahora enumera las semanas sin respaldo y pushea una degradación `camara-citaciones-r2` (honestidad, NO error → el exit-code no cambia). Test (h) aserta que la degradación aparece.

**File:** `packages/agenda/src/ingest-run.ts:153-158`
**Issue:** A failed `putImmutable` (R2 401/network) is logged but not surfaced in `RunIngestResult`
(neither `errores` nor `degradaciones`), so the CLI exit code stays 0 and an operator watching the
summary line won't notice that Etapa 1 (crudo versionado) silently dropped for some weeks — the
LOCKED two-stage invariant quietly degraded to one-stage. This is intentional per the "best-effort"
spec (and correct that it must not abort Etapa 2), but total invisibility means a persistent R2
outage would go unnoticed for a long time.
**Fix:** Push a non-fatal marker (e.g. a `degradaciones` entry `{ fuente: "camara-citaciones-r2",
motivo: "respaldo R2 falló para N semana(s)" }`) so the summary reflects that the crudo was not
persisted, without changing exit-code semantics.

### IN-03: `SUPABASE_URL` loaded into env map but never consumed

> **FIXED** (`b99b645`) — `SUPABASE_URL` removida de la allow-list de `loadEnv` (el writer usa `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`).

**File:** `packages/agenda/src/run-agenda-prod-cli.ts:62`
**Issue:** `loadEnv` allow-lists `SUPABASE_URL`, but the writer is built exclusively from
`SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (`:113-121`). `SUPABASE_URL` is dead in this CLI.
**Fix:** Drop `SUPABASE_URL` from the allow-list, or document why it is retained (e.g. downstream
libs read `process.env` directly).

### IN-04: Test (f) fake `putImmutable` ignores the `body` arg — never asserts the persisted bytes equal the parsed bytes

> **FIXED** (`0999d81`) — el fake captura `body` y aserta `sha256Hex(body) === sha` reportado (bytes persistidos == bytes content-addressados), más que la partición sea la semana ISO (`YYYY-Www`, WR-01). Cazaría una regresión que hiciera dos fetch.

**File:** `packages/agenda/src/ingest-run.test.ts:183-194`
**Issue:** The R2 fake records `source/resource/ext/sha` but discards `body`. The tests verify the
namespace and that a sha-shaped key is produced, but nothing asserts the crucial focus-invariant that
the bytes handed to R2 are byte-identical to the bytes decoded and parsed (the "parse consumes the
SAME persisted bytes" property). The production code does hold this by construction (single `bytes`
const), but the test would not catch a regression that fetches twice.
**Fix:** In the fake, capture `body` and assert `sha256Hex(body)` matches the recorded `sha`, or
assert the decoded body parses to the same citación count as Etapa 2 produced.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
