---
phase: 52-cruce2-cruces-nuevos
verified: 2026-07-06T20:20:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Deploy the frontend to Cloudflare, then open /proyecto/16743-04 and confirm the 'Reuniones de lobby registradas en el mismo período' carril renders the 5 live audiencias with the anti-causal caveat once, plain-text names, and a working 'Ver fuente oficial' link per row."
    expected: "Carril mt-12 with heading + caveat + neutral count + one row per audiencia; no causal language; source link opens the official record."
    why_human: "Visual appearance + real PROD data flowing through a DEPLOYED frontend cannot be verified programmatically; the frontend deploy is documented operator debt (52-06 SUMMARY) and the carriles live only in the repo until then."
  - test: "On the deployed home /, confirm the actualidad module shows 3 blocks ('Votado esta semana', 'Urgencias vigentes', 'Última actualización de datos') under the hero, each with real data or an honest empty-state, without a 500."
    expected: "Three independent panels render; hero unchanged; force-dynamic serves fresh data."
    why_human: "Visual layout + live data rendering under force-dynamic requires a deployed environment; not observable via unit tests."
  - test: "On a deployed project ficha with a live citation (fecha >= hoy), confirm the '¿Dónde está hoy?' block shows the 'Citado en {comisión} el {fecha}.' line, and that it is omitted (not '—') where no upcoming citation exists."
    expected: "Line appears only when a vigente/future citation exists; omitted honestly otherwise."
    why_human: "Requires a deployed ficha with live citation data to confirm the derived line renders and omits correctly."
---

# Phase 52: CRUCE2 — Cruces nuevos Verification Report

