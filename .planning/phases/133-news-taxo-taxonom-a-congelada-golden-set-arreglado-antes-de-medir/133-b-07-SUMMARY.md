---
phase: 133-news-taxo
plan: b-07
subsystem: news-eval
tags: [golden-set, congelado, arbitraje, p-dirigido, segunda-firma-proxy]
dependency-graph:
  requires: [133-b-05, 133-b-06]
  provides: [golden-set.json, arbitraje-133b.json, p-dirigido-133b.json, HASH_GOLDEN]
  affects: [135-NEWS-CLASIF, 137-NEWS-FICHAS]
decisions:
  - "P-dirigido ejecutado ANTES del congelado definitivo: 5 casos de fixtures fuera del pool (única fuente restante, D-133b-3 paso 5); tramitacion 20→22 y actividad 5→6 — NO alcanzan 25 ⇒ fail-closed DEFINITIVO."
  - "Fail-closed: T4 y T9 no-medidos. NINGUNA clase enruta a fichas (ni proyecto ni persona) hasta una medición futura con n≥25. Bajar el mínimo no fue considerado salida válida."
  - "Segunda firma emitida como PROXY Fable, ratificación de operador PENDIENTE (régimen D-133-RATIF)."
metrics:
  completed: "2026-08-10"
---

# 133-b-07 — golden-set.json CONGELADO: 159 casos, hash emitido una vez

## El número final

**`golden-set.json` sha256 = `47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c`**
— doble corrida byte-idéntica, `.gitattributes` LF vigente, 9/9 tests de congelación verdes
(incluye el hash nuevo, la entrada de CONGELADO.md con los TRES hashes, y bytes limpios).

## Composición y n por clase

| | n |
|---|---|
| Casos totales | **159** = 154 ventana (74 P + 50 N-alea + 30 N-sonda) + **5 P-dirigido** (fixtures) |
| no_legislativa | 72 |
| politica_no_legislativa | 58 |
| tramitacion_legislativa | **22 — no-medida (< 25)** |
| actividad_parlamentaria | **6 — no-medida (< 25)** |
| ley_vigente | 1 (se reporta sin umbral, como D-133-A2 previó) |
| ambiguo | 0 |

**T3 es medible** (3 clases con n≥8: 72/58/22). **T4 y T9 quedan `no-medido`** ⇒ fail-closed
D-133-D2: ninguna clase enruta a fichas de proyecto ni de persona en producción. La página de
137 lo declara.

## Arbitraje (proxy Fable, agentes frescos, sin estrato)

18 desacuerdos totales (17 ventana + 1 P-dirigido), 18 veredictos con justificación por
marca decisoria — `arbitraje-133b.json`. Un agente del workflow arbitró el índice equivocado
(duplicó `fb551be160d7`); se detectó por dedup contra el conjunto esperado y el caso faltante
(`fae7341f2b8f`) se arbitró aparte. Reparto: 8×a / 9×b (ventana) + 1×a (P-dirigido) — sin
sesgo sistemático hacia un anotador.

## P-dirigido: el intento honesto y su resultado

Los fixtures (132-01, commit `1098e40`, 2026-08-05) contenían 47 ítems fuera del pool de la
ventana; 5 pasan el pre-filtro. Anotados por A/B (0 problemas de validación), 1 desacuerdo
arbitrado (internacional ⇒ `no_legislativa`). Resultado: +2 tramitacion, +1 actividad, +2
no_legislativa. **Ni con el único P-dirigido disponible se alcanza n=25** — el hallazgo es
estructural: una ventana de 3 días de 5 feeds RSS chilenos produce ~7 casos/día de
tramitación real. Para medir T4 se necesitará una ventana más larga (Phase futura), jamás
ablandar el pre-filtro ni bajar el mínimo.

## Secuencia D-133b-3 cumplida

1 cobertura (133-b-03, gate=PASA) → 2 muestra congelada (133-b-02) → 3 etiquetado (ronda 1
GATILLADA → re-instrucción → ronda 2 PASA) → 4 conteo → 5 P-dirigido (fixtures) → 6
re-conteo → 7 **hash emitido una sola vez** (el CLI corrió pre-congelación solo para
verificar byte-estabilidad; ningún hash previo se publicó ni committeó).

## ⛔ SEGUNDA FIRMA — PROXY, RATIFICACIÓN PENDIENTE

Emitida como **"firma proxy Fable bajo instrucción verbatim del operador 2026-08-10"**
(`133-b-ENMIENDA-PROXY.md`), con κ, n por clase e IC a la vista:
κ(m↔m)=0.8293 [0.753,0.906], acuerdo 0.8896, κ(fable↔A)=0.7786, κ(fable↔B)=0.8513,
Δ=0.0144 (C2.1.3 no gatillada en ronda 2). **κ(humano↔máquina) NO MEDIDO.**

**Pendiente de ratificación del operador (en bloque, al cierre):** la enmienda proxy, la
adjudicación 133-b de Opus, esta segunda firma y el hash `47ace935…`.
