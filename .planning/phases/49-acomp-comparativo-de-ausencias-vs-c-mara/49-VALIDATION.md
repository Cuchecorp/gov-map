---
phase: 49
slug: acomp-comparativo-de-ausencias-vs-c-mara
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
validated: 2026-07-08
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app/) + pgTAP (supabase/tests, post-apply) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && npx vitest run <archivo>` |
| **Full suite command** | `cd app && npx vitest run && npx tsc --noEmit` |
| **pgTAP command** | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0050_tasa_ausencia_comparada.test.sql` |
| **Estimated runtime** | ~3s (vitest 2 files) / ~49s (suite) |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 49 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 49-01-01 | 01 | 1 | VIZ-03 | T-49-09 | RPC `tasa_ausencia_comparada` PII-safe: security definer, `search_path=''`, doble revoke, CERO grant, anon-no-execute; contrato de 6 columnas pineado; guard div/0 estructural (having ≥1) | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0050_tasa_ausencia_comparada.test.sql` (10/10) | ✅ | ✅ green |
| 49-01-02 | 01 | 1 | VIZ-03 | — | `AusenciaContextoRow` shape plano PII-safe (ratio [0,1], mediana nullable); `tasa_ausencia_comparada` en PUBLIC_RPC_ALLOWLIST (guard B) | unit | `cd app && npx vitest run lib/lockdown-guard.test.ts` (8/8) | ✅ | ✅ green |
| 49-01-03 | 01 | 1 | VIZ-03 | T-49-09 | pgTAP con cohorte determinista aislada (delete-en-tx rollback) → mediana 0.50/K=3 + caso M=0 (0 filas) | pgTAP | (incluido en 0050 test.sql, 10/10) | ✅ | ✅ green |
| 49-02-01 | 02 | 2 | VIZ-03 | — | sub-bloque presentación puro (nunca importa cliente Supabase, frontera F45); degrade 3 caminos PGRST202→null / error→throw #34; omisión honesta mediana null; copy contract LOCKED sin color/bold; negative-match anti-insinuación + RUT | unit | `cd app && npx vitest run components/ausencias-contexto.test.tsx` (7/7) | ✅ | ✅ green |
| 49-02-02 | 02 | 2 | VIZ-03 | — | montaje tras "Cómo votó" sin regresión; capa-1 byte-idéntica | unit | `cd app && npx vitest run components/votos-por-parlamentario.test.tsx` | ✅ | ✅ green |
| 49-03-01 | 03 | 3 | VIZ-03 | T-49-10 | gate 719/719 + tsc exit 0 ANTES del deploy; redeploy PROD + smoke degrade honesto pre-apply | manual | curl smoke + gate (ver Manual-Only) | — | ✅ manual |
| 49-03-02 | 03 | 3 | VIZ-03 | T-49-09 | checkpoint operador: apply 0049+0050 + ambos pgTAP post-apply + veredicto visual | manual | operador (RESUELTO 2026-07-08) | — | ✅ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure (vitest en app/ + pgTAP en supabase/tests) cubre todos los requisitos automatizables. La RPC 0050 se pineó por pgTAP TDD antes del apply; los RTL se crearon RED→GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Degrade honesto pre-apply en PROD | VIZ-03 (49-03-01) | Requiere deploy real + smoke contra PROD | `curl .../parlamentario/D1012` → 200; heading `Ausencias en contexto` count 0 pre-apply, `Cómo votó` count 1, sin 500 |
| Sub-bloque con datos reales post-apply | VIZ-03 (49-03-02) | Requiere apply de DDL a PROD (checkpoint operador — RESUELTO 2026-07-08) | Post-apply `/parlamentario/D1012`: "Ausente en 1 de 141 votaciones (0,7%). · Mediana de su cámara: 0,7% (155 parlamentarios). · Sobre las votaciones ingestadas…" — copy verbatim, cero color-veredicto |

*pgTAP 0050 (contrato + datos + no-PII + anon-no-execute) es automatizado; sólo el apply del DDL a PROD y la inspección visual del pixel son manual-only.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — infra existente)
- [x] No watch-mode flags
- [x] Feedback latency < 49s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

VIZ-03 (único requisito) COVERED por 15 tests vitest verdes (`ausencias-contexto.test.tsx` 7 + `lockdown-guard.test.ts` 8, verificados esta corrida) más pgTAP `0050_tasa_ausencia_comparada.test.sql` (10/10, aplicado y verde contra el schema PROD — checkpoint operador RESUELTO 2026-07-08). El deploy/smoke y el apply del DDL son manual-only por naturaleza. Cero gaps automatizables. Nyquist-compliant.