**Phase Goal:** Encender los cruces de mayor ROI que NO requieren ingesta nueva: clasificador sectorial (des-raquitiza cruce_senal), lobby×tramitación por semana ISO (yuxtaposición pura), proyecto→agenda inverso, módulo de actualidad en home.
**Verified:** 2026-07-06T20:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Clasificador sectorial corrido → `cruce_senal` re-materializado con cobertura real (>>30), verificado con psql | ✓ VERIFIED | Read-only psql PROD: `cruce_senal`=**781** (was 30), distinct parlamentarios=**134** (was 24), distinct sectores=**13** (was 10), `lobby_contraparte` con sector=**2715** (was 34), `proyecto_ficha` con sector=**65/74** (was 0). |
| SC2 | Lobby×tramitación: RPC + UI yuxtaposición fechada, cero lenguaje causal (negative-match) | ✓ VERIFIED | RPC `lobby_en_tramitacion` live in PROD: `prosecdef=t`, `search_path=""`, 8-col contract incl `audiencia_id`; smoke `16743-04` → 5 rows / 5 distinct audiencias. UI `lobby-en-tramitacion.tsx` mounts carril `#lobby-tramitacion mt-12` with caveat 1×, plain-text name, degrade honesto (exact PGRST202). Grep: zero banned causal vocab in rendered strings (only in prohibitory comments). |
| SC3 | Proyecto→agenda: ficha muestra "Citado en {comisión} el {fecha}" | ✓ VERIFIED | `estado-actual-block.tsx`: `citacionVigente()` pure derivation (L100) + rendered line "Citado en {comision} el {fecha}" (L211-215) with omit-when-not-derivable (L176). 21 tests pass. |
| SC4 | Módulo de actualidad en home: 3 bloques; home deja de ser solo buscador | ✓ VERIFIED | `actualidad-module.tsx`: 3 blocks (Votado esta semana / Urgencias vigentes / Última actualización), reuses `urgenciaVigente` + `conteoVotacion`, reads no-PII. `app/page.tsx`: `export const dynamic = "force-dynamic"` (L11) + `<ActualidadModule/>` mounted (L82). 16+7 tests pass. |
| SC5 | Suite verde + tsc limpio + lockdown-guard verde (RPCs allowlisted) + anti-insinuación intacta + apply 0047+0048 | ✓ VERIFIED | `tsc -b` exit 0 (independently run). lockdown-guard 8/8; `lobby_en_tramitacion` in PUBLIC_RPC_ALLOWLIST (alpha order). cruces 33/1-skip; phase-52 components 61/61. anon deny=**f** (Camino A); double revoke + zero grant in 0048; 0047+0048 stamped in PROD. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0048_lobby_en_tramitacion.sql` | RPC idiom 0047, PII-safe, double revoke, zero grant, 8-col (WR-07) | ✓ VERIFIED | create-or-replace + drop (42P13), security definer, `search_path=''`, `select distinct`, 2 revokes, 0 grants. Deployed contract matches file. |
| `supabase/tests/0048_lobby_en_tramitacion.test.sql` | pgTAP contract + week fixture | ✓ VERIFIED | Ran by operator 52-06: 10/10 ok against applied schema. |
| `app/components/lobby-en-tramitacion.tsx` | Carril SC2 + degrade honesto | ✓ VERIFIED (275 lines) | Pure view + RSC, caveat, PGRST202-only gate, audiencia_id dedup, plain-text name, provenance/row. |
| `app/components/estado-actual-block.tsx` | citacionVigente + SC3 line | ✓ VERIFIED | Derivation + render + omit rule. |
| `app/components/actualidad-module.tsx` | 3-block home module | ✓ VERIFIED (18KB) | 3 blocks no-PII, empty-states, force-dynamic consumer. |
| `app/app/page.tsx` | force-dynamic + module mount | ✓ VERIFIED | force-dynamic L11, mount L82, hero intact. |
| `app/app/proyecto/[boletin]/page.tsx` | `#lobby-tramitacion mt-12` mount | ✓ VERIFIED | Section L88 + Suspense + LobbyEnTramitacionSection L90. |
| `packages/cruces/src/clasificar-lobby-cli.ts` | `--solo-confirmadas` incremental + WR-06 cursor | ✓ VERIFIED | `.is("sector_id",null)` + `!inner` confirmadas, cursor on `id` PK (`.gt("id")`/`.order("id")`), RUT-gate intact. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `lobby-en-tramitacion.tsx` | rpc `lobby_en_tramitacion` | `sb.rpc(...)` | ✓ WIRED | RPC live PROD, returns 5 rows for smoke boletin. |
| `estado-actual-block.tsx` | `citacion_punto × citacion` | `.from('citacion_punto')` | ✓ WIRED | Third no-PII read in Promise.all; embed flattened. |
| `actualidad-module.tsx` | `votacion / tramitacion_evento / fecha_captura` | `.from()` no-PII | ✓ WIRED | 3 blocks read real tables; lockdown-guard green. |
| `clasificar-lobby-cli --solo-confirmadas` | `materializar_cruces()` | sector_id → FULL REBUILD | ✓ WIRED | 781 señales materialized in PROD (verified psql). |
| `0048.sql` | `citacion.semana_iso` | `to_char(... 'IYYY"-W"IW')` | ✓ WIRED | Deployed; smoke coincidence by ISO week confirmed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `lobby-en-tramitacion.tsx` | `rows` | RPC `lobby_en_tramitacion` (PROD) | Yes — 5 real audiencias for 16743-04 | ✓ FLOWING |
| `cruce_senal` (materialized) | señales | `materializar_cruces()` over populated sector_id | Yes — 781 rows / 134 parls | ✓ FLOWING |
| `actualidad-module.tsx` | votaciones/urgencias/frescura | no-PII `.from()` reads | Live (renders in deployed env) | ✓ FLOWING (pre-deploy: honest empties) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| RPC live + PII-safe deny | psql `has_function_privilege('anon',...)` | `f` | ✓ PASS |
| RPC 8-col contract (WR-07) | psql `proargnames` | `...enlace_detalle,audiencia_id` | ✓ PASS |
| RPC returns real rows | psql `select count(*) ... ('16743-04')` | 5 rows / 5 distinct aud | ✓ PASS |
| cruce_senal materialized | psql `count(*) from cruce_senal` | 781 | ✓ PASS |
| tsc clean | `pnpm exec tsc -b` | exit 0 | ✓ PASS |
| lockdown-guard | `vitest run lib/lockdown-guard` | 8/8 | ✓ PASS |
| phase-52 components | `vitest run` (4 files) | 61/61 | ✓ PASS |
| cruces suite | `pnpm --filter @obs/cruces test` | 33/1-skip | ✓ PASS |

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CRUCE-01..03 | Phase 36 (Complete); "extiende" per ROADMAP | Sector catalog + cruce_senal + materializador + PII-safe RPC | ✓ SATISFIED (extended) | Phase 52 tag `CRUCE2` is a phase label, not a formal ID; no new REQ IDs introduced. CRUCE-03's "≥5 parlamentarios / factual wording / no PII projection" is re-satisfied at scale: 134 parls, neutral count, RPC projects no rut/partido/email/donante. |

No orphaned requirements: ROADMAP maps no discrete REQ-IDs to Phase 52 beyond the "extiende CRUCE-01..03" note; all plan `requirements` fields use the `CRUCE2` phase tag + SC labels.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | No debt markers (TBD/FIXME/XXX) in phase files | — | Clean |

7 Info findings from 52-REVIEW.md remain open (IN-01..IN-07) — all non-blocking quality/timezone edge notes; both Warnings (WR-06/WR-07) were fixed (commits 7374ff0, 48db0d0) and verified above. No blockers.

### Human Verification Required

The phase deliverables (code, RPC, data) are all verified at the code + data + PROD-RPC level. The citizen-visible rendering of the three UI surfaces (SC2 carril, SC3 line, SC4 home module) awaits a **Cloudflare frontend deploy**, which is documented operator debt (52-06 SUMMARY "Deuda restante") and consistently deferred as a separate step in this project. Post-deploy visual/user-flow checks are listed in frontmatter `human_verification`.

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria are verified. Migrations 0047+0048 are applied and stamped in PROD (pgTAP 11/11 and 10/10), anon deny confirmed (`f`), cruce_senal is de-raquitized to 781 live señales, all suites green, tsc clean, lockdown-guard green with the new RPC allowlisted, and anti-insinuación is intact (zero causal vocab in rendered strings). The only open items are post-deploy visual confirmations (human) and 7 non-blocking Info notes.

---

_Verified: 2026-07-06T20:20:00Z_
_Verifier: Claude (gsd-verifier)_
