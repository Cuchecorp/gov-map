---
phase: 133-news-taxo
plan: b-05
subsystem: news-eval
tags: [anotacion, golden-set, workflow, sonnet, opus, proxy-fable]
dependency-graph:
  requires: [133-b-04, 133-b-ENMIENDA-PROXY]
  provides: [anotacion.ts, registro.ts, kappa.ts, registro-anotacion.json, etiquetas-calibracion-fable.json]
  affects: [133-b-06, 133-b-07]
key-files:
  created:
    - packages/news/src/eval/anotacion.ts
    - packages/news/src/eval/anotacion-cli.ts
    - packages/news/src/eval/anotacion.test.ts
    - packages/news/src/eval/anotacion-entradas-a.json
    - packages/news/src/eval/anotacion-entradas-b.json
    - packages/news/src/eval/anotacion-prompt.txt
    - packages/news/src/eval/registro.ts
    - packages/news/src/eval/registro-cli.ts
    - packages/news/src/eval/registro.test.ts
    - packages/news/src/eval/kappa.ts
    - packages/news/src/eval/kappa.test.ts
    - packages/news/src/eval/registro-anotacion.json
    - packages/news/src/eval/etiquetas-calibracion-fable.json
decisions:
  - "Cita literal verificable: cada anotador emite `cita` (subcadena exacta) y la validación la comprueba por código — C2.2 deja de depender de lectura humana."
  - "Regla C2.1.3 con tolerancia 1e-9: el borde Δ=0,15 exacto NO gatilla (desigualdad estricta de C2.1.3; 0.8−0.65 = 0.15000000000000002 en IEEE 754)."
  - "κ(fable↔m) = media de κ(fable↔A) y κ(fable↔B) — la regla original no fijaba el comparando; la media es la lectura simétrica."
metrics:
  completed: "2026-08-10"
---

# 133-b-05 — Anotadores A/B ejecutados, registro C2.5 congelado

**ORDEN CUMPLIDO (C2.1.2):** la calibración proxy Fable (20 casos, agente fresco ciego, commit
previo) se congeló ANTES de correr o revelar cualquier etiqueta de máquina.

## Números medidos

- Entradas: **154** (join muestra×pool 154/154, fallo duro probado), órdenes A/B
  descorrelacionados (`:anot:a` / `:anot:b`), ceguera por doble candado en ambos artefactos.
  `sha_a=6ddafe87…`, `sha_b=a54b61a7…`, `sha_prompt=4fb725bb…`.
- Workflow de anotación: **16 agentes** (8 lotes Sonnet = anotador A, 8 lotes Opus = B),
  16/16 completos, 0 errores, ~1.15M tokens de subagentes, 138 s.
- Validación determinista: **0 problemas** en 308 salidas (cobertura 154+154, etiquetas
  legales, justificación ≤200, citas literales todas verificadas por subcadena).
- **Registro C2.5:** `registro-anotacion.json` `sha256=0f6c94b6…` — casos=154,
  **acuerdos=136, desacuerdos=18, acuerdo bruto=0.8831**.
- Puertas C2.3: acuerdo ≥0,80 ✓ (0.8831). Desacuerdos 18 ≤ 25 ⇒ **se arbitran todos** en
  b-07 (proxy Fable, agentes frescos sin estrato).
- Tests nuevos: 9 (anotacion) + 8 (kappa) + 5 (registro) = **+22**; suite @obs/news 318→340.

## Deviations

- Anotación ejecutada por agentes Claude Code (Sonnet/Opus) vía Workflow en vez de API
  externa — patrón sonnet-swarm ya establecido; modelos registrados en el artefacto
  (`modelo_a=claude-sonnet-5`, `modelo_b=claude-opus-5`), consistente con D-133b-4.
- Fix flotante en `reglaInterpretabilidad` (borde Δ=0,15) encontrado por el test (g) — el
  test cayó primero, el código se corrigió después.

## Pendiente inmediato (b-06)

κ(m↔m) sobre 154, κ(fable↔A/B) sobre los 20, regla C2.1.3 con limitación intra-familia,
n por clase provisional (136 acordados; 18 pendientes de arbitraje).
