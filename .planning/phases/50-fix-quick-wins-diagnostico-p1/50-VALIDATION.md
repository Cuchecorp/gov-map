---
phase: 50
slug: fix-quick-wins-diagnostico-p1
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
validated: 2026-07-08
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fuente autoritativa del mapa bug→test: `50-RESEARCH.md §Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (RTL para componentes) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `cd app && npx vitest run <archivo>.test.tsx` |
| **Full suite command** | `cd app && npx vitest run` (400+ verde) + `npx tsc -b` |
| **Estimated runtime** | ~8 s (10 files) / ~90 s suite |

---

## Sampling Rate

- **After every task commit:** Run del test del componente tocado (quick command)
- **After every plan wave:** `cd app && npx vitest run` completo + `tsc -b`
- **Before `/gsd:verify-work`:** Suite completa verde (≥377, cero regresión) + lockdown-guard verde
- **Max feedback latency:** ~90 s

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-------------|-----------------|-----------|-------------------|-------------|--------|
| B1 | pill home válido | pill apunta a boletín existente en PROD | RTL | `npx vitest run app/page.test.tsx` (12/12) | ✅ | ✅ green |
| B6 | umbral ámbar por cadence | 6 días NO stale; >14 días stale | unit | `npx vitest run lib/format.test.ts components/provenance-badge.test.tsx` | ✅ | ✅ green |
| B7 | agenda honest-errors (#34) | `.error` ⇒ throw, nunca "No hay citaciones" | RTL/unit | suite agenda | ✅ | ✅ green |
| B8 | sin chip "desconocida" | `camara` desconocida ⇒ chip omitido | RTL | `npx vitest run components/camara-chip.test.tsx` (5/5) | ✅ | ✅ green |
| B9 | error.tsx ×N es-CL | boundaries existen (7: app/, agenda, buscar, parlamentarios, parlamentario/[id], contraparte/[id], proyecto/[boletin]) | source/estructural | `find app -name error.tsx` (7 presentes) | ✅ | ✅ present |
| B10 | copy lobby por cámara | senador ⇒ nunca "camara.cl/transparencia" | RTL | `npx vitest run components/lobby-de-parlamentario.test.tsx` (35/35) | ✅ | ✅ green |
| B12 | locale correcto | "Jueves 2 de julio" (sin "De Julio") | unit | `npx vitest run lib/format.test.ts` | ✅ | ✅ green |
| B14 | desenlace null honesto | resultado null ⇒ "Desenlace no informado por la fuente." | RTL | `npx vitest run components/votacion-card.test.tsx` (5/5) | ✅ | ✅ green |
| B15 | copy Mensaje | iniciativa="Mensaje" ⇒ "Iniciativa del Ejecutivo (Mensaje)." | RTL | `npx vitest run components/autores-list.test.tsx` | ✅ | ✅ green |
| B17 | guard fecha WR-03 | fecha null/empty ⇒ "fecha no informada", nunca Invalid Date | unit | `npx vitest run lib/format.test.ts` (fechaCortaSegura) | ✅ | ✅ green |
| HS-rep | honest-state 1×/sección | nota una vez, no por arco | RTL | `npx vitest run components/votos-por-parlamentario.test.tsx` (65/65) | ✅ | ✅ green |
| Global | cero regresión (PII Camino A) | suite ≥377 verde, tsc limpio, lockdown-guard verde, negative-match vocab | suite | `npx vitest run && npx tsc -b` | ✅ | ✅ green (VERIFICATION 12/12, suite 400) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `components/camara-chip.test.tsx` — B8 (chip omitido si cámara desconocida). FILLED (5/5).
- [x] `components/autores-list.test.tsx` — B15 (copy Mensaje). FILLED.
- [x] `lib/format.test.ts` extendido — B6/B12/B17 (cadence ámbar, capitalización es-CL, fechaCortaSegura NaN-safe). FILLED (16 asserts de fecha/locale/guard).
- [x] error.tsx boundaries — B9 (7 boundaries es-CL con `unstable_retry`). Presentes.
- [x] Framework install: ninguno.

---

## Manual-Only Verifications

*Todos los comportamientos de la fase tienen verificación automatizada o presencia estructural (error boundaries). El deploy en vivo (3ade68b8, 2026-07-02) confirmó los fixes en PROD.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (filled durante ejecución)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 5 (Wave 0: camara-chip, autores-list, format ext, error-boundaries, agenda) |
| Resolved | 5 (todos filled durante ejecución de F50) |
| Escalated | 0 |

Los 11 fixes (B1/B6/B7/B8/B9/B10/B12/B14/B15/B17/HS-rep) + regresión global COVERED por 173 tests verdes en 10 archivos + 7 error boundaries presentes, verificados esta corrida. VERIFICATION previa passed 12/12 (suite 400). Los gaps Wave 0 ya estaban filled en ejecución. Cero gaps automatizables pendientes. Nyquist-compliant.
