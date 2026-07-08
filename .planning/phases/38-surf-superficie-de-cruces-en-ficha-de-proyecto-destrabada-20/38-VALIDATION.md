---
phase: 38
slug: surf-superficie-de-cruces-en-ficha-de-proyecto-destrabada-20
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
validated: 2026-07-08
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app/) + pgTAP (supabase/tests, runner `psql -tA -f` post-apply) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && npx vitest run <archivo>` |
| **Full suite command** | `cd app && npx vitest run && npx tsc -b` |
| **pgTAP command** | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql` |
| **Estimated runtime** | ~3s (vitest 3 files) / ~38s (suite) |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 38 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | SURF-02 | T-38-09 | RPC `cruces_de_proyecto` PII-safe: security definer, `search_path=''`, doble revoke, CERO grant, deny anon; returns table de 8 col SIN partido/rut/email; sector vía proyecto_ficha.sector_id (empty honesto sin ficha) | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql` (10/10) | ✅ | ✅ green |
| 38-01-02 | 01 | 1 | SURF-02 | — | `CruceProyectoRow` PII-safe (parlamentario enlazable, nunca partido/rut/email); `cruces_de_proyecto` en PUBLIC_RPC_ALLOWLIST (guard B) | unit | `cd app && npx vitest run lib/lockdown-guard.test.ts` (8/8) | ✅ | ✅ green |
| 38-01-03 | 01 | 1 | SURF-02 | T-38-09 | pgTAP con fixture rollback: contrato + deny-anon + no-PII (partido presente no emitido) + 1 positivo / 2 negativos | pgTAP | (incluido en 0049 test.sql, 10/10) | ✅ | ✅ green |
| 38-02-01 | 02 | 2 | SURF-02 | T-38-05..08 | `CrucesView` pura: capa-1/2, nombre público LINK / contraparte lobby texto plano + IdentityMarker (DEPARTURE 52-03), caveat anti-causal 1×, voto/reunión SEPARADOS, conteo 3-estado, empty honesto, negative-match banned-vocab + sin RUT | unit (RTL) | `cd app && npx vitest run components/cruces-de-proyecto.test.tsx` (12/12) | ✅ | ✅ green |
| 38-02-02 | 02 | 2 | SURF-02 | — | `CrucesSection` degrade 3 caminos espejo lobby-en-tramitacion: PGRST202→null / otro error→throw #34 / 0 filas→empty | unit (RTL) | `cd app && npx vitest run components/cruces-de-proyecto.test.tsx` | ✅ | ✅ green |
| 38-02-03 | 02 | 2 | SURF-02 | — | `<section id=cruces>` + rail entry gated por `crucesPublicEnabled` (sin ancla muerta); placement DOM tras #lobby-tramitacion, sin disclosure duplicado; CrucesSkeleton anti-CLS | unit (source-scan) | `cd app && npx vitest run "app/proyecto/[boletin]/page-cruces.test.ts"` (8/8) | ✅ | ✅ green |
| 38-03-01 | 03 | 3 | SURF-02 | T-38-10 | gate 689/689 + tsc exit 0 ANTES del deploy; redeploy PROD + smoke degrade honesto pre-apply | manual | curl smoke + gate (ver Manual-Only) | — | ✅ manual |
| 38-03-02 | 03 | 3 | SURF-02 | T-38-09 | checkpoint operador: apply 0049 + pgTAP post-apply + veredicto visual | manual | operador (RESUELTO 2026-07-08) | — | ✅ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure (vitest en app/ + pgTAP en supabase/tests) cubre todos los requisitos automatizables. La RPC 0049 se pineó por pgTAP TDD antes del apply; la UI (CrucesView/Section + page-scan) se cubrió RED→GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Degrade honesto pre-apply en PROD | SURF-02 (38-03-01) | Requiere deploy real + smoke contra PROD | `curl .../proyecto/14309-04` → 200; heading `Cruces con el sector` count 0 pre-apply, Suspense→empty, sin 500; #lobby-tramitacion e #idea-matriz presentes |
| Sección con datos reales post-apply | SURF-02 (38-03-02) | Requiere apply de DDL a PROD (checkpoint operador — RESUELTO 2026-07-08) | Post-apply `/proyecto/14309-04`: "Cruces con el sector del proyecto" ~47 parl. (nombres linkeados, voto/reunión separados, caveat 1×, ProvenanceBadge); `/proyecto/14782-13` empty honesto (sin sector, NO bug) |

*pgTAP 0049 (contrato + deny-anon + no-PII + fixture rollback) es automatizado; sólo el apply del DDL a PROD y la inspección visual del pixel son manual-only.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — infra existente)
- [x] No watch-mode flags
- [x] Feedback latency < 38s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

SURF-02 (único requisito) COVERED por 28 tests vitest verdes (`cruces-de-proyecto.test.tsx` 12 + `page-cruces.test.ts` 8 + `lockdown-guard.test.ts` 8, verificados esta corrida) más pgTAP `0049_cruces_de_proyecto.test.sql` (10/10, aplicado y verde contra el schema PROD — checkpoint operador RESUELTO 2026-07-08; el primer run destapó el bug latente `fuente_voter_id` NOT NULL del fixture, parcheado). El deploy/smoke y el apply del DDL son manual-only por naturaleza. Cero gaps automatizables. Nyquist-compliant.
