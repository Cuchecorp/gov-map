# Phase 43 — DEBT Validation: Planning / Docs / Memory / Scratch (Opus, adversarial, 1-by-1)

**Validator:** Opus, adversarial re-read of every finding in `43-discovery-planning.md`.
**Date:** 2026-06-24
**Method:** Re-read the cited files. For each finding: REAL or FALSE-POSITIVE → root cause → what breaks → verdict (FIX-NOW / FOLD-INTO-CLOSURE / CHECKPOINT-OPERADOR / WON'T-FIX) → exact minimal edit.

> **Verdict legend**
> - **FIX-NOW** — safe doc edit the agent owns, no operator content destroyed, provably harmless.
> - **FOLD-INTO-CLOSURE** — a ROADMAP/STATE status fix best done as part of the Phase 43 closure commit (DEBT-04) to avoid mid-phase collisions with GSD execute/verify agents that also rewrite ROADMAP.
> - **CHECKPOINT-OPERADOR** — needs operator (memory edit, cutover-doc validation, dossier signature).
> - **WON'T-FIX** — false positive, or load-bearing content not to be touched.

---

## GATE 4 — Phase 42 scratch inventory (independent confirmation)

Spot-read: `_FACTS-live-prod.md`, `drafts/0043_lockdown_web_reader.sql`, `_validation-A-jwt-pii.md`.

- `_FACTS-live-prod.md` is the **authoritative PROD ground-truth snapshot** (roles, anon's effective grants, the 26 RLS SELECT policies, the PII deny-by-default table list, the 15 curated RPCs). 0043/0044 are written against it. Header explicitly says "These are the ground truth. Do NOT re-derive from .sql migrations (drift)." → **load-bearing**.
- `drafts/0043_lockdown_web_reader.sql` is the literal migration deliverable for LOCKDOWN-01 (creates `web_reader`, replicates anon's effective set, 26 `_public_read_wr` policies, revokes nothing). Encodes the inviolable cutover order (0043 → deploy LOCKDOWN-03 → 0044). → **deliverable**.
- `_validation-A-jwt-pii.md` holds the Opus BLOCKER/CHECKPOINT checklist that shaped the enumerated-grant design (reject ON ALL ROUTINES, fail-closed accessToken, admin env mismatch flag). → **traceability, load-bearing**.

**CONFIRMED:** All 17 items in `.planning/phases/42-lockdown-api-supabase-rol-web-reader/` are deliverables or critical PROD facts awaiting the pending Phase 42 cutover. NONE safe to delete. The `_*` naming looks throwaway but every file is load-bearing.
**VERDICT for "clean up Phase 42 scratch": WON'T-FIX** — do not touch until the Phase 42 cutover is applied to PROD and the phase is archived. That is operator territory. Discovery agent's conclusion stands and is independently confirmed.

---

## Per-finding verdicts

### PLAN-01 — Phase 14 plans 14-01/14-02 marked `[ ]` but phase is complete
- **REAL** (re-read). ROADMAP line 67 = Phase 14 `[x]` "completed 2026-06-19". Plan list lines 218–219 (`14-01-PLAN.md`, `14-02-PLAN.md`) are `[ ]`; 14-03/14-04 (lines 220–221) are `[x]`.
- **Root cause:** Plan-level checkboxes never updated after the plans executed; phase-level status line was.
- **What breaks:** An agent reading the plan list under Phase 14 sees two unbuilt plans → risk of re-validating / double-applying migration 0023.
- **VERDICT: FOLD-INTO-CLOSURE.** This is a ROADMAP status marker; flipping `[ ]`→`[x]` mid-phase risks colliding with the GSD execute/verify agents that rewrite ROADMAP during the Phase 43 closure. Do it in the DEBT-04 closure commit.
- **Exact edit (at closure):** lines 218–219 `- [ ]` → `- [x]` for `14-01-PLAN.md` and `14-02-PLAN.md`. (Phase-level line 67 already correct; no change.)

### PLAN-02 — Phase 17 marked `[ ]` in phase list but dossier built (sign-off was human debt)
- **REAL but the framing is now SUPERSEDED — see PLAN-06.** Line 70 still shows `- [ ] **Phase 17 …**`. Detail section (line 287) says "Entregable construido … sign-off legal humano queda PENDIENTE — deuda operador F17". **However:** `docs/legal/17-LEGAL-DOSSIER-NET.md` front-matter is now `signoff: approved` (2026-06-24, Sánchez Rossi) and `HANDOFF-41-crucen.md` line 11 confirms "F17 NET firmado approved (2026-06-24)". So Phase 17 is not merely "built, awaiting human" — the human sign-off is **DONE**. The `[ ]` + "pendiente" text is doubly stale.
- **Root cause:** Sign-off landed 2026-06-24 (during the CRUCEN window) but the Phase 17 list line + detail prose were never updated.
- **What breaks:** Agent routing v2.0 status sees Phase 17 as unstarted/pending when the legal gate is actually cleared.
- **VERDICT: FOLD-INTO-CLOSURE** (merge with PLAN-06 — same root: F17 sign-off drift). At closure, set line 70 to `[x]` with `**Status:** dossier built; legal sign-off APPROVED 2026-06-24 (Sánchez Rossi)` and reconcile the detail-section prose (line 287) from "PENDIENTE" to "APROBADO 2026-06-24".

### PLAN-03 — `supabase-admin.ts` env-name mismatch (`SUPABASE_SERVICE_KEY` vs `SUPABASE_SECRET_KEY`) not tracked in ROADMAP
- **REAL** (re-read `_validation-A-jwt-pii.md` lines 120–124, 135). The admin client reads `SUPABASE_SERVICE_KEY`; `.env`/`.env.example`/`.dev.vars.example` define `SUPABASE_SECRET_KEY`. CI workflows bridge it (`SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}`) but the CF Worker does not → `createAdminSupabase()` would throw if the admin surface were enabled.
- **Root cause:** Naming divergence between the admin client and the canonical env; latent because `ADMIN_REVISION_ENABLED=false` in prod.
- **What breaks:** Operator enabling admin review hits a confusing `throw` "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY" despite the key existing under another name.
- **Cross-reference:** SAME ROOT as **APP-01** (app-dimension validator owns the one-line CODE fix). Here the verdict is ONLY "track it in the DEBT-LEDGER" — do **not** duplicate the code fix in this dimension.
- **VERDICT: FOLD-INTO-CLOSURE** (ledger entry only). Add a DEBT-LEDGER row cross-referencing APP-01: "admin client env-name mismatch; fix owned by APP-01; runbook already excludes admin from smoke test (RUNBOOK §Smoke line 200–203)". No code edit here.

### PLAN-04 — v2.0/v3.0/v4.0 milestone headers say "planned" but they are largely shipped
- **REAL** (re-read lines 8–11). All three post-v1.0 milestone bullets carry `📋 … — planned`. Memory + ROADMAP detail confirm v2.0 (8-22) shipped, v3.0 (23-37) shipped, v4.0 (41-42 write-complete, 43 active).
- **Root cause:** Milestone-summary emoji/status never advanced as phases shipped.
- **What breaks:** Onboarding / any agent using the milestone overview as state-of-world reads v2.0–v4.0 as entirely future.
- **VERDICT: FOLD-INTO-CLOSURE.** Milestone-header rewrite is exactly the kind of ROADMAP status edit that collides with GSD closure rewrites. Do it in DEBT-04.
- **Exact edit (at closure):** line 8 `📋 … v2.0 … — planned` → `🚧 … — en producción (Phases 8-22 shipped; gates legales/cutover pendientes)`; line 9 v3.0 → `🚧 … — shipped (Phases 23-37)`; line 10 v4.0 → `🚧 … — in-progress (41-42 write-complete, 43 active)`. Use `🚧`/`✅` to match the existing `✅ v1.0` convention.

### PLAN-05 — Twin legal dossiers byte-identical (phase-dir vs docs/legal/)
- **REAL — confirmed byte-identical.** `diff` of both pairs returned no output: `13-LEGAL-DOSSIER.md` (phase 13 ↔ docs/legal) IDENTICAL; `41-LEGAL-DOSSIER.md` (phase 41) ↔ `docs/legal/41-LEGAL-DOSSIER-CRUCES.md` IDENTICAL.
- **Root cause:** CRUCEN-02 intentionally produced the twin; no canonical marker → future edit to one copy silently drifts.
- **What breaks:** A future legal re-review (e.g. before the Dec-2026 data law) updates one copy's front-matter; the other goes stale; signoff scanner ambiguity.
- **Adversarial check on the proposed marker:** Adding an HTML comment `<!-- CANONICAL: docs/legal/… -->` to the phase-dir copy is safe IFF no signoff scanner greps these files by exact content/hash. The signoff gate is `NET_PUBLIC_ENABLED` keyed on the **YAML front-matter `signoff` field** of `docs/legal/*` (per 17-dossier §8), NOT on byte-equality of the phase-dir twin. An HTML comment in the body does not touch front-matter and does not change the `signoff:` value. → harmless. BUT: adding the comment to **only one** copy itself breaks byte-equality (the very state memory records as "×2 byte-idéntico"), which a future audit could flag as the twins having drifted.
- **VERDICT: WON'T-FIX (for now), record as ledger note.** The byte-identical state is not currently a defect; the risk is purely future drift. Adding a one-sided comment trades a benign-now state for a cosmetic "twins differ" signal and touches a **signed** artifact's sibling. Safer to (a) leave both untouched and (b) record in DEBT-LEDGER a process note: "canonical = `docs/legal/`; if either dossier is re-reviewed, update BOTH copies or collapse to a pointer at that time." Defer any structural change to when a real re-review happens.

### PLAN-06 — `17-LEGAL-DOSSIER-NET.md` signoff `pending`, no ROADMAP entry tracks approval
- **FALSE-POSITIVE on the premise, but uncovers a REAL inverse drift.** The dossier front-matter is **already `signoff: approved`** (line 4, `fecha_signoff: 2026-06-24`, `asesor: Carlos Sánchez Rossi`), and §Decision (line 324) records "(x) approved". HANDOFF-41 line 11 confirms F17 was signed 2026-06-24. So the gate is NOT stuck at pending.
- **The REAL debt (inverse of the finding):**
  1. **Intra-file drift in the dossier:** front-matter says `approved` (line 4) but the prose §8 (line 274) still says "registra … `signoff: pending` … deuda de operador F17". The body contradicts its own front-matter.
  2. **ROADMAP drift:** line 285 still says "(`17-LEGAL-DOSSIER.md`, `signoff: pending`)"; Phase 31 (line 473) still says "DEFERIDO … falta el sign-off de un abogado externo (`signoff: approved`)". Both stale.
- **What breaks:** An agent reads ROADMAP/§8 and believes NET is still legally blocked when it is cleared; conversely could re-request a sign-off already obtained.
- **VERDICT:** split:
  - **Dossier body §8 prose (line 274) "signoff: pending":** this is the **signed legal artifact**. Editing prose inside a signed dossier is delicate (changes content of a document an external advisor signed). → **CHECKPOINT-OPERADOR** — flag for operator to reconcile the body prose with the approved front-matter (or annotate). Agent must NOT silently edit a signed dossier's body.
  - **ROADMAP line 285 + Phase 31 line 473 staleness:** agent owns `.planning/`. → **FOLD-INTO-CLOSURE** (merge with PLAN-02). At closure update line 285 to `signoff: approved (2026-06-24)` and Phase 31 to reflect F17 done (note Phase 31 also depends on LOBBY-03 / NET data — keep that nuance; only the sign-off sub-gate is cleared).

### PLAN-07 — `lobby_sector` vs `lobby_sector_aporte` CHECK consistency
- **FALSE-POSITIVE — confirmed consistent.** Migration `0039_cruce_senal.sql` line 50: `tipo_senal text not null check (tipo_senal in ('lobby_sector'))` — allow-list of exactly one token; `'lobby_sector_aporte'` is **excluded** and reserved for Phase 40 (comments lines 23–24, 49). Dossier §1 and ROADMAP line 864 agree. No live discrepancy.
- **Root cause of the seed:** Memory shorthand "(lobby_sector vs lobby_sector_aporte)" reads like a live inconsistency; it is actually a *documented reservation*, not a defect.
- **VERDICT: WON'T-FIX** (annotate in ledger as validated false-positive). Note in DEBT-LEDGER: "0039 CHECK allows only 'lobby_sector'; 'lobby_sector_aporte' reserved for Phase 40; docs internally consistent."

### PLAN-08 — Stale HANDOFF files for completed phases
- **REAL** (Glob confirms all six exist: HANDOFF-2026-06-22, -search-coverage-2026-06-23, -2026-06-23-gov-map, -41-crucen, -42-lockdown, -43-debt). HANDOFF-41-crucen describes CRUCEN as the active phase with pending gates; Phase 41 is COMPLETED + ENCENDIDO (ROADMAP line 773). The 06-22 handoff carries a superseded deploy id.
- **Root cause:** HANDOFFs are write-once context artifacts never marked completed.
- **What breaks:** Low — clutter. An agent could momentarily treat a closed-phase HANDOFF as active. The active ones are HANDOFF-42-lockdown and HANDOFF-43-debt.
- **Adversarial check:** These are operator/agent context artifacts. Moving them to `archive/` changes paths some memory/STATE pointers may reference (e.g. MEMORY links to HANDOFF-search-coverage and gov-map). Adding a `<!-- COMPLETED: <date> -->` header is non-destructive and preserves paths.
- **VERDICT: FIX-NOW (header only), NOT a move.** Prepend a one-line completed header to the four closed HANDOFFs; do NOT move (moving breaks MEMORY.md pointers — see PLAN-13) and do NOT delete.
  - `HANDOFF-2026-06-22.md`, `HANDOFF-search-coverage-2026-06-23.md`, `HANDOFF-2026-06-23-gov-map.md`, `HANDOFF-41-crucen.md` → prepend `<!-- COMPLETED 2026-06-24 — historical context; superseded. Active handoffs: HANDOFF-42-lockdown, HANDOFF-43-debt. -->`
  - Leave HANDOFF-42-lockdown and HANDOFF-43-debt untouched (active).

### PLAN-09 — ROADMAP Phase 43 entry has no Success Criteria / plan list
- **FALSE-POSITIVE.** Discovery cited line 775 (the v4.0 summary one-liner) and concluded "no detail block". But ROADMAP **does** have a full Phase 43 detail block at lines 1004–1021 under "### Phase 43: DEBT": Goal, Mode, Depends on, Requirements (DEBT-01..04), Autonomy, four Success Criteria, Plans (TBD), UI hint. The summary line 775 is appropriately terse (matches the pattern of other summary entries). No scaffolding gap.
- **Root cause:** Discovery scanned only the summary list region, not the v4.0 Phase Details section (line 777+).
- **VERDICT: WON'T-FIX** (false positive). One minor nicety: "Plans: TBD" will be filled as Phase 43 produces its plans — fold any plan-list population into the natural Phase 43 execution/closure, not a separate fix.

### PLAN-10 — `docs/deploy-cloudflare.md` / `docs/TRANSFER-to-cuchecorp.md` may have stale URLs/worker names
- **FALSE-POSITIVE** (both read in full).
  - `TRANSFER-to-cuchecorp.md` is accurate and current: source `xenaquis/observatorio-congreso` → `Cuchecorp/gov-map`, worker explicitly NOT renamed (line 4, 72–76), 9 `.env` + 2 Cloudflare secrets (line 34–48), crons table matches memory (agenda Mon 11:00, leyes Fri 20:00). The `xenaquis` reference is the correct *source* of the transfer, not stale. Line 88–90 explicitly notes `.planning/` `xenaquis` refs are intentional history.
  - `deploy-cloudflare.md` is a generic deploy guide; no hardcoded `xenaquis`, no old worker name (uses `observatorio-congreso.<tu-subdominio>.workers.dev`). It predates Phase 42 LOCKDOWN (still describes the frontend reading as `anon`, lines 22/54/58) — that will need an update *after* the cutover, but that is a deferred post-cutover doc task, not current debt.
- **VERDICT: WON'T-FIX** for the staleness claimed. **Ledger note:** after Phase 42 cutover applies, `deploy-cloudflare.md` §Datos/§Secrets need updating from `SUPABASE_ANON_KEY` to the `web_reader` JWT model (`SUPABASE_JWT_SECRET`). Owned by the Phase 42 cutover/operator, not Phase 43.

### PLAN-11 — `docs/RUNBOOK-lockdown-cutover.md` may miss Opus-validator BLOCKERs
- **FALSE-POSITIVE — the runbook is post-validation and complete** (read in full). It incorporates every Opus-validator-B requirement:
  - **DEFAULT_ACL reversal** — reverse-0044 §4 (lines 298–304) reverts `ALTER DEFAULT PRIVILEGES … GRANT ALL … TO anon,authenticated` for TABLES/ROUTINES/SEQUENCES.
  - **View audit** — live probe (c) hits `pg_all_foreign_keys` (the pgTAP view) expecting 42501 (lines 156–164).
  - **Live curl probe** — four probes (a–d): RPC, direct table, pgTAP view, PII table, each expecting 42501/401 (lines 126–177), with explicit "si CUALQUIERA devuelve datos reales → ROLLBACK".
  - **Fail-closed LOCKDOWN-03** — Paso 0 step 5 (lines 52–54) + failure table (line 318): server fails-closed if `SUPABASE_JWT_SECRET` missing; never falls back to anon.
  - **Inviolable cutover order** 1→2→3 with the explicit "revoke before deploy = site down" warning (lines 58–69), matching `_FACTS`/0043.
  - **Admin smoke-test exclusion** (PLAN-03 entanglement) — lines 200–203 explicitly exclude `/admin/revisar-entidades` due to the `SUPABASE_SERVICE_KEY` vs `SUPABASE_SECRET_KEY` mismatch.
  - **Catalog-level re-grant backstop** (the supabase_admin DEFAULT-ACL gap the static guard can't see) — §Riesgo residual (lines 324–366) with periodic pgTAP post-apply cadence.
- **What it would break:** Nothing — the doc is correct and conservative.
- **VERDICT: WON'T-FIX** (false positive). The runbook is the load-bearing cutover guide and is complete. **Do not edit it** (gate: anything touching the destructive PROD cutover doc is operator-validated only). If anything, **CHECKPOINT-OPERADOR**: operator confirms the runbook before executing the cutover — but no agent edit is warranted or safe.

### PLAN-12 — `docs/DECISION-cadencia-ingesta.md` unknown staleness
- **FALSE-POSITIVE** (read in full). The doc is dated 2026-06-23, explicitly marked **"Estado: ABIERTA (anotada, NO implementada)"**, and matches memory exactly (agenda Mon 11:00 UTC, leyes Fri 20:00 UTC; hash-check-first-then-daily recommendation). It is a deliberately open, un-implemented decision record — not a stale doc describing a superseded cadence.
- **VERDICT: WON'T-FIX** (false positive, validated current). Optionally note in ledger that it remains an OPEN decision awaiting the "minutos confirmados en Cuchecorp" trigger.

### PLAN-13 — MEMORY.md uses machine-specific absolute OneDrive paths in two pointers
- **REAL** (re-read MEMORY.md context): `[HANDOFF búsqueda-cobertura 2026-06-23]` and the `[Milestone v4]` pointer use `../../../OneDrive%20-%20pjud.cl/Documentos/GitHub/Observatorio/.planning/…` — machine/OneDrive-specific, `%20`-encoded; breaks on clone/CI/other machine.
- **Root cause:** GSD memory agent wrote absolute (un-normalized) Windows/OneDrive paths.
- **What breaks:** Memory link resolution fails silently on a different machine; agent loses context it assumed it had.
- **GATE — DO NOT EDIT MEMORY:** memory files live in the user's `~/.claude` dir, **outside the repo**. The agent must NOT silently rewrite the user's memory.
- **VERDICT: CHECKPOINT-OPERADOR (recommendation only).** Flag in ledger: recommend the operator normalize those two MEMORY.md links to repo-relative (`.planning/HANDOFF-search-coverage-2026-06-23.md`, `.planning/MILESTONE-v4-cruces.md`). Agent does not touch `~/.claude` memory.

### PLAN-14 — Phase 43 sibling artifacts (RESEARCH/VALIDATION/DEBT-LEDGER) don't exist yet
- **REAL but expected** — this is the in-progress phase being bootstrapped (and this very file, `43-validation-planning.md`, is now one of the siblings). Not pre-existing debt.
- **VERDICT: WON'T-FIX (no-op).** Created as part of Phase 43 execution; no action.

---

## Cross-cutting notes for DEBT-04 closure

1. **Consolidate the ROADMAP status edits into ONE closure commit** to avoid colliding with GSD execute/verify ROADMAP rewrites: PLAN-01 (14-01/14-02 → `[x]`), PLAN-02 + PLAN-06-ROADMAP (Phase 17 `[x]` + signoff approved; line 285 + Phase 31 line 473), PLAN-04 (milestone headers `📋 planned` → `🚧`/`✅`).
2. **F17 sign-off reconciliation (PLAN-06)** is the highest-signal real drift uncovered: the dossier is SIGNED (`approved`, 2026-06-24) but ROADMAP + the dossier's own §8 prose still say `pending`. ROADMAP side = FOLD-INTO-CLOSURE; signed-dossier body side = CHECKPOINT-OPERADOR (never silently edit a signed legal artifact).
3. **Two genuinely safe agent-owned FIX-NOWs this dimension:** PLAN-08 (COMPLETED headers on 4 closed HANDOFFs — header only, no move, no delete).
4. **Everything touching Phase 42** (scratch dir, RUNBOOK, cutover) = hands-off until operator applies the cutover and archives the phase.

---

## Verdict summary (compact)

| Finding | REAL? | Verdict | One-line reason |
|---|---|---|---|
| Phase 42 scratch (17 items) | n/a | **WON'T-FIX** | All load-bearing PROD facts/deliverables awaiting cutover; operator territory |
| PLAN-01 | REAL | **FOLD-INTO-CLOSURE** | 14-01/14-02 `[ ]`→`[x]`; do at closure to avoid ROADMAP collision |
| PLAN-02 | REAL (superseded by 06) | **FOLD-INTO-CLOSURE** | Phase 17 `[ ]`; sign-off now APPROVED, not just "built" — fold w/ PLAN-06 |
| PLAN-03 | REAL | **FOLD-INTO-CLOSURE** | Ledger entry only; code fix owned by APP-01 (don't duplicate) |
| PLAN-04 | REAL | **FOLD-INTO-CLOSURE** | Milestone headers `📋 planned`→`🚧`/`✅` at closure |
| PLAN-05 | REAL | **WON'T-FIX** (ledger note) | Byte-identical is benign now; one-sided comment touches signed twin + breaks parity; defer to real re-review |
| PLAN-06 | FALSE premise / REAL inverse drift | **CHECKPOINT** (dossier body) + **FOLD-INTO-CLOSURE** (ROADMAP) | Dossier already `approved`; §8 prose + ROADMAP say `pending` |
| PLAN-07 | FALSE-POSITIVE | **WON'T-FIX** | 0039 CHECK allows only 'lobby_sector'; 'lobby_sector_aporte' reserved Phase 40; docs consistent |
| PLAN-08 | REAL | **FIX-NOW** (header, not move) | Prepend `<!-- COMPLETED -->` to 4 closed HANDOFFs; no move/delete |
| PLAN-09 | FALSE-POSITIVE | **WON'T-FIX** | Phase 43 detail block exists at ROADMAP 1004–1021; discovery read only summary line 775 |
| PLAN-10 | FALSE-POSITIVE | **WON'T-FIX** (ledger note) | TRANSFER + deploy docs current; `xenaquis` is correct source; post-cutover deploy-doc update owned by Phase 42 |
| PLAN-11 | FALSE-POSITIVE | **WON'T-FIX** (operator confirms) | RUNBOOK is post-validation; includes DEFAULT_ACL reversal, view audit, 4 curl probes, fail-closed, admin exclusion |
| PLAN-12 | FALSE-POSITIVE | **WON'T-FIX** | DECISION doc dated 06-23, marked ABIERTA/not-implemented, matches memory cadence |
| PLAN-13 | REAL | **CHECKPOINT-OPERADOR** | Absolute OneDrive paths in MEMORY.md; memory is outside repo — never edit silently |
| PLAN-14 | REAL (expected) | **WON'T-FIX** (no-op) | In-progress phase bootstrap; siblings created by Phase 43 itself |
