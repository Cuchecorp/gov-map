---
phase: 114
slug: link-int-links-internos-exhaustivos
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 114 — Validation Strategy

> Research se saltó deliberadamente: el universo de links está enumerado exhaustivamente en `113-INVENTARIO.md` (`estado: validado`) — ese artefacto es el research de esta fase. La validación es ejecucional: el script de verificación ES el test.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Script Node reproducible (fetch + cheerio) contra el deploy real + Vitest existente para no-regresión |
| **Config file** | n/a (script standalone) |
| **Quick run command** | `node <script> --route <ruta>` (una ruta) |
| **Full suite command** | `node <script>` (corrida completa, salida guardada) + `pnpm test` (no-regresión) |
| **Estimated runtime** | corrida completa ~2-4 min (delay 300-500ms × ~N URLs); suite ~min |

---

## Sampling Rate

- **After every task commit:** correr el script sobre las rutas afectadas por el fix
- **After every plan wave:** corrida completa del script con salida guardada
- **Before `/gsd:verify-work`:** corrida completa verde (0 rotos no-declarados) + `pnpm test` = baseline (2.963/283) + `tsc` 0 + guards de régimen verdes
- **Max feedback latency:** ~4 min

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| script-links | TBD | 1 | LINK-02 | — | Script solicita cada link interno del inventario contra el deploy y reporta status + anclas | CLI | `node <script>` exit 0 con reporte | ❌ Wave 0 | pending |
| corrida-pre-fix | TBD | 1 | LINK-02 | — | Salida completa guardada como artefacto (estado ANTES) | archivo | salida `*-pre.{txt,json}` commiteada | ❌ | pending |
| anclas-dom | TBD | 1 | LINK-02 | — | Cada `#id` referenciado existe en el HTML del destino; los no-SSR verificados por BrowserOS | CLI + BrowserOS | reporte de anclas sin missing no-declarado | ❌ | pending |
| fixes-evidencia | TBD | 2 | LINK-02 | — | Cada roto corregido con evidencia antes/después | diff + salida | corrida post-fix guardada; diff citado | ❌ | pending |
| no-regresion | TBD | 2 | LINK-02 | — | Suite + tsc + guards verdes tras fixes | test | `pnpm test` = baseline; `tsc` 0 | ✅ suite existente | pending |

---

## Criterios de cierre de fase

1. Corrida reproducible completa guardada (pre y, si hubo fixes, post) — comando exacto documentado.
2. 0 links internos → 404 no-declarados (los gated-OFF verifican AUSENCIA del link, no el destino).
3. 0 anclas `#id` sin destino no-declaradas.
4. Todo fix con evidencia antes/después; deploy diferido a 125 declarado explícitamente.
5. Suite = baseline exacto, tsc 0, guards de régimen verdes.

## Wave 0 Gaps

- [ ] Script de verificación de links internos (Wave 0 del primer plan)
