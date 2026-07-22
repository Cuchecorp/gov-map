# 86-SCORING — Resultados del Spike de Retrieval Híbrido

**Corrida:** 2026-07-22T00:43:39.268Z
**Golden set:** 32 casos

## Cobertura de Embeddings (LIVE)

| Métrica | Valor |
|---------|-------|
| proyecto (total) | 3659 |
| proyecto_embedding | 3100 |
| Cobertura | 84.7% |
| unaccent habilitado | false |

## Tabla Estrategia × Categoría

### 1. FTS-solo
`limit=50 unaccent=false`

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
| acentos-toponimos | 5 | 20.0% | 40.0% | 24.0% |
| boletin | 4 | 0.0% | 0.0% | 0.0% |
| normas | 5 | 0.0% | 0.0% | 0.0% |
| parafrasis-nl | 5 | 0.0% | 0.0% | 0.0% |
| similares | 5 | 0.0% | 0.0% | 0.0% |
| titulo-literal | 8 | 25.0% | 50.0% | 32.3% |
| **AGREGADO** | **32** | **9.4%** | **18.8%** | **11.8%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | — | ✗ |
| tl-03 | titulo-literal | 4 | ✓ |
| tl-04 | titulo-literal | — | ✗ |
| tl-05 | titulo-literal | — | ✗ |
| tl-06 | titulo-literal | 3 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | — | ✗ |
| nl-02 | parafrasis-nl | — | ✗ |
| nl-03 | parafrasis-nl | — | ✗ |
| nl-04 | parafrasis-nl | — | ✗ |
| nl-05 | parafrasis-nl | — | ✗ |
| nr-01 | normas | — | ✗ |
| nr-02 | normas | — | ✗ |
| nr-03 | normas | — | ✗ |
| nr-04 | normas | — | ✗ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | — | ✗ |
| bo-02 | boletin | — | ✗ |
| bo-03 | boletin | — | ✗ |
| bo-04 | boletin | — | ✗ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 5 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | — | ✗ |
| sm-02 | similares | — | ✗ |
| sm-03 | similares | — | ✗ |
| sm-04 | similares | — | ✗ |
| sm-05 | similares | — | ✗ |

</details>

### 2. Semántico-solo (match_proyectos)
`limit=50`

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
| acentos-toponimos | 5 | 20.0% | 20.0% | 20.0% |
| boletin | 4 | 0.0% | 0.0% | 0.0% |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 60.0% | 80.0% | 64.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 46.3% |
| **AGREGADO** | **32** | **34.4%** | **53.1%** | **40.3%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | 6 | ✓ |
| tl-03 | titulo-literal | 5 | ✓ |
| tl-04 | titulo-literal | 1 | ✓ |
| tl-05 | titulo-literal | 4 | ✓ |
| tl-06 | titulo-literal | 4 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | 1 | ✓ |
| nl-02 | parafrasis-nl | 1 | ✓ |
| nl-03 | parafrasis-nl | 1 | ✓ |
| nl-04 | parafrasis-nl | 11 | ✓ |
| nl-05 | parafrasis-nl | 2 | ✓ |
| nr-01 | normas | 2 | ✓ |
| nr-02 | normas | 1 | ✓ |
| nr-03 | normas | 11 | ✓ |
| nr-04 | normas | 9 | ✓ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | — | ✗ |
| bo-02 | boletin | — | ✗ |
| bo-03 | boletin | — | ✗ |
| bo-04 | boletin | — | ✗ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 7 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | 1 | ✓ |
| sm-02 | similares | 5 | ✓ |
| sm-03 | similares | 39 | ✓ |
| sm-04 | similares | 1 | ✓ |
| sm-05 | similares | 1 | ✓ |

</details>

### 3. RRF (FTS ∪ semántico)
`rrf-k=50 limit=50 w-fts=1 w-sem=1 unaccent=false`

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | 100.0% | 100.0% | 100.0% |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **43.8%** | **68.8%** | **53.6%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | 6 | ✓ |
| tl-03 | titulo-literal | 2 | ✓ |
| tl-04 | titulo-literal | 1 | ✓ |
| tl-05 | titulo-literal | 5 | ✓ |
| tl-06 | titulo-literal | 2 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | 1 | ✓ |
| nl-02 | parafrasis-nl | 1 | ✓ |
| nl-03 | parafrasis-nl | 1 | ✓ |
| nl-04 | parafrasis-nl | 11 | ✓ |
| nl-05 | parafrasis-nl | 2 | ✓ |
| nr-01 | normas | 2 | ✓ |
| nr-02 | normas | 1 | ✓ |
| nr-03 | normas | 11 | ✓ |
| nr-04 | normas | 9 | ✓ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | 1 | ✓ |
| bo-02 | boletin | 1 | ✓ |
| bo-03 | boletin | 1 | ✓ |
| bo-04 | boletin | 1 | ✓ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 4 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | 1 | ✓ |
| sm-02 | similares | 5 | ✓ |
| sm-03 | similares | 39 | ✓ |
| sm-04 | similares | 1 | ✓ |
| sm-05 | similares | 2 | ✓ |

</details>

## Resumen Comparativo

| Estrategia | hit@1 | hit@5 | MRR |
|------------|-------|-------|-----|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semántico-solo | 34.4% | 53.1% | 40.3% |
| RRF | 43.8% | 68.8% | 53.6% |

## DECISIÓN

> _(Completar tras revisar los resultados: algoritmo, pesos A/B/C, rrf_k, límite de candidatos, cobertura embeddings LIVE, plan de flag, gate de 87)_

- **Algoritmo elegido:** _TBD_
- **Pesos FTS/semántico:** _TBD_
- **rrf_k:** _TBD_
- **Límite de candidatos por rama:** _TBD_
- **Cobertura embeddings LIVE:** 3100/3659 (84.7%)
- **Plan de flag:** match_proyectos se CONSERVA; la híbrida entra tras flag en fase 87 hasta dominar el golden set; sin dominación no hay rewire (gate de 87 explícito).
- **Criterio de victoria:** arregla literal/boletín Y no regresiona NL/similares
