---
phase: 50
slug: fix-quick-wins-diagnostico-p1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
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
| **Quick run command** | `pnpm --filter app test -- <archivo>.test.tsx` |
| **Full suite command** | `pnpm --filter app test` (377 verde baseline) + `pnpm --filter app exec tsc -b` |
| **Estimated runtime** | ~60–90 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run del test del componente tocado (quick command)
- **After every plan wave:** `pnpm --filter app test` completo + `tsc -b`
- **Before `/gsd:verify-work`:** Suite completa verde (≥377, cero regresión) + lockdown-guard verde
- **Max feedback latency:** ~90 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| B1 | TBD | TBD | pill home válido | — | pill apunta a boletín existente en PROD | RTL | `pnpm --filter app test -- app/page.test.tsx` | yes (update) | pending |
| B6 | TBD | TBD | umbral ámbar por cadence | — | 6 días NO stale; >14 días stale | unit | `pnpm --filter app test -- lib/format.test.ts` + provenance-badge.test | yes (update) | pending |
| B7 | TBD | TBD | agenda honest-errors (#34) | fallo red ≠ dato fabricado | `.error` ⇒ throw, nunca "No hay citaciones" | RTL/unit | test nuevo de sección agenda | no (Wave 0) | pending |
| B8 | TBD | TBD | sin chip "desconocida" | — | `camara` desconocida ⇒ chip omitido | RTL | `camara-chip.test.tsx` nuevo | no (Wave 0) | pending |
| B9 | TBD | TBD | error.tsx ×4 es-CL | — | boundary existe y usa `unstable_retry` | source-scan | test estructural existencia + contenido | no (Wave 0) | pending |
| B10 | TBD | TBD | copy lobby por cámara | — | senador ⇒ nunca "camara.cl/transparencia" | RTL | lobby-de-parlamentario tests (update) | yes (update) | pending |
| B12 | TBD | TBD | locale correcto | — | "Jueves 2 de julio" (sin "De Julio") | unit | test de helper capitalización | no (Wave 0) | pending |
| B14 | TBD | TBD | desenlace null honesto | — | resultado null ⇒ "Desenlace no informado por la fuente." | RTL | `votacion-card.test.tsx` (update :62) | yes (update) | pending |
| B15 | TBD | TBD | copy Mensaje | — | iniciativa="Mensaje" ⇒ "Iniciativa del Ejecutivo (Mensaje)." | RTL | `autores-list.test.tsx` nuevo | no (Wave 0) | pending |
| B17 | TBD | TBD | guard fecha WR-03 | anti-500 | fecha null/empty ⇒ "fecha no informada", nunca Invalid Date | unit/RTL | tests de `fechaCortaSegura` | no (Wave 0) | pending |
| HS-rep | TBD | TBD | honest-state 1×/sección | — | nota una vez, no por arco | RTL | `votos-por-parlamentario.test.tsx` (update :210) | yes (update) | pending |
| Global | all | final | cero regresión | PII (Camino A) | suite ≥377 verde, tsc limpio, lockdown-guard verde, negative-match vocab | suite | `pnpm --filter app test && pnpm --filter app exec tsc -b` | yes | pending |
