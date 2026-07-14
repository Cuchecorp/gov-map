---
phase: 72
slug: dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 72 — Validation Strategy

> Additive migration (0052) + a new materializer insert branch. Sector sourced from the lobby classification, joined to ChileCompra money by exact RUT (doubly fail-closed). Factual count + PII-safe jsonb evidence, no causality. Empty-honest today.

---

## Resolved design (operator decision 2026-07-14)

- **Sector source:** `lobby_contraparte.sector_id` (migration 0038) — the sector already classified on the lobby side. A company counts in the signal ONLY if it has BOTH a RUT-linked ChileCompra contract AND a known lobby sector (doubly fail-closed).
- **Money source:** ChileCompra contracts by EXACT RUT (Phase 70). SERVEL (by name, no RUT) is OUT of this signal — including it would violate SC#3's "RUT presente" fail-closed rule.
- The CHECK is NOT actually reserved (only a comment) → the additive migration must extend `check (tipo_senal in ('lobby_sector'))` → `('lobby_sector','lobby_sector_aporte')`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (Supabase DB tests) + vitest where TS logic touched |
| **DB test run** | `supabase test db` / `psql -tA -f` against the pgTAP suite (per prior memory) |
| **Migration** | next number `0052`; applied via `db push --db-url` (controlled/operator) |
| **Full rebuild** | `cruces.materializar_cruces()` transactional delete+insert (existing pattern) |

---

## Sampling Rate

- After the migration + materializer branch: run the cruces pgTAP suite + the no-PII body assertion.
- Before verify: additive CHECK proven; existing `lobby_sector` insert preserved verbatim; new branch yields 0 rows today (empty-honest).

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| `cruce_senal` includes `lobby_sector_aporte` as a FACTUAL COUNT with jsonb evidence (source links), NEVER a correlation score | MONEY-03 | pgTAP | cruces suite | ⬜ pending |
| Migration is ADDITIVE (CHECK extended to include the new token + a NEW insert branch); existing `lobby_sector` insert UNCHANGED; materializer is FULL REBUILD transactional idempotent | MONEY-03 | pgTAP | cruces suite | ⬜ pending |
| Signal counts ONLY parliamentarians with RUT present (via ChileCompra RUT + lobby sector); no RUT → 0 rows honest, never false; join by confirmed `parlamentario_id`; NO `rut` in the body (pgTAP `\y(partido\|rut)\y` guard) | MONEY-03 | pgTAP | cruces suite | ⬜ pending |
| No causal claim ("financió su voto"/"a cambio de") in the signal token, label, or evidence | MONEY-03 | grep/pgTAP | cruces suite | ⬜ pending |
| Evidence jsonb is PII-safe (no rut/donante_id); MONEY gate OFF; cron + `cruces_de_parlamentario` RPC inherit automatically (untouched) | MONEY-03 | pgTAP | cruces suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] pgTAP fixture: a parlamentario with a RUT-linked ChileCompra contract whose company has a lobby sector → 1 count row with source-link evidence; a parlamentario without RUT → 0 rows (empty-honest).

*Existing: `cruces.materializar_cruces()` (0039 FULL REBUILD), `cruce_senal`, `lobby_contraparte.sector_id` (0038), `contrato`/`contratista` (0023), maestra RUT (0069/69), cron `cruces-materializar`, RPC `cruces_de_parlamentario` (0040), the 0039 pgTAP no-PII pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply migration 0052 to PROD remote + real signal populated | MONEY-03 | Controlled DDL apply (db push --db-url); real counts need RUT-01 + ChileCompra backfill (operator-pending) | Operator applies 0052, runs `cruces.materializar_cruces()`, verifies the signal populates once money data lands; MONEY stays OFF until the Phase 73 legal flip. |

---

## Validation Sign-Off

- [ ] Additive CHECK + new insert branch; existing lobby_sector insert byte-preserved
- [ ] Factual count + PII-safe jsonb evidence, no causality (grep clean)
- [ ] Fail-closed empty without RUT; join by parlamentario_id; no rut in body
- [ ] Full-rebuild idempotent; cron/RPC untouched
- [ ] MONEY gate OFF
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
