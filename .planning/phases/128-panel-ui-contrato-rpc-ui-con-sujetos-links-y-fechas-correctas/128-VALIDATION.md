---
phase: 128
slug: panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 128 — Validation Strategy

> Emitida desde `128-RESEARCH.md` §Validation Architecture (fix B-1 del plan-checker).

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (jsdom) |
| **Config file** | `app/vitest.config.*` |
| **Quick run command** | `cd app && pnpm vitest run components/panel-actualidad.test.tsx components/panel-item-proyecto.test.tsx lib/links-internos.test.ts` (por NOMBRE — jamás glob `panel-*.test.tsx` pelado sin verificar conteo: passWithNoTests) |
| **Full suite command** | `cd app && pnpm test` (baseline pre-128 medido 2026-07-30: **1641**; gate = estrictamente MAYOR al baseline registrado en el summary de 128-05 — fix W-4) |
| **Guards** | `cd app && pnpm guards` (11 files) + `pnpm guards` raíz (17) |

## Sampling Rate

- **Per task commit:** vitest run de archivos tocados POR NOMBRE (verificar conteo ejecutado > 0)
- **Per wave merge:** quick run + `pnpm guards`
- **Phase gate (128-06):** full suite > baseline + guards + los 5 greps DOM sobre el volcado (`.artifacts/panel-render.html` — un solo `cd app`, fix W-1)
- **Max feedback latency:** 120 s

## Per-Task Verification Map

(Mapa Req→Test completo VERBATIM en `128-RESEARCH.md` §Validation Architecture — 21 filas: PANEL-02 ×3,
PANEL-03 ×3 [uno existente que INVIERTE], PANEL-04 ×3, PANEL-05 ×5, PANEL-07 ×3, Régimen ×4. Los
"❌ Wave 0" son exactamente los tests que los planes 01-06 crean; los "✅ existe" se conservan.)

## Wave 0 Requirements

- [ ] `app/lib/idioms-panel.ts` — single-source de stems (B-4: el guard lo IMPORTA, dirección LEYENDA_*), con el inventario COMPLETO de variantes (W-3): `Citado el`, `vigente desde`, `En tabla de sala de la Cámara del`, `En tabla de sala del`, `según fuente al`, `fechada el`, `fechado el`, `fechadas en`
- [ ] `app/lib/panel-camara.ts` (o export desde panel-evidencia) — `claseCamara` movida y exportada (B-3)
- [ ] `app/lib/links-internos.ts` + test (orden `?query#hash`)
- [ ] `components/panel-item-proyecto.tsx` + test (en_corpus:false → cero link interno)

## Security Domain (ASVS aplicable)

- **V4/A1 auditada por checker:** L4 lee `public.votacion` (NO-PII, agregada) SIN gate — consistente
  con el precedente vivo (actualidad-module:239 y proyecto page:302,562 sin gate; vsim-gate scopea
  SOLO similitud en /comparar). Cero flags tocados (vsim-antiflip-guard en verify).
- Riesgo dominante: copy insinuante en carril L4 — mitigación: linter carril PANEL como gate + moldes
  de idioms-panel single-source.
