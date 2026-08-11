---
phase: 135-news-clasif
subsystem: news-clasificador
tags: [golden-gate, benchmark, deepseek, ledger, idempotencia]
dependency-graph:
  requires: [133-b-07, 134]
  provides: [gate-clasificador, veredicto-135.json, clasificador/, 0087, llm_ledger]
  affects: [136, 137]
decisions:
  - "Etiqueta = columnas en noticia (0087) con coherencia estado<->etiqueta por CHECK; historial fino = YAGNI declarado."
  - "Eleccion COMPUTADA: DeepSeek (empate por solapamiento de IC95 con MiniMax => incumbente). Granite NO-MEDIDO en dominio (401 Workers AI probado con sonda — infra, no calidad)."
  - "La etiqueta evaluada en el bench es LA EMITIDA; el umbral de confianza es seguridad de produccion (tasa informativa)."
metrics:
  completed: "2026-08-11"
---

# Phase 135 — NEWS-CLASIF: el clasificador entró a producción PASANDO la vara

## Números medidos

- **Bench live (159 casos × 3 candidatos, ~40 min):** DeepSeek **aprueba** T3=0.8766
  [0.813, 0.918], T1=0, T2=0; MiniMax **aprueba** T3=0.9018 [0.844, 0.939]; **empate por
  solapamiento de IC ⇒ elección: deepseek** (incumbente). Granite: 159/159 parse_fallido en
  53 s = **401 de Workers AI** (credencial vencida; probado con sonda de 1 llamada) ⇒
  **NO-MEDIDO en dominio**, su re-validación queda pendiente de credencial. Artefacto
  `veredicto-135.json` sha `d6fa8c37…` congelado (CONGELADO.md + congelado.test.ts, un commit).
- **Corrida real PROD (DeepSeek):** 74/74 pendientes → `clasificada` (0 rechazos);
  **re-corrida `[skip]` con 0 llamadas** (idempotencia SC4). Etiquetas: política 25,
  tramitación 22, no_legislativa 19, actividad 8. `llm_ledger`: filas (74) y (0) por run_id.
  `noticia_dead_letter`: 0.
- Suite @obs/news: 362 → **386** (7 gate + 2 congelado + 11 clasificador + ajustes).
- 0087 aplicada a PROD, pgTAP 12/12 (checks de etiqueta/coherencia/confianza muerden).

## SC

1. Gate en CI bloqueante + fixture de mutación (degradado falla) ✓ — `gate-clasificador.test.ts`
   corre en el step `@obs/news` de ci.yml; `congelado.test.ts (a4)` fija sha del veredicto y
   exige `eleccion=deepseek, aprueba=true`.
2. Elección computada respetando v11.0 (candidatos = capa enchufable, jamás Sonnet/Opus;
   prompt de producción ≠ prompt de anotación por sha) ✓.
3. Cap duro 500/corrida + ledger consultable ✓ (test del cap; ledger escrito en `finally`).
4. Vista-antes-de-reject (132-05) + re-corrida no reprocesa ✓ (demostrado en PROD).

## Verificación (Opus, adversarial) + hardening

3/3 mutaciones mordieron (T3 umbral, ledger en finally, cap). Hallazgos corregidos en el
mismo cierre: **H2 (ALTO)** el catch pelado convertía 401/red en descartes PERMANENTES — ahora
solo LLMValidationError/ZodError son parse_fallido y la infraestructura ABORTA la corrida
(noticias quedan pendientes, test (d) nuevo); **H1** cap congelado por literal en test;
**H4** el CLI exige aprueba=true del elegido en el artefacto; **H5** umbrales del gate leídos
DESDE THRESHOLDS (cero literales duplicados); **H8** test de re-corrida real (no vacuo);
**H3** veredicto re-congelado sha d6fa8c37→8fa3a690 con granite_estado computado
(no-medido-por-credencial). Declarados sin fix: H6 (la vara mide 3 clases mayoritarias —
ley_vigente n=1 esencialmente no evaluada), H7 (IC de T3 es aproximación binomial,
declarada), H9 (passWithNoTests, deuda K2 conocida). Suite final 383.

Fail-closed heredado intacto: T4/T9 no-medidos ⇒ la etiqueta es interna, nada enruta a
fichas (eso queda declarado para 137).
