---
phase: 47
slug: vchart-chart-de-votos-ausencias-del-parlamentario
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
validated: 2026-07-08
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app/) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && npx vitest run <archivo>` |
| **Full suite command** | `cd app && npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~4s (2 files) / ~47s (suite) |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 47 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | VIZ-02 | T-47-05 | `agruparVotosPorTrimestre` puro; guard ISO excluye filas sin fecha (omisión honesta), sin trimestres fabricados | unit | `cd app && npx vitest run components/votos-por-parlamentario.test.tsx` | ✅ | ✅ green |
| 47-01-02 | 01 | 1 | VIZ-02 | T-47-SC | isla cliente Recharts stacked-NO-line; fills semánticos single-source, cero petróleo; sin fuga cliente Supabase | unit | `cd app && npx vitest run components/votos-chart.test.tsx` | ✅ | ✅ green |
| 47-01-03 | 01 | 1 | VIZ-02 | — | sub-bloque "Cuándo votó" al tope del detalle; caption factual/empty-state honesto (nunca barra en cero); global no faceta | unit | `cd app && npx vitest run components/votos-por-parlamentario.test.tsx components/votos-chart.test.tsx` | ✅ | ✅ green |
| 47-02-01 | 02 | 2 | VIZ-02 | T-47-04 | gate 712/712 + tsc exit 0 ANTES del deploy (cero deploy sobre rojo) | suite | `cd app && npx vitest run && npx tsc --noEmit` | ✅ | ✅ green |
| 47-02-02 | 02 | 2 | VIZ-02 | T-47-05 | redeploy PROD + smoke curl 5 rutas 200; chart en vivo, empty-state ausente | manual | curl smoke (ver Manual-Only) | — | ✅ manual |
| 47-02-03 | 02 | 2 | VIZ-02 | — | evidencia visual: stacked-por-trimestre + leyenda NOUN + colores semánticos + copy factual | manual | inspección PNG (ver Manual-Only) | — | ✅ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure (vitest en app/) cubre todos los requisitos automatizables de la fase. Sin nuevo framework ni stubs; los tests se crearon TDD RED→GREEN por tarea.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart "Cuándo votó" en vivo en PROD | VIZ-02 (47-02-02) | Requiere deploy real a Cloudflare + smoke contra PROD; no unit-testable | `curl https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1012` → 200; grep heading `Cuándo votó` count 1; empty-state `aún no permiten agruparlas` count 0 |
| Anti-insinuación de la superficie renderizada | VIZ-02 (47-02-03) | Verificación visual (colores, leyenda NOUN, stacked-no-line) sobre pixel real | Inspeccionar `Temp/votos-chart-47-evidencia.png` (D1012, 141 votos): stacked bar discreto `AAAA · Tn`, leyenda sustantiva, cero petróleo en barras, caption "No representa una tendencia" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — infra existente)
- [x] No watch-mode flags
- [x] Feedback latency < 47s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

VIZ-02 (único requisito de la fase) COVERED por 72 tests automatizados verdes (`votos-chart.test.tsx` 7 + `votos-por-parlamentario.test.tsx` 65), verificados en vivo esta corrida. Los tres pasos de deploy/smoke/evidencia (plan 02) son manual-only por naturaleza (deploy real + inspección de pixel). Cero gaps automatizables. Nyquist-compliant.
