# Phase 43 — DEBT Discovery: Planning / Docs / Memory / Scratch
**Dimension:** 6 — planning, docs, memory, scratch
**Date:** 2026-06-24
**Method:** Premortem framing — "It is 2027 and someone trusted a doc that lied, or scratch files leaked, or STATE drifted from reality."

---

## Scratch File Inventory (Phase 42 dir)

| File | Created-by (inferred) | Holds-fact? | Safe-to-delete? |
|---|---|---|---|
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_inventory.sql` | agent (sonnet-swarm, Phase 42 research) | YES — query used to populate `_inventory-live.txt`; reproducible from schema but documents intent | Low risk to delete after cutover complete; keep until Phase 42 cutover applied |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_inv2.sql` | agent (Phase 42 research iteration 2) | YES — refined SELECT query that found 37-table discrepancy (the key finding) | Same as above |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_inv3.sql` | agent (Phase 42 research iteration 3) | YES — queries for pgvector ACL, relkind breakdown, DEFAULT_ACL; critical for 0044 planning | Keep until cutover applied and verified |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_inventory-live.txt` | operator (ran the SQL against PROD) | YES — authoritative PROD snapshot at 2026-06-24; the 37-table list lives here | MUST KEEP — primary source; deleting before cutover loses the ground truth |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_rpc_check.sql` | agent | YES — checks that the 15 RPC signatures exist in PROD | Keep until cutover applied |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_verify_targets.sql` | agent | YES — verifies exact function signatures by `to_regprocedure`; needed to confirm the enumerated EXECUTE grant is correct | Keep until cutover applied |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_FACTS-live-prod.md` | agent (synthesized from PROD queries) | YES — authoritative ground truth of PROD state; 0043/0044 are written against this | CRITICAL — do NOT delete until cutover applied and Phase 42 archived |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_validation-A-jwt-pii.md` | agent (Opus validator) | YES — Opus adversarial validation with BLOCKERs and HIGHs that shaped the final draft; traceability for why the enumerated grant was chosen over ON ALL ROUTINES | Keep until archived |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_validation-B-cutover-revoke.md` | agent (Opus validator) | YES — Opus adversarial validation: 2 BLOCKERs on DEFAULT_ACL and view RLS bypass; HIGH on 37-table list; drives 0044 design | Keep until archived |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/0043_lockdown_web_reader.sql` | agent | YES — the actual migration artifact (247 lines); this IS the deliverable for LOCKDOWN-01 | Keep (it is a deliverable, not scratch) |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/0044_lockdown_revoke_anon.sql` | agent | YES — deliverable for LOCKDOWN-02 | Keep |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/web-reader-jwt.ts` | agent | YES — deliverable for LOCKDOWN-03 (the `createServerSupabase` replacement) | Keep |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/web-reader-jwt.test.ts` | agent | YES — deliverable unit test for LOCKDOWN-03 | Keep |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/0043_web_reader.test.sql` | agent | YES — pgTAP test for LOCKDOWN-01 | Keep |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/0044_revoke_anon.test.sql` | agent | YES — pgTAP test for LOCKDOWN-02 | Keep |
| `.planning/phases/42-lockdown-api-supabase-rol-web-reader/drafts/supabase.ts` | agent | YES — deliverable replacement for `app/lib/supabase.ts` (LOCKDOWN-03) | Keep |

**Summary:** ALL 17 items in the Phase 42 dir are either deliverables or hold critical PROD facts needed for the pending cutover. NONE are safe to delete before Phase 42 cutover is complete and the phase is archived. The `_*` naming looks like throwaway, but every file holds load-bearing content. The real clutter issue is that the `drafts/` directory content has NOT been moved to the actual repo (`supabase/migrations/`, `app/lib/`) — those files are awaiting operator cutover.

---

## Findings (ordered by severity)

---

### PLAN-01: Phase 14 plans marked `[ ]` (incomplete) in ROADMAP but memory says it is complete

- **File(s):** `.planning/ROADMAP.md` lines 218–219
- **Evidence:**
  ```
  - [ ] 14-01-PLAN.md — Migración 0023_dinero.sql …
  - [ ] 14-02-PLAN.md — Conector @obs/dinero …
  ```
  But Phase 14 header at line 67 says `(completed 2026-06-19 — gated OFF; 4/4 código, operador: aplicar 0023 al remoto + LIVE probe + RUT)` and 14-03/14-04 are `[x]`.
- **Repro:** An agent reading the plan list under "Phase 14" sees two unchecked plans and concludes the phase is partially built — wrong. The 14-01/14-02 checkboxes were never updated after the plans were executed.
- **Severity:** high
- **Blast radius:** Agent starting Phase 43 or Phase 40 might re-build or re-validate 14-01/14-02 as if they were pending, wasting effort or causing double-apply of migration 0023.
- **Proposed action (do NOT apply):** Mark `14-01-PLAN.md` and `14-02-PLAN.md` as `[x]` in ROADMAP.md Phase 14 plan list. Cross-check the phase-level status line is already correct (it is: line 67 says completed).

---

### PLAN-02: Phase 17 marked `[ ]` (incomplete) in the phase list but is actually complete (dossier built; sign-off is human debt)

- **File(s):** `.planning/ROADMAP.md` line 70
- **Evidence:**
  ```
  - [ ] **Phase 17: Compuerta Legal — Bloque NET (framing del grafo)** - Sign-off legal …
  ```
  But the Phase 17 detail section (line 285) says:
  > `[x] 17-01 — Dossier legal NET … Status: Entregable construido … El sign-off legal humano queda PENDIENTE — deuda de operador F17`
  The AGENT deliverable is done; the human sign-off is a separate gate.
- **Repro:** A future agent seeing `[ ]` in the milestone phase list might think Phase 17 work needs to be done and re-enter it in planning — the dossier is already in `docs/legal/17-LEGAL-DOSSIER-NET.md`. The distinction between "agent work done" and "human sign-off pending" is only visible by reading the detail section.
- **Severity:** high
- **Blast radius:** Any agent routing through v2.0 milestone status will see Phase 17 as unstarted, not as "built, awaiting human."
- **Proposed action (do NOT apply):** Change `[ ]` to a partial indicator (e.g. `[~]` or `[x]` with a note) in the phase list line 70. Add a `**Status:** built; human sign-off pending (deuda operador F17)` inline. The detail section already has this text; the summary line needs to match.

---

### PLAN-03: `supabase.ts` admin client env-name mismatch documented in validation but not in ROADMAP/REQUIREMENTS

- **File(s):** `.planning/phases/42-lockdown-api-supabase-rol-web-reader/_validation-A-jwt-pii.md` (lines 121–124), `.planning/HANDOFF-43-debt.md` (line 22)
- **Evidence:** Validation-A flags that `app/lib/supabase-admin.ts` reads `SUPABASE_SERVICE_KEY` but the env file and all other repo references use `SUPABASE_SECRET_KEY`. This is confirmed by the Phase 43 HANDOFF as a "seed confirmed" debt item. BUT it does not appear in the current ROADMAP.md or REQUIREMENTS.md as a tracked item — it is only in MEMORY and a HANDOFF file.
- **Repro:** If the DEBT-LEDGER of Phase 43 is the only place this is tracked, and Phase 43 is not run (or is partially run and the ledger is lost), this bug stays invisible until someone enables `ADMIN_REVISION_ENABLED=true` and the admin surface crashes silently. The ROADMAP has no entry for it.
- **Severity:** high
- **Blast radius:** Operator enabling admin review will see a confusing `throw` with "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY" despite the key existing under a different name. The runbook for Phase 42 cutover explicitly warns to exclude the admin smoke test for this reason — meaning the Phase 42 runbook and this bug are entangled.
- **Proposed action (do NOT apply):** Add a tracked debt item in ROADMAP.md Phase 43 section OR write a Phase 43 DEBT-LEDGER entry. The fix is a one-line env name change (`SUPABASE_SECRET_KEY`); but must not accidentally expose the service key. Cross-check `app/lib/supabase-admin.ts` exact env read.

---

### PLAN-04: ROADMAP v2.0 milestone header says "planned" but Phases 8-22 (and more) are done

- **File(s):** `.planning/ROADMAP.md` lines 8–11
- **Evidence:**
  ```
  📋 **v2.0 — Parlamentarios 360** — Phases 8-18 … — planned
  📋 **v3.0 — Cobertura de datos** — Phases 23-32 … — planned
  📋 **v4.0 — De datos a cruces verificables** — Phases 33-40 … — planned
  ```
  But memory and MILESTONES.md confirm: v2.0 through Phase 22 is shipped, v3.0 phases 23-37 are complete, v4.0 Phases 41-42 are write-complete, Phase 43 is active. The milestone summary bullets call all three post-v1.0 milestones "planned" when they are largely executed.
- **Repro:** Any agent reading the milestone overview will think v2.0–v4.0 are entirely in the future. The `📋` emoji (planning) vs `✅` (done) is stale for v2.0/v3.0 which are functionally shipped (gated items aside). New contributors get a completely wrong picture of project state.
- **Severity:** high
- **Blast radius:** Onboarding; any agent using ROADMAP.md as the state-of-world for planning decisions.
- **Proposed action (do NOT apply):** Update the milestone bullets to reflect shipped vs planned status. v2.0 phases 8-22 are shipped; v3.0 phases 23-37 are shipped; v4.0 is in-progress. Use a `🚧` or `✅` appropriately.

---

### PLAN-05: Duplicate legal dossiers (byte-identical twins) between phase dirs and `docs/legal/`

- **File(s):**
  - `.planning/phases/13-compuerta-legal-bloque-money-ley-21-719/13-LEGAL-DOSSIER.md`
  - `docs/legal/13-LEGAL-DOSSIER.md`
  - `.planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-LEGAL-DOSSIER.md`
  - `docs/legal/41-LEGAL-DOSSIER-CRUCES.md`
- **Evidence:** `diff` of both pairs returns no output — confirmed byte-identical at 2026-06-24. This is intentional (CRUCEN-02 required the twin in docs/legal/). Memory confirms: "dossier 41-LEGAL-DOSSIER-CRUCES ×2 byte-idéntico."
- **Repro:** If one copy is edited (e.g., to update `observaciones` after a future legal review of the December 2026 new data law), the other copy will silently drift. The authoritative copy is ambiguous — which one does the signoff scanner check?
- **Severity:** medium
- **Blast radius:** A future legal review updates `docs/legal/41-LEGAL-DOSSIER-CRUCES.md` front-matter to `signoff: re-reviewed` but the phase copy still says `signoff: approved` from 2026-06-24. Any agent that reads the phase copy will see a stale status.
- **Proposed action (do NOT apply):** Decide which copy is canonical (recommend `docs/legal/` as the signed artifact) and convert the phase-dir copy to a symlink or a pointer file. Do not delete either — the current byte-identical state is not a problem, but drift will be. Add a comment or `<!-- CANONICAL: docs/legal/41-LEGAL-DOSSIER-CRUCES.md -->` marker to the phase-dir copy.

---

### PLAN-06: `docs/legal/17-LEGAL-DOSSIER-NET.md` sign-off status is `pending` but no ROADMAP entry tracks when/how it becomes `approved`

- **File(s):** `docs/legal/17-LEGAL-DOSSIER-NET.md`, `.planning/ROADMAP.md` Phase 31 (line 473)
- **Evidence:**
  ```
  - [ ] Phase 31: SIGNOFF — Gate legal F17 (NET) … (DEFERIDO 2026-06-22 — gate humano/legal: el dossier `17-LEGAL-DOSSIER.md` ya existe; el grafo YA tiene 7.394 aristas → listo para encender en cuanto un abogado externo firme `signoff: approved`)
  ```
  Phase 31 is listed under v3.0 "planned" which the milestone header shows as "planned" (not shipped). There is no associated HANDOFF or calendar marker.
- **Repro:** In 2027, someone wants to enable `NET_PUBLIC_ENABLED`. They look for the legal sign-off. The dossier exists, status is `pending`. Who do they ask? The ROADMAP says "un abogado externo" but does not name one or give a process. Phase 39 in v4.0 bundles F13/F17/cruces but that phase is also `[ ]` and gated on other phases.
- **Severity:** medium
- **Blast radius:** Gate for the NET grafo is permanently stuck at `pending` unless someone actively tracks and follows up the legal review. This is a process gap, not a code gap.
- **Proposed action (do NOT apply):** Add a `OPERATOR-ACTION` note to Phase 31 naming the contact (Carlos Sánchez Rossi already signed CRUCES; presumably same for NET) and a target date (given the December 2026 data law review mentioned in the CRUCES dossier). This is documentation debt only.

---

### PLAN-07: Memory note on `lobby_sector` vs `lobby_sector_aporte` CRUCE-03 wording — not reflected in the legal dossier

- **File(s):** `memory/v4-cruces-progreso.md` (seed from current session), `.planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-LEGAL-DOSSIER.md` §1
- **Evidence:** Memory notes "(gotcha: cambiar returns table=42P13→drop obligatorio→re-arma DEFAULT-PRIVILEGES re-grant→re-revoke; pgTAP idiom=`proargnames`/`array_to_string` no `pg_get_function_result`; …CRUCE-03 (dossier 41-LEGAL-DOSSIER-CRUCES ×2 byte-idéntico, signoff pending gate 3)." The dossier §1 (lines 57-63) correctly states that `lobby_sector_aporte` is reserved for Phase 40 and the CHECK excludes it. ROADMAP line 864 also says `lobby_sector_aporte` is Phase 40.
  The memory shorthand "CRUCE-03 wording note (lobby_sector vs lobby_sector_aporte)" suggests there WAS a wording discrepancy at some point — but after reading both the dossier and the ROADMAP, they are internally consistent: `tipo_senal = 'lobby_sector'` is what exists now, `'lobby_sector_aporte'` is gated.
- **Repro:** The memory note reads as if there is a live wording inconsistency, but inspection shows the docs are consistent. The MEMORY pointer may be a false alarm — or it may refer to an earlier draft that was corrected.
- **Severity:** low
- **Blast radius:** Operator might spend time auditing a non-issue. The memory note could mislead a Phase 43 agent into investigating this non-existent discrepancy.
- **Proposed action (do NOT apply):** Validate in Phase 43 that `cruce_senal.tipo_senal` CHECK constraint in migration 0039 only allows `'lobby_sector'` (not `'lobby_sector_aporte'`). If confirmed consistent, annotate in Phase 43 DEBT-LEDGER as WON'T-FIX / false-positive.

---

### PLAN-08: Stale HANDOFF files for fully-completed phases

- **File(s):**
  - `.planning/HANDOFF-2026-06-22.md` — covers deploy Phase 20/21/22 state as of 2026-06-22
  - `.planning/HANDOFF-search-coverage-2026-06-23.md` — covers ingest backfill for idea matrices
  - `.planning/HANDOFF-2026-06-23-gov-map.md` — covers gov-map transfer and cron setup
  - `.planning/HANDOFF-41-crucen.md` — Phase 41 handoff (phase is COMPLETED and ENCENDIDO)
- **Evidence:** Memory confirms all these phases are closed and shipped. The HANDOFF-2026-06-22 notes a prod URL (`observatorio-congreso.thevalis.workers.dev`) and deploy id (`8c8d0f0b`) that are superseded. HANDOFF-41-crucen is for a phase that is confirmed ENCENDIDO 2026-06-24.
- **Repro:** An agent in 2027 reading `.planning/HANDOFF-41-crucen.md` sees it says "CRUCEN" as the active phase and the gates as pending — but Phase 41 is done. This clutter creates confusion about what is actually pending.
- **Severity:** low
- **Blast radius:** Clutter in HANDOFF dir. Stale URLs and deploy ids in HANDOFF-2026-06-22 are misleading if taken at face value. HANDOFF-41 could mislead about Phase 41 status.
- **Proposed action (do NOT apply):** Archive completed HANDOFFs by moving them to a `.planning/archive/handoffs/` directory, OR add a `<!-- COMPLETED: <date> -->` header to each. The active ones are HANDOFF-42-lockdown and HANDOFF-43-debt. Do not delete — they hold historical context.

---

### PLAN-09: ROADMAP Phase 43 entry says "added 2026-06-24" but has no Success Criteria or plan list (incomplete scaffolding)

- **File(s):** `.planning/ROADMAP.md` line 775
- **Evidence:**
  ```
  - [ ] **Phase 43: DEBT — Eliminación de deuda técnica …** (added 2026-06-24)
  ```
  No plan list, no success criteria section, no "Phase Details" block under "### Phase 43." Phase 42 has a full detail block; Phase 43 does not.
- **Repro:** An agent executing Phase 43 that reads ROADMAP for the success criteria will find nothing and must fall back to `43-CONTEXT.md`. This creates divergence risk: the CONTEXT is authoritative but the ROADMAP (which GSD agents normally check) is empty.
- **Severity:** low
- **Blast radius:** GSD plan/execute agents that use ROADMAP as the state source will see an incomplete entry and may not correctly mark Phase 43 as in-progress or complete.
- **Proposed action (do NOT apply):** Add a Phase 43 detail block to ROADMAP.md matching the pattern of Phase 41/42 (Goal, Depends on, Success Criteria, Plans list). Can be done during or after Phase 43 execution.

---

### PLAN-10: `docs/deploy-cloudflare.md` and `docs/TRANSFER-to-cuchecorp.md` may contain stale URLs/worker names

- **File(s):** `docs/deploy-cloudflare.md`, `docs/TRANSFER-to-cuchecorp.md`
- **Evidence:** Memory confirms: "repo→Cuchecorp/gov-map (operador; secrets NO se transfieren, re-cargar 9 de .env+2 cloudflare; worker NO se renombra)". The HANDOFF-2026-06-23-gov-map notes the remote was updated to `github.com/Cuchecorp/gov-map` and deploy is on `observatorio-congreso` worker. These docs were likely written pre-transfer.
- **Repro:** Without reading the actual doc content (not read in this scan), if they reference `xenaquis/Observatorio` or the old remote, a future operator following them will push to the wrong remote.
- **Severity:** low (needs validation)
- **Blast radius:** Operator following stale deploy docs pushes to the wrong repo or configures the wrong worker.
- **Proposed action (do NOT apply):** Read `docs/deploy-cloudflare.md` and `docs/TRANSFER-to-cuchecorp.md`; grep for `xenaquis` or old repo names; update if stale. Needs validation — could be a false positive if docs were updated.

---

### PLAN-11: `docs/RUNBOOK-lockdown-cutover.md` may be redundant with/contradictory to Phase 42 HANDOFF runbook

- **File(s):** `docs/RUNBOOK-lockdown-cutover.md`, `.planning/HANDOFF-42-lockdown.md`
- **Evidence:** Both files exist. The HANDOFF-42-lockdown has an embedded runbook section ("GATES LOCKED — INVIOLABLES"). The `_validation-B-cutover-revoke.md` adds further mandatory steps (DEFAULT_ACL revoke, view audit, live curl probe). It is not verified whether `docs/RUNBOOK-lockdown-cutover.md` incorporates all the Opus-validator-required steps.
- **Repro:** Operator follows `docs/RUNBOOK-lockdown-cutover.md` to do the cutover but the file predates or misses the Opus-added requirements (DEFAULT_ACL reversal, LOCKDOWN-03 fail-closed guard, view probe in LOCKDOWN-04). The cutover appears to succeed but a future migration silently re-grants anon (the BLOCKER from validation-B §1d).
- **Severity:** medium (needs validation — if RUNBOOK was written post-validation it may be fine)
- **Blast radius:** Incorrect cutover of Phase 42 is catastrophic (either site down or anon re-granted silently by next migration).
- **Proposed action (do NOT apply):** Read `docs/RUNBOOK-lockdown-cutover.md`; compare its steps with validation-B §1–5 requirements (especially: DEFAULT_ACL reversal in 0044, view audit, fail-closed LOCKDOWN-03, live curl probe). If the runbook predates the Opus validations, update it to incorporate the BLOCKERs.

---

### PLAN-12: `docs/DECISION-cadencia-ingesta.md` — unknown staleness risk

- **File(s):** `docs/DECISION-cadencia-ingesta.md`
- **Evidence:** File exists in `docs/`. Not read in this scan. Memory notes cron architecture changed: "Crons semanales: agenda lun (+DEEPSEEK/R2), leyes vie 20:00 UTC NUEVO (run-tramitacion-prod-cli refresca set proyecto∪citacion_punto∪sesion_tabla_item)". If this decision doc describes the old cadence (pre-v4 cron changes), it is stale.
- **Repro:** An agent consulting cadence decisions reads stale data and sets up new crons at the wrong frequency or using the wrong pattern.
- **Severity:** low (needs validation)
- **Blast radius:** Cron misconfiguration for future connectors.
- **Proposed action (do NOT apply):** Read and verify `docs/DECISION-cadencia-ingesta.md`; compare against the crons as documented in MEMORY (agenda-weekly Mon, leyes-weekly Fri 20:00 UTC) and the actual `.github/workflows/*.yml` files.

---

### PLAN-13: MEMORY pointer `[HANDOFF búsqueda-cobertura 2026-06-23]` uses an absolute path in the memory entry

- **File(s):** `memory/MEMORY.md` (the `v4-cruces-progreso` and `HANDOFF búsqueda-cobertura` entries)
- **Evidence:** The MEMORY.md entry reads:
  > `[HANDOFF búsqueda-cobertura 2026-06-23](../../../OneDrive%20-%20pjud.cl/Documentos/GitHub/Observatorio/.planning/HANDOFF-search-coverage-2026-06-23.md)`
  This is an absolute path relative to the user's OneDrive, encoded with `%20`. Same for the milestone v4 pointer. These paths are machine-specific and will break if the repo is cloned elsewhere or if OneDrive path changes.
- **Repro:** A Claude session on a different machine or a CI environment that reads MEMORY.md and tries to follow the link will get a 404 or path error.
- **Severity:** low
- **Blast radius:** Memory resolution fails silently; agent loses context it thought it had.
- **Proposed action (do NOT apply):** Convert absolute paths in MEMORY.md to repo-relative paths (`.planning/HANDOFF-search-coverage-2026-06-23.md`). These are markdown links — the absolute form was likely written by the GSD memory agent on Windows and not normalized.

---

### PLAN-14: Phase 43 `43-CONTEXT.md` exists but `43-RESEARCH.md`, `43-VALIDATION.md`, and `43-DEBT-LEDGER.md` do not yet exist

- **File(s):** `.planning/phases/43-debt-eliminacion-deuda-tecnica/43-CONTEXT.md` (exists), missing siblings
- **Evidence:** Glob of `43-*` only shows `43-CONTEXT.md` and `43-discovery-planning.md` (this file). The HANDOFF-43 expects `43-RESEARCH.md`, `43-VALIDATION.md`, `43-DEBT-LEDGER.md` as outputs of the Phase 43 swarm execution.
- **Repro:** Not a pre-existing debt — this is the current phase being bootstrapped. No action needed here. Listed for completeness.
- **Severity:** low (expected state for an in-progress phase)
- **Blast radius:** None — the phase is active.
- **Proposed action (do NOT apply):** Create as part of Phase 43 execution.

---

## False Positives / Seeds That Did Not Verify

| Seed | Finding |
|---|---|
| "EOL/CRLF churn from gsd-planner" | Not verified in this scan (would require file-level byte inspection). Flagged as known but not confirmed at the planning/docs layer — worth checking in dimension 5 (deps/config/build). |
| "Duplicated/contradictory phase artifacts" | All phases have consistent single copies. No duplicate PLAN files found. The only twins are the intentional byte-identical dossier copies (PLAN-05). |
| Phase 38-40 dirs missing | Confirmed: no dirs exist for Phases 38, 39, 40. This is correct — those phases are `[ ]` / not started. No debt here. |
| REQUIREMENTS.md Traceability vs ROADMAP drift | REQUIREMENTS.md not fully read in this scan. Recommend a targeted read of REQUIREMENTS.md §Traceability table as part of Phase 43 execution to cross-check CRUCE-01..03 and LOCKDOWN-01..04 entries. |
