---
phase: 133-news-taxo
plan: b-06
subsystem: news-eval
tags: [kappa, interpretabilidad, C2.1.3, re-instruccion, ronda-2]
dependency-graph:
  requires: [133-b-05]
  provides: [kappa-cli.ts, kappas-133b.json]
  affects: [133-b-07]
decisions:
  - "Ronda 1: regla C2.1.3 GATILLADA (delta=0.2035 > 0.15) ⇒ el k de maquina de ronda 1 NO es interpretable como acuerdo inter-anotador; el golden NO se congela con estos numeros."
  - "Re-instruccion (unica ronda permitida antes de C2.4): precisiones al PROMPT derivadas del texto de la glosa congelada — la taxonomia NO se toca; la calibracion Fable queda FIJA como referencia."
metrics:
  completed: "2026-08-10 (ronda 1; ronda 2 en curso)"
---

# 133-b-06 — Ronda 1: κ computados, regla C2.1.3 GATILLADA, re-instrucción activada

## Números medidos (ronda 1) — `kappas-133b.json` sha256=8dcfd03f…

| Métrica | Valor | IC95 | n |
|---|---|---|---|
| κ(m↔m) A×B | **0.8279** | [0.753, 0.903] | 154 |
| acuerdo bruto A×B | 0.8831 | Wilson [0.823, 0.925] | 154 |
| κ(fable↔A) | 0.6516 | ancho (n=20) | 20 |
| κ(fable↔B) | 0.5973 | ancho (n=20) | 20 |
| κ(fable↔m) media | **0.6245** | — | — |
| **Δ = κmm − κfable** | **0.2035** | — | **GATILLADA (>0.15)** |

Puertas C2.3 (ronda 1): acuerdo ≥0.80 **PASA** (0.8831); κ ≥0.65 **PASA** (0.8279). Pero por
C2.1.3 el κ de máquina **no puede citarse** como vara: conocimiento compartido de criterio
demasiado divergente del calibrador.

`tasa_ambiguo` = 0 en los tres anotadores. n por clase provisional (136 acordados):
no_legislativa 68, politica 33, tramitacion 22, actividad 11, ley_vigente 2.

## Diagnóstico de la divergencia (por caso, antes de re-instruir)

- **Frontera 1↔2: cero desacuerdos directos** ⇒ la condición de refutación de D-133-A2 ("el
  desacuerdo se concentra en 1/2 ⇒ frontera ficticia") **NO se cumple**. La taxonomía vive.
- Hub real: **clase 4**. Tres modos de fallo de las máquinas, todos contra el texto literal
  de la glosa:
  1. **1 sobre-aplicada**: "comisión del Senado abordó problemáticas" / "permisos de viaje
     visados por la Cámara" etiquetados 1 — pero la definición exige acto de tramitación
     **de una iniciativa**; sesiones temáticas y votos no-iniciativa no lo son.
  2. **2 sobre-aplicada**: "exdiputada" (no está en ejercicio ⇒ frontera dice 4) e
     "investigación de fiscalía a senador" (acto NO listado en la marca decisoria cerrada:
     declaración, comisión investigadora, lobby, patrimonio, ética, asistencia) etiquetados 2.
  3. **4↔5 inestable**: "Corte de Temuco rechaza amparo" (tribunal no-TC pero hecho sin
     dimensión política ⇒ 5) y "revisada por La Moneda" (anuncio del Ejecutivo ⇒ 4).

## Decisión (C2.1.3, ronda única de re-instrucción)

Re-instruir a los DOS anotadores con **precisiones de prompt derivadas de la glosa LOCKED**
(no de las respuestas de Fable caso a caso): iniciativa obligatoria para clase 1; lista
cerrada + "en ejercicio" duro para clase 2; criterio de dimensión política para 4↔5.
Re-correr A y B sobre los mismos 154 (mismos órdenes, mismas entradas), re-computar registro
y κ. **La calibración Fable NO se re-corre** (es la referencia fija del control).

Si la regla se gatilla por segunda vez ⇒ C2.4: taxonomía NO ETIQUETABLE sobre
titular+bajada, Phase 133 reporta FRACASO (con las salidas honestas pre-escritas).

## RONDA 2 — resultado (2026-08-10, post re-instrucción)

**La regla C2.1.3 NO se gatilló en ronda 2. El golden puede congelarse.**

| Métrica | Ronda 1 | **Ronda 2** |
|---|---|---|
| κ(m↔m) | 0.8279 | **0.8293** [0.753, 0.906] |
| acuerdo bruto | 0.8831 | **0.8896** (137/154, 17 desacuerdos) |
| κ(fable↔A) | 0.6516 | **0.7786** |
| κ(fable↔B) | 0.5973 | **0.8513** |
| Δ (C2.1.3) | 0.2035 GATILLADA | **0.0144 — NO gatillada** |

Puertas C2.3: acuerdo ≥0.80 **PASA** (0.8896); κ ≥0.65 **PASA** (0.8293). El κ de máquina de
ronda 2 ES interpretable (con la limitación intra-familia adjunta).

**La compuerta de validación mordió en ronda 2** (falso verde evitado): la primera corrida
traía 45 salidas inválidas — lote a-07 anotó el RANGO equivocado (11 duplicados + 11 sin
cubrir), lote b-04 emitió NUMERALES ("4"/"5") en vez de nombres de etiqueta, y 3 citas no
literales (a-05, a-07, b-06). Los 4 lotes se re-corrieron con la instrucción reforzada;
registro final 154/154 con 0 problemas. `registro-anotacion.json` (ronda 2)
sha256=d9ecf47a…, `kappas-133b.json` sha256=55600fa5….

Desacuerdos de ronda 2 (17): el hub sigue siendo la clase 4 (9 son 5↔4), consistente con
fronteras difusas de política contingente — van todos a arbitraje (b-07).

## Limitación permanente (enmienda proxy)

Todo κ(fable↔·) es intra-familia Anthropic; κ(humano↔máquina) NO MEDIDO. La gatillada de
C2.1.3 bajo proxy es, si acaso, MÁS severa de lo que sería con humano (linaje compartido
debería inflar el acuerdo, no deflactarlo) — se declara, no se interpreta más allá.
