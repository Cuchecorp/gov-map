---
phase: 115
slug: link-ext-patrones-de-link-a-fuente-oficial
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 115 — Validation Strategy

> Research se saltó: §3.1/§3.2/§3.3 del inventario 113 (validado) ES el universo de patrones. Validación ejecucional: la muestra live rate-limited y sus artefactos son la evidencia.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Script de muestra (curl-first, rate-limit 2-3s/host) + Vitest existente para no-regresión de fixes |
| **Quick run command** | probe de un caso (curl único) |
| **Full suite command** | corrida completa de la muestra (salida guardada) + `pnpm test` + `tsc -b` |
| **Estimated runtime** | muestra ~2-5 min (N patrones × delay 2-3s); suite ~min |

---

## Sampling Rate

- **After every task commit:** re-probe solo de los casos afectados (respetando rate-limit)
- **After every plan wave:** artefacto de patrones actualizado + checks de completitud
- **Before verify:** corrida completa registrada; suite = baseline (app 1431, packages sin delta); tsc 0; guards verdes
- **Max feedback latency:** ~5 min

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| patrones-enumerados | TBD | 1 | LINK-03 | — | Cada patrón con fuente+plantilla+parámetro+builder-o-columna; cobertura = §3.2 completo + familias emitidas de §3.3; excluidos con razón | checklist | grep de patrones vs §3.2/§3.3 | ❌ | pending |
| robots-por-host | TBD | 1 | LINK-03 | — | robots.txt de cada host registrado ANTES de la muestra | archivo | sección robots con ≥1 fila por host | ❌ | pending |
| muestra-live | TBD | 1-2 | LINK-03 | — | ≥1 caso por patrón×host con respuesta registrada; delay 2-3s/host verificable en el log (timestamps) | CLI + artefacto | salida guardada con timestamps monotónicos ≥2s por host | ❌ | pending |
| fixes-o-declaracion | TBD | 2 | LINK-03 | — | Cada patrón roto/genérico: fix con evidencia antes/después O declaración honesta en UI | diff + artefacto | lista cerrada patrón→veredicto→acción | ❌ | pending |
| no-regresion | TBD | 2 | LINK-03 | — | Suite baseline + tsc 0 + guards verdes | test | `set -o pipefail; pnpm test`; `tsc -b`; guards | ✅ | pending |

---

## Criterios de cierre de fase

1. Tabla de patrones completa (cero patrones emitidos al DOM sin fila): builder o columna, plantilla verbatim, parámetro, caso real.
2. Muestra live: ≥1 respuesta registrada por patrón×host; robots.txt respetado y registrado; timestamps prueban rate-limit ≥2s/host; CERO ráfagas.
3. Veredicto por patrón: OK / patrón-malo (fix aplicado con evidencia) / fuente-caída-WAF (declarado, jamás evadido).
4. Candidatos #1 (/buscar wspublico) y #2 (timeline B5) resueltos explícitamente.
5. Suite = baseline, tsc 0, guards de régimen verdes; deploy diferido a 125 declarado.
